import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { withTenantConnection } from "@/lib/db/connection-helper";

/**
 * GET /api/organization/[orgId]/audit/programs
 * List audit programs. Query: ?latest=1 to return only the most recent one.
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

    const { searchParams } = new URL(req.url);
    const latestOnly = searchParams.get("latest") === "1";

    const programs: any[] = [];

    try {
      await withTenantConnection(connectionString, async (client) => {
        const tableCheck = await client.query(
          `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_programs'`
        );
        if (tableCheck.rows.length === 0) {
          return;
        }

        const orderClause = " ORDER BY ap.created_at DESC";
        const limitClause = latestOnly ? " LIMIT 1" : "";

        const result = await client.query(
          `SELECT ap.id, ap.name, ap.start_period, ap.end_period, ap.system_creation_date,
                  ap.program_purpose, ap.audit_scope, ap.audit_type, ap.audit_criteria,
                  ap.process_id, ap.program_owner_user_id, ap.lead_auditor_user_id,
                  ap.created_at, ap.updated_at,
                  p.name as process_name,
                  s.id as site_id, s.name as site_name, s.code as site_code
          FROM audit_programs ap
          LEFT JOIN processes p ON p.id = ap.process_id
          LEFT JOIN audit_program_sites aps ON aps.audit_program_id = ap.id
          LEFT JOIN sites s ON s.id = aps.site_id
          ${orderClause} ${limitClause}`
        );

        const byId = new Map<string, any>();
        for (const row of result.rows) {
          const id = row.id;
          if (!byId.has(id)) {
            byId.set(id, {
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
            });
          }
          const prog = byId.get(id)!;
          if (row.site_id && !prog.siteIds.includes(row.site_id)) {
            prog.siteIds.push(row.site_id);
            prog.sites.push({ id: row.site_id, name: row.site_name, code: row.site_code });
          }
        }
        programs.push(...Array.from(byId.values()));
      });
    } catch (e) {
      console.warn("Audit programs table may not exist yet", e);
    }

    if (latestOnly && programs.length > 0) {
      return NextResponse.json({ program: programs[0] });
    }
    return NextResponse.json({ programs });
  } catch (error: unknown) {
    console.error("Error fetching audit programs:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit programs" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/organization/[orgId]/audit/programs
 * Create a new audit program (Step 1).
 * Body: startPeriod, endPeriod, systemCreationDate?, programPurpose, auditScope, auditType, auditCriteria,
 *       processId, programOwnerUserId (= Auditee / Program Responsible Person), leadAuditorUserId, siteIds[], risks[], scheduleRows[], kpis[], reviewRows[]
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
    const startPeriod = body.startPeriod ?? body.start_period;
    const endPeriod = body.endPeriod ?? body.end_period;
    const systemCreationDate = body.systemCreationDate ?? body.system_creation_date;
    const programPurpose = body.programPurpose ?? body.program_purpose ?? null;
    const auditScope = body.auditScope ?? body.audit_scope ?? null;
    const auditType = body.auditType ?? body.audit_type ?? null;
    const auditCriteria = body.auditCriteria ?? body.audit_criteria ?? null;
    const processId = body.processId ?? body.process_id;
    const programOwnerUserId = body.programOwnerUserId ?? body.program_owner_user_id;
    const leadAuditorUserId = body.leadAuditorUserId ?? body.lead_auditor_user_id ?? ctx.user.id;
    const siteIds: string[] = Array.isArray(body.siteIds) ? body.siteIds : Array.isArray(body.site_ids) ? body.site_ids : [];
    const risks: any[] = Array.isArray(body.risks) ? body.risks : [];
    const scheduleRows: any[] = Array.isArray(body.scheduleRows) ? body.scheduleRows : Array.isArray(body.schedule_rows) ? body.schedule_rows : [];
    const kpis: any[] = Array.isArray(body.kpis) ? body.kpis : [];
    const reviewRows: any[] = Array.isArray(body.reviewRows) ? body.reviewRows : Array.isArray(body.review_rows) ? body.review_rows : [];

    if (!startPeriod || !endPeriod || !processId || !programOwnerUserId) {
      return NextResponse.json(
        { error: "startPeriod, endPeriod, processId, and programOwnerUserId are required" },
        { status: 400 }
      );
    }

    let programId: string | null = null;

    await withTenantConnection(connectionString, async (client) => {
      const tableCheck = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_programs'`
      );
      if (tableCheck.rows.length === 0) {
        throw new Error("Audit programs table does not exist. Run tenant migration 013.");
      }

      const startDate = typeof startPeriod === "string" ? startPeriod : (startPeriod as Date)?.toISOString?.()?.slice(0, 10);
      const endDate = typeof endPeriod === "string" ? endPeriod : (endPeriod as Date)?.toISOString?.()?.slice(0, 10);
      // System creation date is set automatically when the program is created (not user-editable).
      const sysDate = new Date().toISOString().slice(0, 10);

      const insertProgram = await client.query(
        `INSERT INTO audit_programs (
          name, start_period, end_period, system_creation_date,
          program_purpose, audit_scope, audit_type, audit_criteria,
          process_id, program_owner_user_id, lead_auditor_user_id, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id`,
        [
          body.name || null,
          startDate,
          endDate,
          sysDate,
          programPurpose,
          auditScope,
          auditType,
          auditCriteria,
          processId,
          programOwnerUserId,
          leadAuditorUserId,
          ctx.user.id,
        ]
      );
      programId = insertProgram.rows[0]?.id;

      if (!programId) throw new Error("Failed to create audit program");

      for (const siteId of siteIds) {
        if (siteId) {
          await client.query(
            `INSERT INTO audit_program_sites (audit_program_id, site_id) VALUES ($1, $2) ON CONFLICT (audit_program_id, site_id) DO NOTHING`,
            [programId, siteId]
          );
        }
      }

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
    console.error("Error creating audit program:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create audit program" },
      { status: 500 }
    );
  }
}
