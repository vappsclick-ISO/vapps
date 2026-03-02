import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { prisma } from "@/lib/prisma";
import {
  storedToPermissionRows,
  permissionRowsToStored,
  getCurrentUserPermissionFlags,
  PERMISSION_KEYS,
  type PermissionRow,
  type StoredPermissions,
} from "@/lib/permissions";
import { roleToSystemRoleDisplay } from "@/lib/roles";

/**
 * GET /api/organization/[orgId]/permissions
 * Returns role permission matrix for the org. Any org member can read.
 * Response includes isOwner so the UI can enable/disable editing.
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

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { ownerId: true, permissions: true },
    });
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const isOwner = org.ownerId === ctx.user.id;
    const stored = org.permissions as StoredPermissions | null;
    const permissions = storedToPermissionRows(stored);
    const currentUserRole = ctx.tenant.userRole; // owner | admin | manager | member
    const systemRoleDisplay = roleToSystemRoleDisplay(currentUserRole);
    const currentUserPermissions = getCurrentUserPermissionFlags(stored, currentUserRole);

    return NextResponse.json({
      permissions,
      isOwner,
      currentUserRole: systemRoleDisplay, // "Admin" | "Manager" | "Member"
      currentUserPermissions, // { manage_teams, manage_sites, manage_processes, create_issues, verify_issues }
    });
  } catch (error: any) {
    console.error("Error fetching permissions:", error);
    return NextResponse.json(
      { error: "Internal server error", message: error?.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/organization/[orgId]/permissions
 * Update role permissions. Only the organization owner can change permissions.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const ctx = await getRequestContext(req, orgId);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { ownerId: true },
    });
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    if (org.ownerId !== ctx.user.id) {
      return NextResponse.json(
        { error: "Only the organization owner can change role permissions." },
        { status: 403 }
      );
    }

    let body: { permissions?: PermissionRow[] };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const rows = body.permissions;
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "Body must include permissions array with at least one row." },
        { status: 400 }
      );
    }

    const validated: PermissionRow[] = [];
    for (const row of rows) {
      if (!row || typeof row.key !== "string") continue;
      if (!PERMISSION_KEYS.includes(row.key as any)) continue;
      validated.push({
        key: row.key,
        label: row.label ?? "",
        admin: Boolean(row.admin),
        manager: Boolean(row.manager),
        member: Boolean(row.member),
      });
    }

    const stored = permissionRowsToStored(validated);
    await prisma.organization.update({
      where: { id: orgId },
      data: { permissions: stored as object },
    });

    const updated = storedToPermissionRows(stored);
    return NextResponse.json({
      permissions: updated,
      message: "Permissions updated. Only the organization owner can change these settings.",
    });
  } catch (error: any) {
    console.error("Error updating permissions:", error);
    return NextResponse.json(
      { error: "Internal server error", message: error?.message },
      { status: 500 }
    );
  }
}
