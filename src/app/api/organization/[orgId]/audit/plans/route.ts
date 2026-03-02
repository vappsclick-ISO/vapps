import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { withTenantConnection } from "@/lib/db/connection-helper";

/**
 * GET /api/organization/[orgId]/audit/plans
 * List audit plans: for current user as Lead Auditor or as assigned auditor.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const ctx = await getRequestContext(req, orgId);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connectionString = ctx.tenant.connectionString;
    if (!connectionString) {
      return NextResponse.json({ error: "Tenant database not found" }, { status: 404 });
    }

    const userId = ctx.user.id;
    const plans: any[] = [];

    await withTenantConnection(connectionString, async (client) => {
      const tableCheck = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_plans'`
      );
      if (tableCheck.rows.length === 0) {
        return;
      }

      const hasChecklistIdCol = await client.query(
        `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_plans' AND column_name = 'checklist_id'`
      );
      const checklistCol = hasChecklistIdCol.rows.length > 0 ? ", ap.checklist_id" : "";

      const hasFindingsTable = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_plan_findings'`
      );
      const hasKpiTable = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_program_kpis'`
      );
      const findingsCols =
        hasFindingsTable.rows.length > 0
          ? ", (SELECT f.clause FROM audit_plan_findings f WHERE f.audit_plan_id = ap.id ORDER BY f.row_index ASC LIMIT 1) as first_clause, (SELECT f.subclauses FROM audit_plan_findings f WHERE f.audit_plan_id = ap.id ORDER BY f.row_index ASC LIMIT 1) as first_subclauses"
          : "";
      const kpiCol =
        hasKpiTable.rows.length > 0
          ? ", (SELECT k.score FROM audit_program_kpis k WHERE k.audit_program_id = ap.audit_program_id ORDER BY k.kpia_number LIMIT 1) as kpi_score"
          : "";

      const result = await client.query(
        `SELECT ap.id, ap.audit_program_id, ap.status, ap.lead_auditor_user_id, ap.auditee_user_id,
                ap.title, ap.audit_number, ap.criteria${checklistCol}, ap.planned_date, ap.date_prepared,
                ap.plan_submitted_at, ap.findings_submitted_at, ap.created_at,
                p.name as program_name, p.audit_type, p.audit_criteria as program_criteria,
                (SELECT proc.name FROM processes proc WHERE proc.id = p.process_id LIMIT 1) as process_name,
                (SELECT s.name FROM audit_program_sites aps JOIN sites s ON s.id = aps.site_id WHERE aps.audit_program_id = p.id LIMIT 1) as site_name${findingsCols}${kpiCol}
         FROM audit_plans ap
         JOIN audit_programs p ON p.id = ap.audit_program_id
         WHERE ap.lead_auditor_user_id = $1
            OR EXISTS (SELECT 1 FROM audit_plan_assignments a WHERE a.audit_plan_id = ap.id AND a.user_id = $1)
            OR ap.auditee_user_id = $1
         ORDER BY ap.created_at DESC`,
        [userId]
      );

      const planIds = result.rows.map((r: { id: string }) => r.id);
      const assignmentsByPlan: Record<string, string[]> = {};
      if (planIds.length > 0) {
        const assignResult = await client.query<{ audit_plan_id: string; user_id: string }>(
          `SELECT audit_plan_id::text as audit_plan_id, user_id::text as user_id FROM audit_plan_assignments WHERE audit_plan_id::text = ANY($1)`,
          [planIds]
        );
        assignResult.rows.forEach((r) => {
          if (!assignmentsByPlan[r.audit_plan_id]) assignmentsByPlan[r.audit_plan_id] = [];
          assignmentsByPlan[r.audit_plan_id].push(r.user_id);
        });
      }

      for (const row of result.rows) {
        const assignedAuditorIds = assignmentsByPlan[row.id] ?? [];
        const isLeadAuditor = row.lead_auditor_user_id === userId;
        const isAssignedAuditor = assignedAuditorIds.includes(userId);
        const isAuditee = row.auditee_user_id === userId;
        const status = row.status;

        let nextStepForUser: number | null = null;
        if (isAssignedAuditor && status === "plan_submitted_to_auditee") nextStepForUser = 3;
        else if (isAuditee && status === "findings_submitted_to_auditee") nextStepForUser = 4;
        else if (isAssignedAuditor && status === "ca_submitted_to_auditor") nextStepForUser = 5;
        else if (isLeadAuditor && (status === "pending_closure" || status === "closed")) nextStepForUser = 6;

        plans.push({
          id: row.id,
          auditProgramId: row.audit_program_id,
          status: row.status,
          leadAuditorUserId: row.lead_auditor_user_id,
          auditeeUserId: row.auditee_user_id,
          assignedAuditorIds,
          nextStepForUser,
          title: row.title,
          auditNumber: row.audit_number,
          criteria: row.criteria,
          checklistId: (row as { checklist_id?: string }).checklist_id ?? null,
          plannedDate: row.planned_date,
          datePrepared: row.date_prepared,
          planSubmittedAt: row.plan_submitted_at,
          findingsSubmittedAt: row.findings_submitted_at,
          createdAt: row.created_at,
          programName: row.program_name,
          auditType: row.audit_type,
          programCriteria: row.program_criteria,
          processName: row.process_name ?? null,
          siteName: row.site_name ?? null,
          firstClause: (row as { first_clause?: string }).first_clause ?? null,
          firstSubclauses: (row as { first_subclauses?: string }).first_subclauses ?? null,
          kpiScore: (row as { kpi_score?: string }).kpi_score ?? null,
        });
      }
    });

    return NextResponse.json({ plans });
  } catch (error) {
    console.error("Error listing audit plans:", error);
    return NextResponse.json(
      { error: "Failed to list audit plans" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/organization/[orgId]/audit/plans
 * Create audit plan (Step 2 "Generate Audit Plan" / Submit to Auditee).
 * Body: auditProgramId, title?, auditNumber?, criteria, plannedDate?, datePrepared?, assignedAuditorIds[] (user ids from Step 2)
 * Sets status = plan_submitted_to_auditee, plan_submitted_at = now.
 * Program Responsible Person = Auditee: auditee_user_id comes from program.program_owner_user_id.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const ctx = await getRequestContext(req, orgId);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connectionString = ctx.tenant.connectionString;
    if (!connectionString) {
      return NextResponse.json({ error: "Tenant database not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const auditProgramId = body.auditProgramId ?? body.audit_program_id;
    const title = body.title ?? body.name ?? null;
    const auditNumber = body.auditNumber ?? body.audit_number ?? null;
    const criteria = body.criteria ?? null;
    const checklistId = body.checklistId ?? body.checklist_id ?? null;
    const plannedDate = body.plannedDate ?? body.planned_date ?? null;
    const datePrepared = body.datePrepared ?? body.date_prepared ?? null;
    const assignedAuditorIds: string[] = Array.isArray(body.assignedAuditorIds)
      ? body.assignedAuditorIds
      : Array.isArray(body.assigned_auditor_ids)
        ? body.assigned_auditor_ids
        : [];

    if (!auditProgramId) {
      return NextResponse.json(
        { error: "auditProgramId is required" },
        { status: 400 }
      );
    }

    let planId: string | null = null;

    await withTenantConnection(connectionString, async (client) => {
      const programCheck = await client.query(
        `SELECT id, program_owner_user_id, lead_auditor_user_id FROM audit_programs WHERE id = $1`,
        [auditProgramId]
      );
      const program = programCheck.rows[0];
      if (!program) {
        throw new Error("Audit program not found");
      }

      const auditeeUserId = program.program_owner_user_id;
      const leadAuditorUserId = program.lead_auditor_user_id ?? ctx.user.id;

      const plansTableCheck = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_plans'`
      );
      if (plansTableCheck.rows.length === 0) {
        throw new Error("audit_plans table does not exist. Run tenant migration 014.");
      }

      const plannedDateStr = plannedDate
        ? (typeof plannedDate === "string" ? plannedDate : (plannedDate as Date)?.toISOString?.()?.slice(0, 10))
        : null;
      const datePreparedStr = datePrepared
        ? (typeof datePrepared === "string" ? datePrepared : (datePrepared as Date)?.toISOString?.()?.slice(0, 10))
        : new Date().toISOString().slice(0, 10);

      const hasChecklistId = await client.query(
        `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_plans' AND column_name = 'checklist_id'`
      );
      if (hasChecklistId.rows.length > 0) {
        const insertPlan = await client.query(
          `INSERT INTO audit_plans (
            audit_program_id, status, lead_auditor_user_id, auditee_user_id,
            title, audit_number, criteria, checklist_id, planned_date, date_prepared,
            plan_submitted_at
          ) VALUES ($1, 'plan_submitted_to_auditee', $2, $3, $4, $5, $6, $7, $8, $9, now())
          RETURNING id`,
          [
            auditProgramId,
            leadAuditorUserId,
            auditeeUserId,
            title,
            auditNumber,
            criteria,
            checklistId,
            plannedDateStr,
            datePreparedStr,
          ]
        );
        planId = insertPlan.rows[0]?.id;
      } else {
        const insertPlan = await client.query(
          `INSERT INTO audit_plans (
            audit_program_id, status, lead_auditor_user_id, auditee_user_id,
            title, audit_number, criteria, planned_date, date_prepared,
            plan_submitted_at
          ) VALUES ($1, 'plan_submitted_to_auditee', $2, $3, $4, $5, $6, $7, $8, now())
          RETURNING id`,
          [
            auditProgramId,
            leadAuditorUserId,
            auditeeUserId,
            title,
            auditNumber,
            criteria,
            plannedDateStr,
            datePreparedStr,
          ]
        );
        planId = insertPlan.rows[0]?.id;
      }
      if (!planId) throw new Error("Failed to create audit plan");

      for (const uid of assignedAuditorIds) {
        if (uid) {
          await client.query(
            `INSERT INTO audit_plan_assignments (audit_plan_id, user_id) VALUES ($1, $2) ON CONFLICT (audit_plan_id, user_id) DO NOTHING`,
            [planId, uid]
          );
        }
      }
    });

    return NextResponse.json({ planId, success: true });
  } catch (error: any) {
    console.error("Error creating audit plan:", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to create audit plan" },
      { status: 500 }
    );
  }
}
