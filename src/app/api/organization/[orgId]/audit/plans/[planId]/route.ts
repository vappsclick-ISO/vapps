import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { withTenantConnection } from "@/lib/db/connection-helper";

/**
 * GET /api/organization/[orgId]/audit/plans/[planId]
 * Get one audit plan with program and assigned auditors.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; planId: string }> }
) {
  try {
    const { orgId, planId } = await params;
    const ctx = await getRequestContext(req, orgId);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connectionString = ctx.tenant.connectionString;
    if (!connectionString) {
      return NextResponse.json({ error: "Tenant database not found" }, { status: 404 });
    }

    let plan: any = null;

    await withTenantConnection(connectionString, async (client) => {
      const tableCheck = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_plans'`
      );
      if (tableCheck.rows.length === 0) return;

      const hasStep4Col = await client.query(
        `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_plans' AND column_name = 'step_4_data'`
      );
      const hasStep2Col = await client.query(
        `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_plans' AND column_name = 'step_2_data'`
      );
      const hasStep5Col = await client.query(
        `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_plans' AND column_name = 'step_5_data'`
      );
      const hasStep6Col = await client.query(
        `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_plans' AND column_name = 'step_6_data'`
      );
      const stepCols = [
        hasStep4Col.rows.length > 0 ? "ap.step_4_data" : null,
        hasStep2Col.rows.length > 0 ? "ap.step_2_data" : null,
        hasStep5Col.rows.length > 0 ? "ap.step_5_data" : null,
        hasStep6Col.rows.length > 0 ? "ap.step_6_data" : null,
      ].filter(Boolean).join(", ");
      const stepColsClause = stepCols ? `, ${stepCols}` : "";

      const planResult = await client.query(
        `SELECT ap.id, ap.audit_program_id, ap.status, ap.lead_auditor_user_id, ap.auditee_user_id,
                ap.title, ap.audit_number, ap.criteria, ap.planned_date, ap.date_prepared,
                ap.plan_submitted_at, ap.findings_submitted_at, ap.created_at${stepColsClause},
                p.name as program_name, p.audit_type, p.audit_criteria as program_criteria
         FROM audit_plans ap
         JOIN audit_programs p ON p.id = ap.audit_program_id
         WHERE ap.id = $1`,
        [planId]
      );
      let row = planResult.rows[0];
      if (!row) return;

      // Backfill audit_number if null (e.g. plans created before system-generated numbers)
      let auditNumberValue = (row as { audit_number?: string | null }).audit_number;
      if (auditNumberValue == null || String(auditNumberValue).trim() === "") {
        const nextRes = await client.query<{ next: string }>(
          `SELECT (COALESCE(MAX(CAST(NULLIF(TRIM(audit_number), '') AS INTEGER)), 0) + 1)::text AS next
           FROM audit_plans WHERE audit_number ~ '^[0-9]+$'`
        );
        const nextNum = nextRes.rows[0]?.next ?? "1";
        await client.query(
          `UPDATE audit_plans SET audit_number = $1, updated_at = now() WHERE id = $2`,
          [nextNum, planId]
        );
        auditNumberValue = nextNum;
      }

      let step2DataRaw = (row as { step_2_data?: unknown }).step_2_data ?? null;
      if (typeof step2DataRaw === "string") {
        try {
          step2DataRaw = JSON.parse(step2DataRaw as string) as object;
        } catch {
          step2DataRaw = null;
        }
      }

      let step5DataRaw = (row as { step_5_data?: unknown }).step_5_data ?? null;
      if (typeof step5DataRaw === "string") {
        try {
          step5DataRaw = JSON.parse(step5DataRaw as string) as object;
        } catch {
          step5DataRaw = null;
        }
      }

      let step6DataRaw = (row as { step_6_data?: unknown }).step_6_data ?? null;
      if (typeof step6DataRaw === "string") {
        try {
          step6DataRaw = JSON.parse(step6DataRaw as string) as object;
        } catch {
          step6DataRaw = null;
        }
      }

      plan = {
        id: row.id,
        auditProgramId: row.audit_program_id,
        status: row.status,
        leadAuditorUserId: row.lead_auditor_user_id,
        auditeeUserId: row.auditee_user_id,
        title: row.title ?? null,
        auditNumber: auditNumberValue ?? row.audit_number ?? null,
        criteria: row.criteria ?? null,
        plannedDate: row.planned_date ?? null,
        datePrepared: row.date_prepared ?? null,
        planSubmittedAt: row.plan_submitted_at ?? null,
        findingsSubmittedAt: row.findings_submitted_at ?? null,
        createdAt: row.created_at ?? null,
        programName: row.program_name ?? null,
        auditType: row.audit_type ?? null,
        programCriteria: row.program_criteria ?? null,
        step4Data: (row as { step_4_data?: unknown }).step_4_data ?? null,
        step2Data: step2DataRaw,
        step5Data: step5DataRaw,
        step6Data: step6DataRaw,
        assignedAuditorIds: [] as string[],
      };

      const assignResult = await client.query(
        `SELECT user_id FROM audit_plan_assignments WHERE audit_plan_id = $1`,
        [planId]
      );
      plan.assignedAuditorIds = assignResult.rows.map((r: { user_id: string }) => r.user_id);

      const amrcTableExists = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_plan_amrc_rows'`
      );
      const auditorResTableExists = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_plan_auditor_resources'`
      );

      if (amrcTableExists.rows.length > 0) {
        const amrcResult = await client.query(
          `SELECT id, review_category, comments, priority, action FROM audit_plan_amrc_rows WHERE audit_plan_id = $1 ORDER BY row_index, created_at`,
          [planId]
        );
        const amrcRows = amrcResult.rows.map((r: { id: string; review_category: string | null; comments: string | null; priority: string; action: string | null }) => ({
          id: r.id,
          reviewCategory: r.review_category ?? "",
          comments: r.comments ?? "",
          priority: r.priority ?? "MEDIUM",
          action: r.action ?? "",
        }));
        plan.step2Data = plan.step2Data && typeof plan.step2Data === "object" ? { ...plan.step2Data, amrcRows } : { amrcRows };
      }

      if (auditorResTableExists.rows.length > 0) {
        const auditorResResult = await client.query(
          `SELECT id, user_id, role_assignment, technical_expert, observer, trainee FROM audit_plan_auditor_resources WHERE audit_plan_id = $1 ORDER BY row_index, created_at`,
          [planId]
        );
        const auditorResources = auditorResResult.rows.map((r: { id: string; user_id: string | null; role_assignment: string | null; technical_expert: string | null; observer: string | null; trainee: string | null }) => ({
          id: r.id,
          auditorUserId: r.user_id ?? "",
          auditorUin: r.user_id ?? "",
          roleAssignment: r.role_assignment ?? "Auditor",
          technicalExpert: r.technical_expert ?? "",
          observer: r.observer ?? "",
          trainee: r.trainee ?? "",
        }));
        plan.step2Data = plan.step2Data && typeof plan.step2Data === "object" ? { ...plan.step2Data, auditorResources } : { auditorResources };
      }
    });

    if (!plan) {
      return NextResponse.json({ error: "Audit plan not found" }, { status: 404 });
    }

    const userId = ctx.user.id;
    plan.currentUserRole =
      plan.leadAuditorUserId === userId
        ? "lead_auditor"
        : plan.auditeeUserId === userId
          ? "auditee"
          : plan.assignedAuditorIds?.includes(userId)
            ? "assigned_auditor"
            : null;

    return NextResponse.json({ plan });
  } catch (error) {
    console.error("Error fetching audit plan:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit plan" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/organization/[orgId]/audit/plans/[planId]
 * Update audit plan (e.g. status = findings_submitted_to_auditee when auditor submits from Step 3).
 * Body: { status: string }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; planId: string }> }
) {
  try {
    const { orgId, planId } = await params;
    const ctx = await getRequestContext(req, orgId);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connectionString = ctx.tenant.connectionString;
    if (!connectionString) {
      return NextResponse.json({ error: "Tenant database not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const status = body.status;
    const step4Data = body.step4Data;
    const step5Data = body.step5Data;
    const step6Data = body.step6Data;
    const step2Data = body.step2Data;
    const title = body.title ?? body.name ?? undefined;
    const auditNumber = body.auditNumber ?? body.audit_number ?? undefined;
    const criteria = body.criteria ?? undefined;
    const plannedDate = body.plannedDate ?? body.planned_date ?? undefined;
    const datePrepared = body.datePrepared ?? body.date_prepared ?? undefined;
    const assignedAuditorIds: string[] | undefined = Array.isArray(body.assignedAuditorIds)
      ? body.assignedAuditorIds
      : Array.isArray(body.assigned_auditor_ids)
        ? body.assigned_auditor_ids
        : undefined;

    const hasPlanUpdate = status !== undefined || step4Data !== undefined || step5Data !== undefined || step6Data !== undefined || step2Data !== undefined ||
      title !== undefined || auditNumber !== undefined || criteria !== undefined ||
      plannedDate !== undefined || datePrepared !== undefined || assignedAuditorIds !== undefined;

    if (!hasPlanUpdate) {
      return NextResponse.json({ error: "At least one update field is required" }, { status: 400 });
    }

    await withTenantConnection(connectionString, async (client) => {
      const tableCheck = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_plans'`
      );
      if (tableCheck.rows.length === 0) {
        throw new Error("audit_plans table does not exist");
      }

      if (status !== undefined || title !== undefined || auditNumber !== undefined || criteria !== undefined || plannedDate !== undefined || datePrepared !== undefined) {
        const updates: string[] = ["updated_at = now()"];
        const values: unknown[] = [];
        let idx = 1;
        if (status !== undefined) {
          updates.push(`status = $${idx++}`);
          values.push(status);
        }
        if (title !== undefined) {
          updates.push(`title = $${idx++}`);
          values.push(title);
        }
        if (auditNumber !== undefined) {
          updates.push(`audit_number = $${idx++}`);
          values.push(auditNumber);
        }
        if (criteria !== undefined) {
          updates.push(`criteria = $${idx++}`);
          values.push(criteria);
        }
        if (plannedDate !== undefined) {
          updates.push(`planned_date = $${idx++}`);
          values.push(typeof plannedDate === "string" ? plannedDate : (plannedDate as Date)?.toISOString?.()?.slice(0, 10) ?? null);
        }
        if (datePrepared !== undefined) {
          updates.push(`date_prepared = $${idx++}`);
          values.push(typeof datePrepared === "string" ? datePrepared : (datePrepared as Date)?.toISOString?.()?.slice(0, 10) ?? null);
        }
        if (status === "plan_submitted_to_auditee") {
          updates.push("plan_submitted_at = now()");
        }
        values.push(planId);
        await client.query(
          `UPDATE audit_plans SET ${updates.join(", ")} WHERE id = $${idx}`,
          values
        );
      }

      if (assignedAuditorIds !== undefined) {
        await client.query(`DELETE FROM audit_plan_assignments WHERE audit_plan_id = $1`, [planId]);
        for (const uid of assignedAuditorIds) {
          if (uid) {
            await client.query(
              `INSERT INTO audit_plan_assignments (audit_plan_id, user_id) VALUES ($1, $2) ON CONFLICT (audit_plan_id, user_id) DO NOTHING`,
              [planId, uid]
            );
          }
        }
      }

      if (step4Data !== undefined) {
        await client.query(
          `ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS step_4_data jsonb`
        );
        await client.query(
          `UPDATE audit_plans SET step_4_data = $1, updated_at = now() WHERE id = $2`,
          [JSON.stringify(step4Data), planId]
        );
      }

      if (step5Data !== undefined) {
        await client.query(
          `ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS step_5_data jsonb`
        );
        await client.query(
          `UPDATE audit_plans SET step_5_data = $1, updated_at = now() WHERE id = $2`,
          [JSON.stringify(step5Data), planId]
        );
      }

      if (step6Data !== undefined) {
        await client.query(
          `ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS step_6_data jsonb`
        );
        await client.query(
          `UPDATE audit_plans SET step_6_data = $1, updated_at = now() WHERE id = $2`,
          [JSON.stringify(step6Data), planId]
        );
      }

      if (step2Data !== undefined) {
        await client.query(
          `ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS step_2_data jsonb`
        );
        await client.query(
          `UPDATE audit_plans SET step_2_data = $1, updated_at = now() WHERE id = $2`,
          [JSON.stringify(step2Data), planId]
        );
      }

      if (step2Data !== undefined && typeof step2Data === "object") {
        await client.query(`
          CREATE TABLE IF NOT EXISTS audit_plan_amrc_rows (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            audit_plan_id uuid NOT NULL REFERENCES audit_plans(id) ON DELETE CASCADE,
            row_index int NOT NULL DEFAULT 0,
            review_category text,
            comments text,
            priority text NOT NULL DEFAULT 'MEDIUM',
            action text,
            created_at timestamptz DEFAULT now()
          )
        `);
        await client.query(
          `CREATE INDEX IF NOT EXISTS idx_audit_plan_amrc_rows_plan ON audit_plan_amrc_rows(audit_plan_id)`
        );

        const amrcRows = Array.isArray(step2Data.amrcRows) ? step2Data.amrcRows : [];
        await client.query(`DELETE FROM audit_plan_amrc_rows WHERE audit_plan_id = $1`, [planId]);
        for (let i = 0; i < amrcRows.length; i++) {
          const r = amrcRows[i] as { reviewCategory?: string; comments?: string; priority?: string; action?: string };
          await client.query(
            `INSERT INTO audit_plan_amrc_rows (audit_plan_id, row_index, review_category, comments, priority, action) VALUES ($1, $2, $3, $4, $5, $6)`,
            [planId, i, r.reviewCategory ?? null, r.comments ?? null, r.priority ?? "MEDIUM", r.action ?? null]
          );
        }

        await client.query(`
          CREATE TABLE IF NOT EXISTS audit_plan_auditor_resources (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            audit_plan_id uuid NOT NULL REFERENCES audit_plans(id) ON DELETE CASCADE,
            row_index int NOT NULL DEFAULT 0,
            user_id uuid,
            role_assignment text DEFAULT 'Auditor',
            technical_expert text,
            observer text,
            trainee text,
            created_at timestamptz DEFAULT now()
          )
        `);
        await client.query(
          `CREATE INDEX IF NOT EXISTS idx_audit_plan_auditor_resources_plan ON audit_plan_auditor_resources(audit_plan_id)`
        );

        const auditorResources = Array.isArray(step2Data.auditorResources) ? step2Data.auditorResources : [];
        await client.query(`DELETE FROM audit_plan_auditor_resources WHERE audit_plan_id = $1`, [planId]);
        const assignedIds: string[] = [];
        for (let i = 0; i < auditorResources.length; i++) {
          const r = auditorResources[i] as { auditorUserId?: string; auditorUin?: string; roleAssignment?: string; technicalExpert?: string; observer?: string; trainee?: string };
          const uid = r.auditorUserId ?? r.auditorUin ?? null;
          if (uid) assignedIds.push(uid);
          await client.query(
            `INSERT INTO audit_plan_auditor_resources (audit_plan_id, row_index, user_id, role_assignment, technical_expert, observer, trainee) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [planId, i, uid, r.roleAssignment ?? "Auditor", r.technicalExpert ?? null, r.observer ?? null, r.trainee ?? null]
          );
        }
        await client.query(`DELETE FROM audit_plan_assignments WHERE audit_plan_id = $1`, [planId]);
        for (const uid of assignedIds) {
          if (uid) {
            await client.query(
              `INSERT INTO audit_plan_assignments (audit_plan_id, user_id) VALUES ($1, $2) ON CONFLICT (audit_plan_id, user_id) DO NOTHING`,
              [planId, uid]
            );
          }
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update audit plan";
    console.error("Error updating audit plan:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
