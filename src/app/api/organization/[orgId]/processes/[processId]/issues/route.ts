import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { queryTenant, getTenantClient } from "@/lib/db/tenant-pool";
import { logActivity } from "@/lib/activity-logger";
import { prisma } from "@/lib/prisma";
import { roleToLeadershipTier } from "@/lib/roles";
import crypto from "crypto";

/**
 * GET /api/organization/[orgId]/processes/[processId]/issues
 * Get all issues for a process (optionally filtered by sprintId)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; processId: string }> }
) {
  try {
    const { orgId, processId } = await params;
    const { searchParams } = new URL(req.url);
    const sprintIdParam = searchParams.get("sprintId");
    // If sprintId is not in query params, it's undefined (not null)
    // null means explicitly requesting backlog, undefined means get all
    const sprintId = searchParams.has("sprintId") ? sprintIdParam : undefined;

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

      // Access control by leadership tier:
      // Top = all; Operational = assigned site(s) only; Support = assigned process only
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

      if (isTopLeadership) {
        // Top: access to all issues, processes, and sites — no further check
      } else if (isOperationalLeadership) {
        const siteAccessResult = await client.query(
          `SELECT 1 FROM site_users WHERE user_id = $1 AND site_id = $2::text::uuid`,
          [ctx.user.id, processSiteId]
        );
        if (siteAccessResult.rows.length === 0) {
          client.release();
          return NextResponse.json(
            { error: "You can only view and manage issues for sites you are assigned to." },
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
            { error: "You can only view and manage issues for the process you are assigned to." },
            { status: 403 }
          );
        }
      } else {
        client.release();
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      // Get issues, optionally filtered by sprintId
      // Rule: Backlog issues = status="to-do" AND sprintId IS NULL
      let issuesQuery = `
        SELECT 
          i.id,
          i.title,
          i.description,
          i.priority,
          i.status,
          i.points,
          i.assignee,
          i.issuer,
          i.verifier,
          i.tags,
          i.source,
          i."sprintId",
          i."processId",
          i."order",
          i."createdAt",
          i."updatedAt",
          i."deadline"
        FROM issues i
        WHERE i."processId" = $1
      `;

      const queryParams: string[] = [processId];
      if (sprintId === null || sprintId === "null") {
        // Get backlog issues: status="to-do" AND sprintId IS NULL
        issuesQuery += ` AND i.status = 'to-do' AND i."sprintId" IS NULL`;
      } else if (sprintId) {
        // Get issues for specific sprint (exclude "done" status)
        issuesQuery += ` AND i."sprintId" = $2 AND i.status != 'done'`;
        queryParams.push(sprintId);
      } else {
        // Get all issues (including sprint issues) - no additional filter
        // This allows board to show all tasks regardless of sprint or status
        // Board will handle filtering by status in the UI
      }

      issuesQuery += ` ORDER BY i."order" ASC, i."createdAt" ASC`;

      let issuesResult;
      try {
        issuesResult = await client.query(
          issuesQuery,
          queryParams.length > 1 ? queryParams : [queryParams[0]]
        );
      } catch (queryErr: any) {
        // Handle missing columns: add issuer/verifier if missing, then retry
        if (queryErr?.code === "42703") {
          await client.query(
            `ALTER TABLE "issues" ADD COLUMN IF NOT EXISTS "issuer" TEXT, ADD COLUMN IF NOT EXISTS "verifier" TEXT`
          );
          try {
            issuesResult = await client.query(
              issuesQuery,
              queryParams.length > 1 ? queryParams : [queryParams[0]]
            );
          } catch (retryErr: any) {
            if (retryErr?.code === "42703") {
              const fallbackQuery = issuesQuery
                .replace(/,?\s*i\.issuer\s*/i, " ")
                .replace(/,?\s*i\.verifier\s*/i, " ")
                .replace(/,?\s*i\."deadline"\s*/i, " ");
              issuesResult = await client.query(
                fallbackQuery,
                queryParams.length > 1 ? queryParams : [queryParams[0]]
              );
              issuesResult.rows = issuesResult.rows.map((r: any) => ({
                ...r,
                issuer: r.issuer ?? null,
                verifier: r.verifier ?? null,
                deadline: r.deadline ?? null,
              }));
            } else {
              throw retryErr;
            }
          }
        } else {
          throw queryErr;
        }
      }

      client.release();

      // Normalize issuer to string so client comparison with session user id is reliable
      const issues = issuesResult.rows.map((r: Record<string, unknown>) => ({
        ...r,
        issuer: r.issuer != null ? String(r.issuer) : null,
      }));

      return NextResponse.json({
        issues,
      });
    } catch (dbError: any) {
      client.release();
      return NextResponse.json(
        { error: "Failed to fetch issues", message: dbError.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error fetching issues:", error);
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/organization/[orgId]/processes/[processId]/issues
 * Create a new issue
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; processId: string }> }
) {
  try {
    const { orgId, processId } = await params;
    const body = await req.json();
    const { title, tag, source, description, priority, status, points, assignee, tags, sprintId, order, deadline } = body;

    // Get request context (user + tenant) - single call, cached
    const ctx = await getRequestContext(req, orgId);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate mandatory fields
    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: "Issue title is required" },
        { status: 400 }
      );
    }

    if (!tag || !tag.trim()) {
      return NextResponse.json(
        { error: "Issue tag is required" },
        { status: 400 }
      );
    }

    if (!source || !source.trim()) {
      return NextResponse.json(
        { error: "Issue source is required" },
        { status: 400 }
      );
    }

    // Validate assignee is mandatory
    if (!assignee || !assignee.trim()) {
      return NextResponse.json(
        { error: "Assignee is required" },
        { status: 400 }
      );
    }

    // Get user's leadership tier and role from UserOrganization
    const userOrg = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId: ctx.user.id,
          organizationId: orgId,
        },
      },
      select: {
        role: true,
        leadershipTier: true,
      },
    });

    // Check if user is organization owner (Top leadership)
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { ownerId: true },
    });

    const isOwner = org?.ownerId === ctx.user.id;
    const userRole = isOwner ? "owner" : (userOrg?.role || "member");
    const leadershipTier = userOrg?.leadershipTier || roleToLeadershipTier(userRole);
    const isTopLeadership = leadershipTier === "Top" || isOwner;
    const isOperationalLeadership = leadershipTier === "Operational";
    const isSupportLeadership = leadershipTier === "Support";

    // Permission check: Only Top and Operational leadership can create issues
    if (isSupportLeadership) {
      return NextResponse.json(
        { error: "Support leadership cannot create issues. They can only be assigned to tasks." },
        { status: 403 }
      );
    }

    // Use tenant pool instead of new Client()
    const client = await getTenantClient(orgId);

    try {

      // Verify process exists and get its site
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

      // Operational leadership: verify they have access to this site
      if (isOperationalLeadership) {
        const siteAccessResult = await client.query(
          `SELECT user_id FROM site_users WHERE user_id = $1 AND site_id = $2::text::uuid`,
          [ctx.user.id, processSiteId]
        );

        if (siteAccessResult.rows.length === 0) {
          client.release();
          return NextResponse.json(
            { error: "You can only create issues for sites you are assigned to." },
            { status: 403 }
          );
        }
      }

      // Apply business rules for status and sprint assignment
      let finalSprintId: string | null = sprintId || null;
      let finalStatus: string;

      // Rule: If sprint is selected, status must be "in-progress"
      if (finalSprintId) {
        // Verify sprint exists and belongs to this process
        const sprintResult = await client.query(
          `SELECT id FROM sprints WHERE id = $1 AND "processId" = $2`,
          [finalSprintId, processId]
        );

        if (sprintResult.rows.length === 0) {
          client.release();
          return NextResponse.json(
            { error: "Sprint not found or doesn't belong to this process" },
            { status: 404 }
          );
        }

        // Rule: Issue in sprint must be "in-progress"
        finalStatus = "in-progress";
      } else {
        // Rule: No sprint selected → status = "to-do", sprintId = null (backlog)
        finalStatus = status || "to-do";
        finalSprintId = null;
      }

      // Prepare tags array (tag is mandatory, but tags array can have multiple)
      const tagsArray = tags && Array.isArray(tags) ? tags : [tag.trim()];

      // Insert new issue (deadline optional; column may not exist in older tenant DBs)
      // issuer is set to current user (Top or Operational leadership)
      const issueId = crypto.randomUUID();
      const deadlineVal = deadline != null && deadline !== "" ? new Date(deadline).toISOString() : null;
      try {
        await client.query(
          `INSERT INTO issues (id, title, description, priority, status, points, assignee, tags, source, "sprintId", "processId", "order", "deadline", issuer, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())`,
          [
            issueId,
            title.trim(),
            description?.trim() || null,
            priority || "medium",
            finalStatus,
            points || 0,
            assignee || null,
            tagsArray,
            source.trim(),
            finalSprintId,
            processId,
            order || 0,
            deadlineVal,
            ctx.user.id, // issuer: user who created the issue
          ]
        );
      } catch (insertErr: any) {
        // Handle missing columns gracefully (backward compatibility)
        if (insertErr?.code === "42703") {
          const missingColumn = insertErr.message?.includes("issuer") ? "issuer" :
                               insertErr.message?.includes("deadline") ? "deadline" : null;
          
          if (missingColumn === "issuer") {
            // Add issuer (and verifier) column if missing (e.g. tenant created before migration 011)
            await client.query(
              `ALTER TABLE "issues" ADD COLUMN IF NOT EXISTS "issuer" TEXT, ADD COLUMN IF NOT EXISTS "verifier" TEXT`
            );
            // Retry full INSERT with issuer so the creator is recorded
            await client.query(
              `INSERT INTO issues (id, title, description, priority, status, points, assignee, tags, source, "sprintId", "processId", "order", "deadline", issuer, "createdAt", "updatedAt")
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())`,
              [
                issueId,
                title.trim(),
                description?.trim() || null,
                priority || "medium",
                finalStatus,
                points || 0,
                assignee || null,
                tagsArray,
                source.trim(),
                finalSprintId,
                processId,
                order || 0,
                deadlineVal,
                ctx.user.id,
              ]
            );
          } else if (missingColumn === "deadline") {
            // Try without deadline
            await client.query(
              `INSERT INTO issues (id, title, description, priority, status, points, assignee, tags, source, "sprintId", "processId", "order", issuer, "createdAt", "updatedAt")
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())`,
              [
                issueId,
                title.trim(),
                description?.trim() || null,
                priority || "medium",
                finalStatus,
                points || 0,
                assignee || null,
                tagsArray,
                source.trim(),
                finalSprintId,
                processId,
                order || 0,
                ctx.user.id,
              ]
            );
          } else {
            // Try without both
            await client.query(
              `INSERT INTO issues (id, title, description, priority, status, points, assignee, tags, source, "sprintId", "processId", "order", "createdAt", "updatedAt")
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
              [
                issueId,
                title.trim(),
                description?.trim() || null,
                priority || "medium",
                finalStatus,
                points || 0,
                assignee || null,
                tagsArray,
                source.trim(),
                finalSprintId,
                processId,
                order || 0,
              ]
            );
          }
        } else {
          throw insertErr;
        }
      }

      // Fetch the created issue (include issuer, verifier, deadline if columns exist)
      let issueResult;
      try {
        issueResult = await client.query(
          `SELECT 
            i.id,
            i.title,
            i.description,
            i.priority,
            i.status,
            i.points,
            i.assignee,
            i.issuer,
            i.verifier,
            i.tags,
            i.source,
            i."sprintId",
            i."processId",
            i."order",
            i."createdAt",
            i."updatedAt",
            i."deadline"
          FROM issues i
          WHERE i.id = $1`,
          [issueId]
        );
      } catch (selectErr: any) {
        // Handle missing columns gracefully
        if (selectErr?.code === "42703") {
          // Try with fewer columns
          try {
            issueResult = await client.query(
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
              WHERE i.id = $1`,
              [issueId]
            );
            // Set defaults for missing columns
            if (issueResult.rows[0]) {
              issueResult.rows[0].issuer = issueResult.rows[0].issuer || null;
              issueResult.rows[0].verifier = issueResult.rows[0].verifier || null;
              issueResult.rows[0].deadline = null;
            }
          } catch {
            throw selectErr;
          }
        } else {
          throw selectErr;
        }
      }

      const createdIssue = issueResult.rows[0];
      client.release();

      // Log activity (non-blocking)
      if (ctx.user?.id) {
        logActivity(orgId, processId, ctx.user.id, {
          action: "issue.created",
          entityType: "issue",
          entityId: createdIssue.id,
          entityTitle: createdIssue.title,
          details: {
            priority: createdIssue.priority,
            status: createdIssue.status,
            sprintId: createdIssue.sprintId,
          },
        }).catch((err) => console.error("[Issue Create] Failed to log activity:", err));
      }

      return NextResponse.json(
        {
          message: "Issue created successfully",
          issue: createdIssue,
        },
        { status: 201 }
      );
    } catch (dbError: any) {
      client.release();
      return NextResponse.json(
        { error: "Failed to create issue", message: dbError.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error creating issue:", error);
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}
