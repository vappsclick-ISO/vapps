import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { queryTenant, getTenantPool, getTenantClient } from "@/lib/db/tenant-pool";
import { cache, cacheKeys } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import { roleToLeadershipTier, type Role } from "@/lib/roles";
import { hasPermission, type StoredPermissions } from "@/lib/permissions";
import crypto from "crypto";

/**
 * GET /api/organization/[orgId]/processes?siteId=xxx
 * Get processes for an organization.
 * Access: Top = all; Operational = only processes in their assigned site(s); Support = only their assigned process(es).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get("siteId");

    const ctx = await getRequestContext(req, orgId);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Cache key includes userId so different roles get correct filtered results
    const cacheKey = `processes:${orgId}:${ctx.user.id}:${siteId || "all"}`;
    const cached = cache.get<{ processes: any[] }>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
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
      let allowedSiteIds: string[] | null = null;
      let allowedProcessIds: string[] | null = null;

      if (isOperationalLeadership) {
        const siteRows = await client.query<{ site_id: string }>(
          `SELECT site_id::text as site_id FROM site_users WHERE user_id = $1`,
          [ctx.user.id]
        );
        allowedSiteIds = siteRows.rows.map((r) => r.site_id);
        if (allowedSiteIds.length === 0) {
          client.release();
          const response = { processes: [] };
          cache.set(cacheKey, response, 60 * 1000);
          return NextResponse.json(response);
        }
      } else if (isSupportLeadership) {
        const processRows = await client.query<{ process_id: string }>(
          `SELECT process_id::text as process_id FROM process_users WHERE user_id = $1`,
          [ctx.user.id]
        );
        allowedProcessIds = processRows.rows.map((r) => r.process_id);
        if (allowedProcessIds.length === 0) {
          client.release();
          const response = { processes: [] };
          cache.set(cacheKey, response, 60 * 1000);
          return NextResponse.json(response);
        }
      }

      const baseQuery = `
        SELECT 
          p.id,
          p.name,
          p.description,
          p."siteId",
          p."createdAt",
          p."updatedAt",
          s.name as "siteName",
          s.code as "siteCode",
          s.location as "siteLocation"
        FROM processes p
        INNER JOIN sites s ON p."siteId" = s.id
      `;
      const orderClause = ` ORDER BY p."createdAt" DESC`;

      let processes: any[];

      if (isTopLeadership) {
        if (siteId) {
          const result = await client.query(
            `${baseQuery} WHERE p."siteId" = $1 ${orderClause}`,
            [siteId]
          );
          processes = result.rows;
        } else {
          const result = await client.query(`${baseQuery} ${orderClause}`);
          processes = result.rows;
        }
      } else if (allowedSiteIds && allowedSiteIds.length > 0) {
        const siteIdFilter = siteId && allowedSiteIds.includes(siteId)
          ? [siteId]
          : allowedSiteIds;
        const placeholders = siteIdFilter.map((_, i) => `$${i + 1}`).join(", ");
        const result = await client.query(
          `${baseQuery} WHERE p."siteId"::text IN (${placeholders}) ${orderClause}`,
          siteIdFilter
        );
        processes = result.rows;
      } else if (allowedProcessIds && allowedProcessIds.length > 0) {
        const placeholders = allowedProcessIds.map((_, i) => `$${i + 1}`).join(", ");
        const result = await client.query(
          `${baseQuery} WHERE p.id::text IN (${placeholders}) ${orderClause}`,
          allowedProcessIds
        );
        processes = result.rows;
      } else {
        processes = [];
      }

      client.release();

      const response = { processes };
      cache.set(cacheKey, response, 60 * 1000);
      return NextResponse.json(response);
    } catch (dbError: any) {
      client.release();
      return NextResponse.json(
        { error: "Failed to fetch processes", message: dbError.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error fetching processes:", error);
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/organization/[orgId]/processes
 * Create a new process for a site
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const body = await req.json();
    const { name, description, siteId } = body;

    // Get request context (user + tenant) - single call, cached
    const ctx = await getRequestContext(req, orgId);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Org owner can do anything; otherwise require manage_processes
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { ownerId: true, permissions: true },
    });
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }
    const isOwner = org.ownerId === ctx.user.id;
    if (!isOwner) {
      const stored = (org.permissions ?? null) as StoredPermissions | null;
      if (!hasPermission(stored, ctx.tenant.userRole as Role, "manage_processes")) {
        return NextResponse.json(
          { error: "You do not have permission to manage processes." },
          { status: 403 }
        );
      }
    }

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Process name is required" },
        { status: 400 }
      );
    }

    if (!siteId) {
      return NextResponse.json(
        { error: "Site ID is required" },
        { status: 400 }
      );
    }

    try {
      // Use pooled connection
      const pool = await getTenantPool(orgId);
      const client = await pool.connect();

      try {
        // Verify site exists
        const siteResult = await client.query(
          `SELECT id, name FROM sites WHERE id = $1`,
          [siteId]
        );

        if (siteResult.rows.length === 0) {
          return NextResponse.json(
            { error: "Site not found" },
            { status: 404 }
          );
        }

        // Insert new process
        const processId = crypto.randomUUID();
        await client.query(
          `INSERT INTO processes (id, name, description, "siteId", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, NOW(), NOW())`,
          [processId, name.trim(), description?.trim() || null, siteId]
        );

        // Fetch the created process with site information
        const processResult = await client.query(
          `SELECT 
            p.id,
            p.name,
            p.description,
            p."siteId",
            p."createdAt",
            p."updatedAt",
            s.name as "siteName",
            s.code as "siteCode",
            s.location as "siteLocation"
          FROM processes p
          INNER JOIN sites s ON p."siteId" = s.id
          WHERE p.id = $1`,
          [processId]
        );

        // Clear cache after mutation - invalidate all process-related cache entries for this org
        // GET endpoint uses: processes:${orgId}:${userId}:${siteId}
        // We need to clear all user-specific entries, so use pattern matching
        cache.clearPattern(`processes:${orgId}:*`);
        cache.delete(cacheKeys.orgProcesses(orgId));
        cache.delete(cacheKeys.orgProcesses(orgId, siteId));
        cache.delete(cacheKeys.orgSites(orgId));

        return NextResponse.json(
          {
            message: "Process created successfully",
            process: processResult.rows[0],
          },
          { status: 201 }
        );
      } finally {
        client.release(); // CRITICAL: Always release connection back to pool
      }
    } catch (dbError: any) {
      return NextResponse.json(
        { error: "Failed to create process", message: dbError.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error creating process:", error);
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}
