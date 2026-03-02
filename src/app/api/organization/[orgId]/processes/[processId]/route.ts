import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { getTenantClient } from "@/lib/db/tenant-pool";
import { prisma } from "@/lib/prisma";
import { type Role } from "@/lib/roles";
import { hasPermission, type StoredPermissions } from "@/lib/permissions";
import { cache, cacheKeys } from "@/lib/cache";

/**
 * PUT /api/organization/[orgId]/processes/[processId]
 * Update an existing process
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; processId: string }> }
) {
  try {
    const { orgId, processId } = await params;
    const body = await req.json();
    const { name, description } = body;

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

    // Use tenant pool instead of new Client()
    const client = await getTenantClient(orgId);

    try {

      // Verify process exists
      const processResult = await client.query(
        `SELECT id, name, description, "siteId" FROM processes WHERE id = $1`,
        [processId]
      );

      if (processResult.rows.length === 0) {
        client.release();
        return NextResponse.json(
          { error: "Process not found" },
          { status: 404 }
        );
      }

      // Update process
      await client.query(
        `UPDATE processes 
         SET name = $1, description = $2, "updatedAt" = NOW()
         WHERE id = $3`,
        [name.trim(), description?.trim() || null, processId]
      );

      // Fetch the updated process with site information
      const updatedProcessResult = await client.query(
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

      const siteId = updatedProcessResult.rows[0]?.siteId;

      client.release();

      // Clear cache - invalidate all process-related cache entries for this org
      cache.clearPattern(`processes:${orgId}:*`);
      cache.delete(cacheKeys.orgProcesses(orgId));
      if (siteId) {
        cache.delete(cacheKeys.orgProcesses(orgId, siteId));
      }
      cache.delete(cacheKeys.orgSites(orgId));

      return NextResponse.json(
        {
          message: "Process updated successfully",
          process: updatedProcessResult.rows[0],
        },
        { status: 200 }
      );
    } catch (dbError: any) {
      client.release();
      return NextResponse.json(
        { error: "Failed to update process", message: dbError.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error updating process:", error);
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/organization/[orgId]/processes/[processId]
 * Delete a process
 */
export async function DELETE(
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

    // Use tenant pool instead of new Client()
    const client = await getTenantClient(orgId);

    try {
      // Verify process exists and get siteId for event
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

      const siteId = processResult.rows[0].siteId;

      // Delete process (CASCADE will handle related data)
      await client.query(`DELETE FROM processes WHERE id = $1`, [processId]);

      client.release();

      // Clear cache - invalidate all process-related cache entries for this org
      // GET endpoint uses: processes:${orgId}:${userId}:${siteId}
      // We need to clear all user-specific entries, so use pattern matching
      cache.clearPattern(`processes:${orgId}:*`);
      cache.delete(cacheKeys.orgProcesses(orgId));
      cache.delete(cacheKeys.orgProcesses(orgId, siteId));
      cache.delete(cacheKeys.orgSites(orgId)); // Sites cache includes process counts

      return NextResponse.json(
        {
          message: "Process deleted successfully",
          siteId, // Return siteId for event dispatching
        },
        { status: 200 }
      );
    } catch (dbError: any) {
      client.release();
      return NextResponse.json(
        { error: "Failed to delete process", message: dbError.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error deleting process:", error);
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}
