import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { getTenantClient } from "@/lib/db/tenant-pool";

/**
 * GET /api/organization/[orgId]/dashboard-stats
 * Returns organization-wide stats for the dashboard top cards.
 * Same data for every org member.
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

    const client = await getTenantClient(orgId);

    try {
      let processCount = 0;
      let openIssuesCount = 0;
      let upcomingAuditsCount = 0;
      let complianceScore: number | null = null;

      const processResult = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM processes`
      );
      processCount = parseInt(processResult.rows[0]?.count ?? "0", 10);

      try {
        const issuesResult = await client.query<{ count: string }>(
          `SELECT COUNT(*)::text as count FROM issues WHERE status IS DISTINCT FROM 'done'`
        );
        openIssuesCount = parseInt(issuesResult.rows[0]?.count ?? "0", 10);
      } catch {
        // issues table may not exist in some tenants
      }

      try {
        const auditTableCheck = await client.query(
          `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_plans'`
        );
        if (auditTableCheck.rows.length > 0) {
          const upcomingResult = await client.query<{ count: string }>(
            `SELECT COUNT(*)::text as count FROM audit_plans WHERE status IS DISTINCT FROM 'closed'`
          );
          upcomingAuditsCount = parseInt(upcomingResult.rows[0]?.count ?? "0", 10);

          const totalResult = await client.query<{ total: string; closed: string }>(
            `SELECT 
               COUNT(*)::text as total, 
               COUNT(*) FILTER (WHERE status = 'closed')::text as closed 
             FROM audit_plans`
          );
          const total = parseInt(totalResult.rows[0]?.total ?? "0", 10);
          const closed = parseInt(totalResult.rows[0]?.closed ?? "0", 10);
          if (total > 0) {
            complianceScore = Math.round((closed / total) * 100);
          }
        }
      } catch {
        // audit_plans may not exist
      }

      if (complianceScore === null) {
        try {
          const totalIssuesResult = await client.query<{ total: string; done: string }>(
            `SELECT 
               COUNT(*)::text as total, 
               COUNT(*) FILTER (WHERE status = 'done')::text as done 
             FROM issues`
          );
          const total = parseInt(totalIssuesResult.rows[0]?.total ?? "0", 10);
          const done = parseInt(totalIssuesResult.rows[0]?.done ?? "0", 10);
          if (total > 0) {
            complianceScore = Math.round((done / total) * 100);
          }
        } catch {
          // fallback: no score
        }
      }

      return NextResponse.json({
        processCount,
        openIssuesCount,
        upcomingAuditsCount,
        complianceScore: complianceScore ?? 0,
      });
    } catch (dbError: unknown) {
      const message = dbError instanceof Error ? dbError.message : "Unknown error";
      return NextResponse.json(
        { error: "Failed to fetch dashboard stats", message },
        { status: 500 }
      );
    } finally {
      client.release();
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Internal server error", message },
      { status: 500 }
    );
  }
}
