import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { queryTenant, getTenantClient } from "@/lib/db/tenant-pool";
import { logActivity } from "@/lib/activity-logger";
import { prisma } from "@/lib/prisma";
import { roleToLeadershipTier } from "@/lib/roles";
import crypto from "crypto";

/**
 * GET /api/organization/[orgId]/processes/[processId]/sprints
 * Get all sprints for a process
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
              { error: "You can only view sprints for sites you are assigned to." },
              { status: 403 }
            );
          }
        } else if (isSupportLeadership) {
          // For Support, check if they have access to this process
          // processes.id is TEXT, process_users.process_id is UUID - cast UUID to TEXT for comparison
          const processAccessResult = await client.query(
            `SELECT 1 FROM process_users WHERE user_id = $1 AND process_id::text = $2`,
            [ctx.user.id, processId]
          );
          if (processAccessResult.rows.length === 0) {
            client.release();
            return NextResponse.json(
              { error: "You can only view sprints for the process you are assigned to." },
              { status: 403 }
            );
          }
        } else {
          client.release();
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }

      // Get all sprints for this process with their issues
      const sprintsResult = await client.query(
        `SELECT 
          s.id,
          s.name,
          s."startDate",
          s."endDate",
          s."processId",
          s."createdAt",
          s."updatedAt"
        FROM sprints s
        WHERE s."processId" = $1
        ORDER BY s."startDate" ASC`,
        [processId]
      );

      // Get issues for each sprint
      const sprintsWithIssues = await Promise.all(
        sprintsResult.rows.map(async (sprint: any) => {
          const issuesResult = await client.query(
            `SELECT 
              i.id,
              i.title,
              i.description,
              i.priority,
              i.status,
              i.points,
              i.assignee,
              i.tags,
              i.source,
              i."sprintId",
              i."processId",
              i."order",
              i."createdAt",
              i."updatedAt"
            FROM issues i
            WHERE i."sprintId" = $1 AND i.status != 'done'
            ORDER BY i."order" ASC, i."createdAt" ASC`,
            [sprint.id]
          );

          return {
            ...sprint,
            issues: issuesResult.rows,
          };
        })
      );

      client.release();

      return NextResponse.json({
        sprints: sprintsWithIssues,
      });
    } catch (dbError: any) {
      client.release();
      return NextResponse.json(
        { error: "Failed to fetch sprints", message: dbError.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error fetching sprints:", error);
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/organization/[orgId]/processes/[processId]/sprints
 * Create a new sprint
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; processId: string }> }
) {
  try {
    const { orgId, processId } = await params;
    const body = await req.json();
    const { name, startDate, endDate } = body;

    // Get request context (user + tenant) - single call, cached
    const ctx = await getRequestContext(req, orgId);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Sprint name is required" },
        { status: 400 }
      );
    }

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Start date and end date are required" },
        { status: 400 }
      );
    }

    // Use tenant pool instead of new Client()
    const client = await getTenantClient(orgId);

    try {

      // Verify process exists
      const processResult = await client.query(
        `SELECT id FROM processes WHERE id = $1`,
        [processId]
      );

      if (processResult.rows.length === 0) {
        client.release();
        return NextResponse.json(
          { error: "Process not found" },
          { status: 404 }
        );
      }

      // Insert new sprint
      const sprintId = crypto.randomUUID();
      await client.query(
        `INSERT INTO sprints (id, name, "startDate", "endDate", "processId", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [sprintId, name.trim(), startDate, endDate, processId]
      );

      // Fetch the created sprint
      const sprintResult = await client.query(
        `SELECT 
          s.id,
          s.name,
          s."startDate",
          s."endDate",
          s."processId",
          s."createdAt",
          s."updatedAt"
        FROM sprints s
        WHERE s.id = $1`,
        [sprintId]
      );

      const createdSprint = sprintResult.rows[0];
      client.release();

      // Log activity (non-blocking)
      if (ctx.user?.id) {
        logActivity(orgId, processId, ctx.user.id, {
          action: "sprint.created",
          entityType: "sprint",
          entityId: createdSprint.id,
          entityTitle: createdSprint.name,
          details: {
            startDate: createdSprint.startDate,
            endDate: createdSprint.endDate,
          },
        }).catch((err) => console.error("[Sprint Create] Failed to log activity:", err));
      }

      return NextResponse.json(
        {
          message: "Sprint created successfully",
          sprint: {
            ...createdSprint,
            issues: [],
          },
        },
        { status: 201 }
      );
    } catch (dbError: any) {
      client.release();
      return NextResponse.json(
        { error: "Failed to create sprint", message: dbError.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error creating sprint:", error);
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}
