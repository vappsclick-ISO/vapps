import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { withTenantConnection } from "@/lib/db/connection-helper";

/**
 * GET /api/organization/[orgId]/audit/plans/upcoming
 * Returns all organization audit plans that are in progress (status != 'closed').
 * Visible to every org member. Used by dashboard "Upcoming Audits" card.
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

    const connectionString = ctx.tenant?.connectionString;
    if (!connectionString) {
      return NextResponse.json({ error: "Tenant database not found" }, { status: 404 });
    }

    const plans: { id: string; title: string | null; auditNumber: string | null; status: string; plannedDate: string | null }[] = [];

    await withTenantConnection(connectionString, async (client) => {
      const tableCheck = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_plans'`
      );
      if (tableCheck.rows.length === 0) return;

      const result = await client.query(
        `SELECT ap.id, ap.title, ap.audit_number, ap.status, ap.planned_date
         FROM audit_plans ap
         WHERE ap.status IS DISTINCT FROM 'closed'
         ORDER BY ap.planned_date ASC NULLS LAST, ap.created_at DESC
         LIMIT 20`
      );

      for (const row of result.rows) {
        plans.push({
          id: row.id,
          title: row.title ?? null,
          auditNumber: row.audit_number ?? null,
          status: row.status ?? "draft",
          plannedDate: row.planned_date ?? null,
        });
      }
    });

    return NextResponse.json({ plans });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching upcoming audit plans:", error);
    return NextResponse.json(
      { error: "Internal server error", message },
      { status: 500 }
    );
  }
}
