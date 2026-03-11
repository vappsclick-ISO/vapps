import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { withTenantConnection } from "@/lib/db/connection-helper";

/**
 * GET /api/organization/[orgId]/audit/plans/next-number
 * Returns the next system-generated audit number (for display before plan is created).
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

    let nextAuditNumber = "1";

    await withTenantConnection(connectionString, async (client) => {
      const tableCheck = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_plans'`
      );
      if (tableCheck.rows.length === 0) return;

      const nextRes = await client.query<{ next: string }>(
        `SELECT (COUNT(*)::integer + 1)::text AS next FROM audit_plans`
      );
      nextAuditNumber = nextRes.rows[0]?.next ?? "1";
    });

    return NextResponse.json({ nextAuditNumber });
  } catch (error: unknown) {
    console.error("Error fetching next audit number:", error);
    return NextResponse.json(
      { error: (error as Error)?.message ?? "Failed to get next audit number" },
      { status: 500 }
    );
  }
}
