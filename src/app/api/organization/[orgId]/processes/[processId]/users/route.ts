import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { getTenantClient } from "@/lib/db/tenant-pool";
import { prisma } from "@/lib/prisma";
import { roleToLeadershipTier } from "@/lib/roles";

/**
 * GET /api/organization/[orgId]/processes/[processId]/users
 * Get all users who are members of this process (accepted invites)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; processId: string }> }
) {
  try {
    const { orgId, processId } = await params;

    // Get request context (user + tenant) - single call, cached
    const ctx = await getRequestContext(req, orgId);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use tenant pool instead of new Client()
    const client = await getTenantClient(orgId);

    try {
      // Verify process exists and get siteId for access check
      const processResult = await client.query(
        `SELECT id, "siteId" FROM processes WHERE id = $1`,
        [processId]
      );

      if (processResult.rows.length === 0) {
        client.release();
        return NextResponse.json(
          { error: "Process not found" },
          { status: 404 }
        );
      }

      const processSiteId = processResult.rows[0].siteId;

      // Access control by leadership tier
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { ownerId: true },
      });
      const userOrg = await prisma.userOrganization.findUnique({
        where: {
          userId_organizationId: {
            userId: ctx.user.id,
            organizationId: orgId,
          },
        },
        select: { role: true, leadershipTier: true },
      });
      const isOwner = org?.ownerId === ctx.user.id;
      const userRole = isOwner ? "owner" : (userOrg?.role || "member");
      const leadershipTier = userOrg?.leadershipTier || roleToLeadershipTier(userRole);
      const isTopLeadership = leadershipTier === "Top" || isOwner;
      const isOperationalLeadership = leadershipTier === "Operational";
      const isSupportLeadership = leadershipTier === "Support";

      if (!isTopLeadership) {
        if (isOperationalLeadership) {
          const siteAccessResult = await client.query(
            `SELECT 1 FROM site_users WHERE user_id = $1 AND site_id = $2::text::uuid`,
            [ctx.user.id, processSiteId]
          );
          if (siteAccessResult.rows.length === 0) {
            client.release();
            return NextResponse.json(
              { error: "You can only view users for sites you are assigned to." },
              { status: 403 }
            );
          }
        } else if (isSupportLeadership) {
          // For Support, check if they have access to this process
          // processes.id is TEXT, process_users.process_id is UUID - need to cast
          const processAccessResult = await client.query(
            `SELECT 1 FROM process_users WHERE user_id = $1 AND process_id::text = $2`,
            [ctx.user.id, processId]
          );
          if (processAccessResult.rows.length === 0) {
            client.release();
            return NextResponse.json(
              { error: "You can only view users for the process you are assigned to." },
              { status: 403 }
            );
          }
        } else {
          client.release();
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }

      // Get all users for this process from process_users table
      // Join with master DB User table to get user details (name, email)
      // processes.id is TEXT, process_users.process_id is UUID - cast UUID to TEXT for comparison
      const result = await client.query(
        `
        SELECT 
          pu.user_id,
          pu.role as process_role,
          pu.added_at
        FROM process_users pu
        WHERE pu.process_id::text = $1
        ORDER BY pu.added_at ASC
        `,
        [processId]
      );

      // Get user details from master database
      const userIds = result.rows.map((row: any) => row.user_id);
      
      if (userIds.length === 0) {
        client.release();
        return NextResponse.json({ users: [] });
      }

      // Fetch user details from master DB
      const users = await prisma.user.findMany({
        where: {
          id: { in: userIds },
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      // Combine tenant and master data
      const usersWithRoles = users.map((user) => {
        const processUser = result.rows.find((row: any) => row.user_id === user.id);
        return {
          id: user.id,
          name: user.name || user.email,
          email: user.email,
          role: processUser?.process_role || "member",
        };
      });

      client.release();

      return NextResponse.json({ users: usersWithRoles });
    } catch (dbError: any) {
      client.release();
      return NextResponse.json(
        { error: "Failed to fetch process users", message: dbError.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error fetching process users:", error);
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}
