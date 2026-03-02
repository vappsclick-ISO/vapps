import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { withTenantConnection } from "@/lib/db/connection-helper";

/**
 * GET /api/organization/[orgId]/audit/programs/[programId]
 * Get one audit program with sites, risks, schedule, KPIs, reviews.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; programId: string }> }
) {
  try {
    const { orgId, programId } = await params;
    const ctx = await getRequestContext(req, orgId);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connectionString = ctx.tenant.connectionString;
    if (!connectionString) {
      return NextResponse.json({ error: "Tenant database not found" }, { status: 404 });
    }

    let program: any = null;

    await withTenantConnection(connectionString, async (client) => {
      const tableCheck = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_programs'`
      );
      if (tableCheck.rows.length === 0) {
        return;
      }

      const progResult = await client.query(
        `SELECT ap.id, ap.name, ap.start_period, ap.end_period, ap.system_creation_date,
                ap.program_purpose, ap.audit_scope, ap.audit_type, ap.audit_criteria,
                ap.process_id, ap.program_owner_user_id, ap.lead_auditor_user_id,
                ap.created_at, ap.updated_at,
                p.name as process_name
         FROM audit_programs ap
         LEFT JOIN processes p ON p.id = ap.process_id
         WHERE ap.id = $1`,
        [programId]
      );
      const row = progResult.rows[0];
      if (!row) return;

      program = {
        id: row.id,
        name: row.name,
        startPeriod: row.start_period,
        endPeriod: row.end_period,
        systemCreationDate: row.system_creation_date,
        programPurpose: row.program_purpose,
        auditScope: row.audit_scope,
        auditType: row.audit_type,
        auditCriteria: row.audit_criteria,
        processId: row.process_id,
        processName: row.process_name,
        programOwnerUserId: row.program_owner_user_id,
        leadAuditorUserId: row.lead_auditor_user_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        siteIds: [] as string[],
        sites: [] as { id: string; name: string; code: string }[],
        risks: [],
        scheduleRows: [],
        kpis: [],
        reviewRows: [],
      };

      const sitesResult = await client.query(
        `SELECT s.id, s.name, s.code FROM audit_program_sites aps
         JOIN sites s ON s.id = aps.site_id WHERE aps.audit_program_id = $1`,
        [programId]
      );
      for (const r of sitesResult.rows) {
        program.siteIds.push(r.id);
        program.sites.push({ id: r.id, name: r.name, code: r.code });
      }

      const risksResult = await client.query(
        `SELECT rop_number, category, description, impact, impact_class, frequency, priority, priority_class
         FROM audit_program_risks WHERE audit_program_id = $1 ORDER BY rop_number`,
        [programId]
      );
      program.risks = risksResult.rows.map((r) => ({
        rop: r.rop_number,
        category: r.category,
        description: r.description,
        impact: r.impact,
        impactClass: r.impact_class,
        frequency: r.frequency,
        priority: r.priority,
        priorityClass: r.priority_class,
      }));

      const schedResult = await client.query(
        `SELECT audit_number, audit_type, focus, frequency, target_months, lead_auditor_name
         FROM audit_program_schedule WHERE audit_program_id = $1 ORDER BY audit_number`,
        [programId]
      );
      program.scheduleRows = schedResult.rows.map((r) => ({
        audit: r.audit_number,
        type: r.audit_type,
        focus: r.focus,
        frequency: r.frequency,
        months: r.target_months,
        lead: r.lead_auditor_name,
      }));

      const kpisResult = await client.query(
        `SELECT kpia_number, description, impact, score, priority, comments
         FROM audit_program_kpis WHERE audit_program_id = $1 ORDER BY kpia_number`,
        [programId]
      );
      program.kpis = kpisResult.rows.map((r) => ({
        kpi: r.kpia_number,
        description: r.description,
        impact: r.impact,
        score: r.score,
        priority: r.priority,
        comments: r.comments,
      }));

      const revResult = await client.query(
        `SELECT pri_number, review_type, comments, priority, priority_class, action
         FROM audit_program_reviews WHERE audit_program_id = $1 ORDER BY pri_number`,
        [programId]
      );
      program.reviewRows = revResult.rows.map((r) => ({
        pri: r.pri_number,
        type: r.review_type,
        comments: r.comments,
        priority: r.priority,
        priorityClass: r.priority_class,
        action: r.action,
      }));
    });

    if (!program) {
      return NextResponse.json({ error: "Audit program not found" }, { status: 404 });
    }
    return NextResponse.json({ program });
  } catch (error: unknown) {
    console.error("Error fetching audit program:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit program" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/organization/[orgId]/audit/programs/[programId]
 * Update an audit program (replace sites, risks, schedule, KPIs, reviews).
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; programId: string }> }
) {
  try {
    const { orgId, programId } = await params;
    const ctx = await getRequestContext(req, orgId);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connectionString = ctx.tenant.connectionString;
    if (!connectionString) {
      return NextResponse.json({ error: "Tenant database not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const startPeriod = body.startPeriod ?? body.start_period;
    const endPeriod = body.endPeriod ?? body.end_period;
    const systemCreationDate = body.systemCreationDate ?? body.system_creation_date;
    const programPurpose = body.programPurpose ?? body.program_purpose ?? null;
    const auditScope = body.auditScope ?? body.audit_scope ?? null;
    const auditType = body.auditType ?? body.audit_type ?? null;
    const auditCriteria = body.auditCriteria ?? body.audit_criteria ?? null;
    const processId = body.processId ?? body.process_id;
    const programOwnerUserId = body.programOwnerUserId ?? body.program_owner_user_id;
    const leadAuditorUserId = body.leadAuditorUserId ?? body.lead_auditor_user_id;
    const siteIds: string[] = Array.isArray(body.siteIds) ? body.siteIds : Array.isArray(body.site_ids) ? body.site_ids : [];
    const risks: any[] = Array.isArray(body.risks) ? body.risks : [];
    const scheduleRows: any[] = Array.isArray(body.scheduleRows) ? body.scheduleRows : Array.isArray(body.schedule_rows) ? body.schedule_rows : [];
    const kpis: any[] = Array.isArray(body.kpis) ? body.kpis : [];
    const reviewRows: any[] = Array.isArray(body.reviewRows) ? body.reviewRows : Array.isArray(body.review_rows) ? body.review_rows : [];

    await withTenantConnection(connectionString, async (client) => {
      const tableCheck = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_programs'`
      );
      if (tableCheck.rows.length === 0) {
        throw new Error("Audit programs table does not exist. Run tenant migration 013.");
      }

      const startDate = startPeriod ? (typeof startPeriod === "string" ? startPeriod : (startPeriod as Date)?.toISOString?.()?.slice(0, 10)) : null;
      const endDate = endPeriod ? (typeof endPeriod === "string" ? endPeriod : (endPeriod as Date)?.toISOString?.()?.slice(0, 10)) : null;
      const sysDate = systemCreationDate
        ? (typeof systemCreationDate === "string" ? systemCreationDate : (systemCreationDate as Date)?.toISOString?.()?.slice(0, 10))
        : null;

      await client.query(
        `UPDATE audit_programs SET
          name = COALESCE($2, name),
          start_period = COALESCE($3, start_period),
          end_period = COALESCE($4, end_period),
          system_creation_date = COALESCE($5, system_creation_date),
          program_purpose = COALESCE($6, program_purpose),
          audit_scope = COALESCE($7, audit_scope),
          audit_type = COALESCE($8, audit_type),
          audit_criteria = COALESCE($9, audit_criteria),
          process_id = COALESCE($10, process_id),
          program_owner_user_id = COALESCE($11, program_owner_user_id),
          lead_auditor_user_id = COALESCE($12, lead_auditor_user_id),
          updated_at = now()
         WHERE id = $1`,
        [
          programId,
          body.name ?? null,
          startDate,
          endDate,
          sysDate,
          programPurpose,
          auditScope,
          auditType,
          auditCriteria,
          processId ?? null,
          programOwnerUserId ?? null,
          leadAuditorUserId ?? null,
        ]
      );

      await client.query(`DELETE FROM audit_program_sites WHERE audit_program_id = $1`, [programId]);
      for (const siteId of siteIds) {
        if (siteId) {
          await client.query(
            `INSERT INTO audit_program_sites (audit_program_id, site_id) VALUES ($1, $2) ON CONFLICT (audit_program_id, site_id) DO NOTHING`,
            [programId, siteId]
          );
        }
      }

      await client.query(`DELETE FROM audit_program_risks WHERE audit_program_id = $1`, [programId]);
      for (const r of risks) {
        await client.query(
          `INSERT INTO audit_program_risks (audit_program_id, rop_number, category, description, impact, impact_class, frequency, priority, priority_class)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            programId,
            r.rop ?? r.rop_number ?? "",
            r.category ?? null,
            r.description ?? null,
            r.impact ?? null,
            r.impactClass ?? r.impact_class ?? null,
            r.frequency ?? null,
            r.priority ?? null,
            r.priorityClass ?? r.priority_class ?? null,
          ]
        );
      }

      await client.query(`DELETE FROM audit_program_schedule WHERE audit_program_id = $1`, [programId]);
      for (const row of scheduleRows) {
        await client.query(
          `INSERT INTO audit_program_schedule (audit_program_id, audit_number, audit_type, focus, frequency, target_months, lead_auditor_name)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            programId,
            row.audit ?? row.audit_number ?? "",
            row.type ?? row.audit_type ?? null,
            row.focus ?? null,
            row.frequency ?? null,
            row.months ?? row.target_months ?? null,
            row.lead ?? row.lead_auditor_name ?? null,
          ]
        );
      }

      await client.query(`DELETE FROM audit_program_kpis WHERE audit_program_id = $1`, [programId]);
      for (const k of kpis) {
        await client.query(
          `INSERT INTO audit_program_kpis (audit_program_id, kpia_number, description, impact, score, priority, comments)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            programId,
            k.kpi ?? k.kpia_number ?? "",
            k.description ?? null,
            k.impact ?? null,
            k.score ?? null,
            k.priority ?? null,
            k.comments ?? null,
          ]
        );
      }

      await client.query(`DELETE FROM audit_program_reviews WHERE audit_program_id = $1`, [programId]);
      for (const r of reviewRows) {
        await client.query(
          `INSERT INTO audit_program_reviews (audit_program_id, pri_number, review_type, comments, priority, priority_class, action)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            programId,
            r.pri ?? r.pri_number ?? "",
            r.type ?? r.review_type ?? null,
            r.comments ?? null,
            r.priority ?? null,
            r.priorityClass ?? r.priority_class ?? null,
            r.action ?? null,
          ]
        );
      }
    });

    return NextResponse.json({ programId, success: true });
  } catch (error: unknown) {
    console.error("Error updating audit program:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update audit program" },
      { status: 500 }
    );
  }
}
