import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { queryTenant, getTenantPool, getTenantClient } from "@/lib/db/tenant-pool";
import { cache, cacheKeys } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import { roleToLeadershipTier } from "@/lib/roles";
import crypto from "crypto";

/**
 * GET /api/organization/[orgId]/sites
 * Get sites and their processes. Top = all; Operational = their site(s); Support = site(s) containing their process(es).
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

    const { tenant } = ctx;
    const userRole = tenant.userRole;

    const cacheKey = `sites:${orgId}:${ctx.user.id}`;
    const cached = cache.get<{ sites: any[]; userRole: string; organization: { id: string; name: string } }>(cacheKey);
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
    const userRoleFromOrg = isOwner ? "owner" : (userOrg?.role || "member");
    const leadershipTier = userOrg?.leadershipTier || roleToLeadershipTier(userRoleFromOrg);
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
          const response = {
            sites: [],
            userRole,
            organization: { id: tenant.orgId, name: tenant.orgName },
          };
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
          const response = {
            sites: [],
            userRole,
            organization: { id: tenant.orgId, name: tenant.orgName },
          };
          cache.set(cacheKey, response, 60 * 1000);
          return NextResponse.json(response);
        }
      }

      let rows: any[];

      if (isTopLeadership) {
        const result = await client.query(`
          SELECT s.id, s.name, s.code, s.location, s."createdAt", s."updatedAt",
                 p.id as "processId", p.name as "processName", p."createdAt" as "processCreatedAt"
          FROM sites s
          LEFT JOIN processes p ON p."siteId" = s.id
          ORDER BY s."createdAt" ASC, p.name ASC
        `);
        rows = result.rows;
      } else if (allowedSiteIds && allowedSiteIds.length > 0) {
        const placeholders = allowedSiteIds.map((_, i) => `$${i + 1}`).join(", ");
        const result = await client.query(
          `SELECT s.id, s.name, s.code, s.location, s."createdAt", s."updatedAt",
                 p.id as "processId", p.name as "processName", p."createdAt" as "processCreatedAt"
          FROM sites s
          LEFT JOIN processes p ON p."siteId" = s.id
          WHERE s.id IN (${placeholders})
          ORDER BY s."createdAt" ASC, p.name ASC`,
          allowedSiteIds
        );
        rows = result.rows;
      } else if (allowedProcessIds && allowedProcessIds.length > 0) {
        const placeholders = allowedProcessIds.map((_, i) => `$${i + 1}`).join(", ");
        const result = await client.query(
          `SELECT s.id, s.name, s.code, s.location, s."createdAt", s."updatedAt",
                 p.id as "processId", p.name as "processName", p."createdAt" as "processCreatedAt"
          FROM sites s
          INNER JOIN processes p ON p."siteId" = s.id AND p.id IN (${placeholders})
          ORDER BY s."createdAt" ASC, p.name ASC`,
          allowedProcessIds
        );
        rows = result.rows;
      } else {
        rows = [];
      }

      client.release();

      const sitesMap = new Map<string, any>();
      rows.forEach((row: any) => {
        const siteId = row.id;
        if (!sitesMap.has(siteId)) {
          sitesMap.set(siteId, {
            id: row.id,
            name: row.name,
            code: row.code,
            location: row.location,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            processes: [],
          });
        }
        if (row.processId) {
          sitesMap.get(siteId)!.processes.push({
            id: row.processId,
            name: row.processName,
            createdAt: row.processCreatedAt,
          });
        }
      });

      const response = {
        sites: Array.from(sitesMap.values()),
        userRole,
        organization: { id: tenant.orgId, name: tenant.orgName },
      };

      cache.set(cacheKey, response, 60 * 1000);
      return NextResponse.json(response);
    } catch (dbError: any) {
      client.release();
      console.error("[Sites API] Database error:", dbError);
      return NextResponse.json(
        {
          error: "Failed to fetch sites",
          message: dbError.message,
          ...(process.env.NODE_ENV === "development" && {
            details: { code: dbError.code, stack: dbError.stack, orgId },
          }),
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error fetching sites:", error);
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/organization/[orgId]/sites
 * Create a new site (only for owners)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const body = await req.json();
    const { siteName, location } = body;

    // Get request context (user + tenant) - single call, cached
    const ctx = await getRequestContext(req, orgId);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tenant } = ctx;

    // Org owner can do anything; otherwise require manage_sites
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
      if (!hasPermission(stored, tenant.userRole as Role, "manage_sites")) {
        return NextResponse.json(
          { error: "You do not have permission to manage sites and departments." },
          { status: 403 }
        );
      }
    }

    if (!siteName || !location) {
      return NextResponse.json(
        { error: "Site name and location are required" },
        { status: 400 }
      );
    }

    try {
      // Use pooled connection
      const pool = await getTenantPool(orgId);
      const client = await pool.connect();

      try {
        // Auto-generate site code: Get count of existing sites for this organization
        const countResult = await client.query(`SELECT COUNT(*) as count FROM sites`);
        const count = parseInt(countResult.rows[0].count) + 1;
        const finalSiteCode = `S${String(count).padStart(3, '0')}`;

        // Check if site code already exists (shouldn't happen, but safety check)
        const existingSite = await client.query(
          `SELECT id FROM sites WHERE code = $1`,
          [finalSiteCode]
        );

        if (existingSite.rows.length > 0) {
          return NextResponse.json(
            { error: "Site code already exists" },
            { status: 409 }
          );
        }

        // Insert new site
        const siteId = crypto.randomUUID();
        await client.query(
          `INSERT INTO sites (id, name, code, location, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, NOW(), NOW())`,
          [siteId, siteName, finalSiteCode, location]
        );

        // Clear cache after mutation
        cache.delete(cacheKeys.orgSites(orgId));

        return NextResponse.json(
          {
            message: "Site created successfully",
            site: {
              id: siteId,
              name: siteName,
              code: finalSiteCode,
              location,
              processes: [],
            },
          },
          { status: 201 }
        );
      } finally {
        client.release(); // CRITICAL: Always release connection back to pool
      }
    } catch (dbError: any) {
      return NextResponse.json(
        { error: "Failed to create site", message: dbError.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error creating site:", error);
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}
