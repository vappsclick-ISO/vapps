import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { getTenantClient } from "@/lib/db/tenant-pool";
import { prisma } from "@/lib/prisma";
import { roleToLeadershipTier } from "@/lib/roles";

/**
 * GET /api/organization/[orgId]/notifications
 *
 * NOTIFICATION FLOW – When and what is shown
 * ------------------------------------------
 * 1. AUTH
 *    - User must be logged in and a member of the organization (orgId).
 *
 * 2. PROCESS ACTIVITIES (from activity_log)
 *    - Shown only for processes the user is allowed to see. Access is by role:
 *      - Top / Owner: all processes in the org.
 *      - Operational: processes in sites they are assigned to (site_users).
 *      - Support: only processes they are assigned to (process_users).
 *    - Events: issue created/updated/status_changed/assigned, sprint created,
 *      review submitted, verification completed, etc.
 *
 * 3. AUDIT ACTIVITIES (from audit_plans)
 *    - Shown for audit plans where the user is:
 *      - Lead auditor (lead_auditor_user_id), or
 *      - Auditee (auditee_user_id), or
 *      - Assigned auditor (in audit_plan_assignments).
 *    - Each plan appears as one notification with status (e.g. "Submitted to auditee",
 *      "Findings submitted", "Closed"). Sorted by last update.
 *
 * 4. MERGE & LIMIT
 *    - Process and audit items are merged, sorted by date (newest first).
 *    - Response is limited to `limit` (default 30, max 50).
 *
 * 5. DISMISSALS
 *    - UserNotificationDismissal (main DB) stores which activity IDs the user
 *      has dismissed. Those are returned as dismissedIds; client hides them.
 *      Audit items use id "audit-{planId}" so they can be dismissed too.
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

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { ownerId: true },
    });
    const userOrg = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: { userId: ctx.user.id, organizationId: orgId },
      },
      select: { role: true, leadershipTier: true },
    });
    const isOwner = org?.ownerId === ctx.user.id;
    const userRole = isOwner ? "owner" : (userOrg?.role || "member");
    const leadershipTier = userOrg?.leadershipTier || roleToLeadershipTier(userRole);
    const isTopLeadership = leadershipTier === "Top" || isOwner;
    const isOperationalLeadership = leadershipTier === "Operational";
    const isSupportLeadership = leadershipTier === "Support";

    const client = await getTenantClient(orgId);

    try {
      let allowedProcessIds: string[] = [];

      if (isTopLeadership) {
        const result = await client.query<{ id: string }>(
          `SELECT id FROM processes`
        );
        allowedProcessIds = result.rows.map((r) => r.id);
      } else if (isOperationalLeadership) {
        const siteRows = await client.query<{ site_id: string }>(
          `SELECT site_id::text as site_id FROM site_users WHERE user_id = $1`,
          [ctx.user.id]
        );
        const siteIds = siteRows.rows.map((r) => r.site_id);
        if (siteIds.length > 0) {
          const placeholders = siteIds.map((_, i) => `$${i + 1}`).join(", ");
          const processResult = await client.query<{ id: string }>(
            `SELECT id FROM processes WHERE "siteId"::text IN (${placeholders})`,
            siteIds
          );
          allowedProcessIds = processResult.rows.map((r) => r.id);
        }
      } else if (isSupportLeadership) {
        const processRows = await client.query<{ process_id: string }>(
          `SELECT process_id::text as process_id FROM process_users WHERE user_id = $1`,
          [ctx.user.id]
        );
        allowedProcessIds = processRows.rows.map((r) => r.process_id);
      }

      const processActivities: any[] = [];
      if (allowedProcessIds.length > 0) {
        const placeholders = allowedProcessIds.map((_, i) => `$${i + 1}`).join(", ");
        const activityResult = await client.query(
          `SELECT 
            id,
            "processId",
            "userId",
            "userName",
            "userEmail",
            action,
            "entityType",
            "entityId",
            "entityTitle",
            details,
            "createdAt"
          FROM activity_log
          WHERE "processId" IN (${placeholders})
          ORDER BY "createdAt" DESC
          LIMIT $${allowedProcessIds.length + 1}`,
          [...allowedProcessIds, limit]
        );
        processActivities.push(...activityResult.rows);
      }

      const auditActivities: any[] = [];
      try {
        const auditTableCheck = await client.query(
          `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_plans'`
        );
        if (auditTableCheck.rows.length > 0) {
          const auditResult = await client.query(
            `SELECT ap.id, ap.title, ap.audit_number, ap.status,
                    COALESCE(ap.updated_at, ap.plan_submitted_at, ap.created_at) as "createdAt"
             FROM audit_plans ap
             WHERE ap.lead_auditor_user_id = $1
                OR ap.auditee_user_id = $1
                OR EXISTS (SELECT 1 FROM audit_plan_assignments a WHERE a.audit_plan_id = ap.id AND a.user_id = $1)
             ORDER BY COALESCE(ap.updated_at, ap.plan_submitted_at, ap.created_at) DESC
             LIMIT 15`,
            [ctx.user.id]
          );
          for (const row of auditResult.rows) {
            const statusLabel =
              row.status === "plan_submitted_to_auditee"
                ? "Submitted to auditee"
                : row.status === "findings_submitted_to_auditee"
                  ? "Findings submitted"
                  : row.status === "ca_submitted_to_auditor"
                    ? "Corrective action submitted"
                    : row.status === "pending_closure"
                      ? "Pending closure"
                      : row.status === "closed"
                        ? "Closed"
                        : row.status || "Updated";
            auditActivities.push({
              id: `audit-${row.id}`,
              processId: null,
              userId: ctx.user.id,
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
      const activityIds = activities.map((a: { id: string }) => a.id);

      const dismissals = await prisma.userNotificationDismissal.findMany({
        where: {
          userId: ctx.user.id,
          organizationId: orgId,
          activityId: { in: activityIds },
        },
        select: { activityId: true },
      });
      type DismissalRow = (typeof dismissals)[number];
      const dismissedIds = dismissals.map((d: DismissalRow) => d.activityId);

      return NextResponse.json({
        activities,
        dismissedIds,
      });
    } catch (dbError: unknown) {
      const message = dbError instanceof Error ? dbError.message : "Unknown error";
      return NextResponse.json(
        { error: "Failed to fetch notifications", message },
        { status: 500 }
      );
    } finally {
      client.release();
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { error: "Internal server error", message },
      { status: 500 }
    );
  }
}
