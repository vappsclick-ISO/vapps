import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { prisma } from "@/lib/prisma";
import { withTenantConnection } from "@/lib/db/connection-helper";
import { logger } from "@/lib/logger";
import { normalizeRole, roleToLeadershipTier, isRoleHigher, type Role } from "@/lib/roles";
import { hasPermission, type StoredPermissions } from "@/lib/permissions";

/**
 * PUT /api/organization/[orgId]/members/[userId]
 * Update user's role, jobTitle, and site/process assignments
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; userId: string }> }
) {
  const { orgId, userId } = await params;
  try {
    const ctx = await getRequestContext(req, orgId);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const resolvedOrgId = ctx.tenant.orgId;

    const organization = await prisma.organization.findUnique({
      where: { id: resolvedOrgId },
      select: { ownerId: true },
    });
    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const isOrgOwner = organization.ownerId === ctx.user.id;
    const currentUserMembership = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId: ctx.user.id,
          organizationId: resolvedOrgId,
        },
      },
      select: { role: true },
    });

    if (!currentUserMembership && !isOrgOwner) {
      return NextResponse.json(
        { error: "You are not a member of this organization" },
        { status: 403 }
      );
    }

    const currentUserRole = (isOrgOwner ? "owner" : currentUserMembership!.role) as Role;
    const isSelfUpdate = ctx.user.id === userId;

    // Prevent others from updating the owner (owner can update their own site/process/auditor)
    if (organization.ownerId === userId && !isSelfUpdate) {
      return NextResponse.json(
        { error: "Cannot update organization owner" },
        { status: 403 }
      );
    }

    const existingMembership = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: resolvedOrgId,
        },
      },
    });

    if (!existingMembership && organization.ownerId !== userId) {
      return NextResponse.json(
        { error: "User is not a member of this organization" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { role, jobTitle, siteId, processId, name, additionalRoleIds } = body;

    const existingRole = existingMembership?.role ?? (organization.ownerId === userId ? "owner" : "member");
    let normalizedRole = existingRole as Role;
    if (role && !isSelfUpdate) {
      normalizedRole = normalizeRole(role) as Role;
      if (isRoleHigher(normalizedRole, currentUserRole)) {
        return NextResponse.json(
          { error: "You cannot assign a role higher than your own." },
          { status: 403 }
        );
      }
    }
    if (isSelfUpdate) {
      normalizedRole = existingRole as Role;
    }

    const leadershipTier = roleToLeadershipTier(normalizedRole);

    // Update User's name if provided
    if (name !== undefined && name !== null) {
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { name: name.trim() || null },
        });
        logger.info("Updated user name", {
          userId,
          name: name.trim(),
        });
      } catch (updateError: any) {
        logger.warn("Failed to update user name", {
          error: updateError,
          userId,
          name,
        });
        // Don't fail the request if name update fails
      }
    }

    if (existingMembership) {
      await prisma.userOrganization.update({
        where: {
          userId_organizationId: {
            userId,
            organizationId: resolvedOrgId,
          },
        },
        data: {
          ...(!isSelfUpdate && role && { role: normalizedRole }),
          ...(!isSelfUpdate && role && { leadershipTier }),
          ...(jobTitle !== undefined && { jobTitle: jobTitle || null }),
        },
      });
    }

    // Update site/process assignments if provided
    if (ctx.tenant?.connectionString && (siteId !== undefined || processId !== undefined)) {
      await withTenantConnection(ctx.tenant.connectionString, async (client) => {
        // Remove existing site assignments
        if (siteId !== undefined) {
          await client.query(
            `DELETE FROM site_users WHERE user_id = $1`,
            [userId]
          );

          // Add new site assignment if provided
          if (siteId) {
            await client.query(
              `INSERT INTO site_users (site_id, user_id, role)
               VALUES ($1::text::uuid, $2, $3)
               ON CONFLICT (site_id, user_id) DO UPDATE
               SET role = EXCLUDED.role`,
              [siteId, userId, normalizedRole]
            );
          }
        }

        // Remove existing process assignments
        if (processId !== undefined) {
          await client.query(
            `DELETE FROM process_users WHERE user_id = $1`,
            [userId]
          );

          // Add new process assignment if provided
          if (processId) {
            await client.query(
              `INSERT INTO process_users (process_id, user_id, role)
               VALUES ($1::text::uuid, $2, $3)
               ON CONFLICT (process_id, user_id) DO UPDATE
               SET role = EXCLUDED.role`,
              [processId, userId, normalizedRole]
            );
          }
        }
      });
    }

    // Update additional roles (e.g. Auditor) in tenant DB
    if (ctx.tenant?.connectionString && additionalRoleIds !== undefined) {
      const roleIds: string[] = Array.isArray(additionalRoleIds) ? additionalRoleIds : [];
      await withTenantConnection(ctx.tenant.connectionString, async (client) => {
        await client.query(
          `DELETE FROM user_additional_roles WHERE user_id = $1`,
          [userId]
        );
        for (const roleId of roleIds) {
          if (roleId && typeof roleId === "string") {
            await client.query(
              `INSERT INTO user_additional_roles (user_id, additional_role_id) VALUES ($1, $2::uuid) ON CONFLICT (user_id, additional_role_id) DO NOTHING`,
              [userId, roleId]
            );
          }
        }
      });
    }

    logger.info("User updated in organization", {
      userId,
      orgId: resolvedOrgId,
      updatedBy: ctx.user.id,
      role: normalizedRole,
      jobTitle: jobTitle || null,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error("Error updating user", error, { orgId, userId });
    return NextResponse.json(
      { error: "Failed to update user", message: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/organization/[orgId]/members/[userId]
 * Remove user from organization
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; userId: string }> }
) {
  const { orgId, userId } = await params;
  try {
    const ctx = await getRequestContext(req, orgId);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const resolvedOrgId = ctx.tenant.orgId;

    const organization = await prisma.organization.findUnique({
      where: { id: resolvedOrgId },
      select: { ownerId: true, permissions: true },
    });
    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const isOrgOwner = organization.ownerId === ctx.user.id;
    const currentUserMembership = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId: ctx.user.id,
          organizationId: resolvedOrgId,
        },
      },
      select: { role: true },
    });

    if (!currentUserMembership && !isOrgOwner) {
      return NextResponse.json(
        { error: "You are not a member of this organization" },
        { status: 403 }
      );
    }

    const currentUserRole = (isOrgOwner ? "owner" : currentUserMembership!.role) as Role;

    // Check if user is trying to delete themselves
    if (ctx.user.id === userId) {
      return NextResponse.json(
        { error: "You cannot remove yourself from the organization" },
        { status: 403 }
      );
    }

    // Org owner can do anything; otherwise require manage_teams
    const isOwner = organization.ownerId === ctx.user.id;
    if (!isOwner) {
      const stored = (organization.permissions ?? null) as StoredPermissions | null;
      if (!hasPermission(stored, currentUserRole as Role, "manage_teams")) {
        return NextResponse.json(
          { error: "You do not have permission to manage users and teams." },
          { status: 403 }
        );
      }
    }

    // Prevent deleting the owner
    if (organization.ownerId === userId) {
      return NextResponse.json(
        { error: "Cannot remove organization owner" },
        { status: 403 }
      );
    }

    const existingMembership = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: resolvedOrgId,
        },
      },
    });

    if (!existingMembership && organization.ownerId !== userId) {
      return NextResponse.json(
        { error: "User is not a member of this organization" },
        { status: 404 }
      );
    }

    // Check permission: Only Top Leadership can delete users
    const currentUserTier = roleToLeadershipTier(currentUserRole);
    if (currentUserTier !== "Top") {
      return NextResponse.json(
        { error: "Only Top Leadership can remove users" },
        { status: 403 }
      );
    }

    // Remove from tenant site_users and process_users
    if (ctx.tenant?.connectionString) {
      await withTenantConnection(ctx.tenant.connectionString, async (client) => {
        await client.query(`DELETE FROM site_users WHERE user_id = $1`, [userId]);
        await client.query(`DELETE FROM process_users WHERE user_id = $1`, [userId]);
      });
    }

    // Remove from UserOrganization (cascade will handle related data)
    if (existingMembership) {
      await prisma.userOrganization.delete({
        where: {
          userId_organizationId: {
            userId,
            organizationId: resolvedOrgId,
          },
        },
      });
    }

    logger.info("User removed from organization", {
      userId,
      orgId: resolvedOrgId,
      removedBy: ctx.user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error("Error removing user", error, { orgId, userId });
    return NextResponse.json(
      { error: "Failed to remove user", message: error.message },
      { status: 500 }
    );
  }
}
