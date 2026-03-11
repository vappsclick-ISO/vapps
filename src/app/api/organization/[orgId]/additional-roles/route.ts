import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { prisma } from "@/lib/prisma";
import { withTenantConnection } from "@/lib/db/connection-helper";
import { hasPermission, type StoredPermissions } from "@/lib/permissions";

/**
 * GET /api/organization/[orgId]/additional-roles
 * List all additional (custom) roles for the organization (e.g. Auditor).
 * Stored in tenant DB; any org member can read.
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
    const resolvedOrgId = ctx.tenant.orgId;

    const org = await prisma.organization.findUnique({
      where: { id: resolvedOrgId },
      include: { database: true },
    });
    if (!org?.database) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const roles: { id: string; name: string; description: string | null; is_active: boolean }[] = [];

    try {
      await withTenantConnection(org.database.connectionString, async (client) => {
        const result = await client.query<{ id: string; name: string; description: string | null; is_active: boolean }>(
          `SELECT id::text as id, name, description, is_active FROM additional_roles WHERE is_active = true ORDER BY name`
        );
        roles.push(...result.rows);
      });
    } catch (e) {
      // Table may not exist if tenant migration 012 has not run
      console.warn("Additional roles table not available", e);
    }

    return NextResponse.json({ additionalRoles: roles });
  } catch (error: unknown) {
    console.error("Error fetching additional roles:", error);
    return NextResponse.json(
      { error: "Failed to fetch additional roles" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/organization/[orgId]/additional-roles
 * Create a new additional role (e.g. Auditor). Only org owner or users with manage_teams can create.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const ctx = await getRequestContext(req, orgId);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const resolvedOrgId = ctx.tenant.orgId;

    const org = await prisma.organization.findUnique({
      where: { id: resolvedOrgId },
      select: { ownerId: true, database: true, permissions: true },
    });
    if (!org?.database) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const isOwner = org.ownerId === ctx.user.id;
    const stored = (org.permissions ?? null) as StoredPermissions | null;
    if (!isOwner && !hasPermission(stored, ctx.tenant.userRole, "manage_teams")) {
      return NextResponse.json(
        { error: "You do not have permission to manage additional roles." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() || null : null;

    if (!name) {
      return NextResponse.json(
        { error: "Role name is required" },
        { status: 400 }
      );
    }

    let newRole: { id: string; name: string; description: string | null } | null = null;

    await withTenantConnection(org.database.connectionString, async (client) => {
      const insertResult = await client.query<{ id: string; name: string; description: string | null }>(
        `INSERT INTO additional_roles (name, description, is_active)
         VALUES ($1, $2, true)
         ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, updated_at = now()
         RETURNING id::text as id, name, description`,
        [name, description]
      );
      if (insertResult.rows.length > 0) {
        newRole = insertResult.rows[0];
      }
    });

    if (!newRole) {
      return NextResponse.json({ error: "Failed to create role" }, { status: 500 });
    }

    return NextResponse.json({ role: newRole });
  } catch (error: unknown) {
    console.error("Error creating additional role:", error);
    return NextResponse.json(
      { error: "Failed to create additional role" },
      { status: 500 }
    );
  }
}
