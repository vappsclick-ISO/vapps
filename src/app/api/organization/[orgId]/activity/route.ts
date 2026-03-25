import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { getTenantClient } from "@/lib/db/tenant-pool";

/**
 * GET /api/organization/[orgId]/activity
 *
 * Returns recent activity for the **whole organization**.
 * Visible to every member of the org (no filtering by process/site access).
 * Used by the dashboard "Recent Activity" card.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "30", 10), 50);

    const ctx = await getRequestContext(req, orgId);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = await getTenantClient(orgId);

    try {
      // 1. All process activities (every process in the org) – no user/role filter
      const activityResult = await client.query(
        `SELECT 
          al.id,
          al."processId",
          al."userId",
          al."userName",
          al."userEmail",
          al.action,
          al."entityType",
          al."entityId",
          al."entityTitle",
          al.details,
          al."createdAt",
          p.name as "processName"
        FROM activity_log al
        LEFT JOIN processes p ON p.id = al."processId"
        ORDER BY al."createdAt" DESC
        LIMIT $1`,
        [limit]
      );
      const processActivities = activityResult.rows || [];

      // 2. All recent audit plan updates (whole org) – no user filter
      let auditActivities: any[] = [];
      try {
        const auditTableCheck = await client.query(
          `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_plans'`
        );
        if (auditTableCheck.rows.length > 0) {
          const auditResult = await client.query(
            `SELECT ap.id, ap.title, ap.audit_number, ap.status,
                    COALESCE(ap.updated_at, ap.plan_submitted_at, ap.created_at) as "createdAt"
             FROM audit_plans ap
             ORDER BY COALESCE(ap.updated_at, ap.plan_submitted_at, ap.created_at) DESC
             LIMIT 20`
          );
          for (const row of auditResult.rows) {
            const statusLabel =
              row.status === "plan_submitted_to_auditee"
                ? "Submitted to auditee"
                : row.status === "findings_submitted_to_auditee"
                  ? "Findings submitted"
                  : row.status === "ca_submitted_to_auditor"
                    ? "Corrective action submitted"
                    : row.status === "verification_ineffective"
                      ? "Returned to auditee"
                      : row.status === "pending_closure"
                        ? "Pending closure"
                        : row.status === "closed"
                          ? "Closed"
                          : row.status || "Updated";
            auditActivities.push({
              id: `audit-${row.id}`,
              processId: null,
              userId: null,
              userName: "Audit",
              userEmail: null,
              action: `audit_plan.${row.status || "updated"}`,
              entityType: "audit_plan",
              entityId: row.id,
              entityTitle: row.title || row.audit_number || "Audit plan",
              details: { status: row.status, statusLabel },
              createdAt: row.createdAt,
            });
          }
        }
      } catch {
        // Ignore if audit_plans missing or query fails
      }

      const merged = [...processActivities, ...auditActivities].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      const activities = merged.slice(0, limit);

      return NextResponse.json({ activities });
    } catch (dbError: unknown) {
      const message = dbError instanceof Error ? dbError.message : "Unknown error";
      return NextResponse.json(
        { error: "Failed to fetch activity", message },
        { status: 500 }
      );
    } finally {
      client.release();
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching organization activity:", error);
    return NextResponse.json(
      { error: "Internal server error", message },
      { status: 500 }
    );
  }
}
