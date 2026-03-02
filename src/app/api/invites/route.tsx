import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/get-server-session";
import { withTenantConnection } from "@/lib/db/connection-helper";
import { logger } from "@/lib/logger";
import { normalizeRole, isRoleHigher, type Role } from "@/lib/roles";
import { sendInvitationEmail } from "@/helpers/mailer";
import { hasPermission, type StoredPermissions } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  let bodyData: { orgId?: string; email?: string } = {};
  
  try {
    const user = await getCurrentUser();
    if (!user || !user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      const raw = await req.json();
      body = typeof raw === "object" && raw !== null ? raw : {};
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    bodyData = body;

    // Read and normalize fields so we never rely on undefined or wrong types
    const orgId = typeof body.orgId === "string" ? body.orgId : undefined;
    const email = typeof body.email === "string" ? body.email.trim() : undefined;
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : (typeof (body as any).name === "string" ? (body as any).name.trim() : null);
    const role = typeof body.role === "string" ? body.role : "member";
    const jobTitle = body.jobTitle != null && body.jobTitle !== "" ? String(body.jobTitle).trim() : null;
    const siteId = body.siteId != null && body.siteId !== "" ? String(body.siteId) : null;
    const processId = body.processId != null && body.processId !== "" ? String(body.processId) : null;
    const additionalRoleIds = Array.isArray(body.additionalRoleIds)
      ? (body.additionalRoleIds as string[]).filter((id) => typeof id === "string" && id.trim() !== "")
      : [];

    logger.info("Creating invitation", {
      email,
      hasFullName: !!fullName,
      jobTitle: jobTitle ?? "null",
      siteId: siteId ?? "null",
      processId: processId ?? "null",
    });

    // Validation: orgId and email always required
    if (!orgId || !email) {
      return NextResponse.json(
        { error: "orgId and email are required" },
        { status: 400 }
      );
    }

    // Note: Role normalization and validation happens after permission check below

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Validate org exists and get database connection + permissions
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: { database: true },
    });
    const orgWithPermissions = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, ownerId: true, database: true, permissions: true },
    });

    if (!org || !orgWithPermissions) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    if (!org.database) {
      return NextResponse.json(
        { error: "Tenant database not found" },
        { status: 404 }
      );
    }

    // Org owner can do anything – skip permission check; otherwise require manage_teams
    const isOwner = orgWithPermissions.ownerId === user.id;
    const membership = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: { userId: user.id, organizationId: orgId },
      },
      select: { role: true },
    });
    if (!membership) {
      return NextResponse.json(
        { error: "You are not a member of this organization" },
        { status: 403 }
      );
    }
    // Normalize role before permission check to ensure consistent comparison
    const currentUserRole = normalizeRole(membership.role) as Role;
    if (!isOwner) {
      const stored = (orgWithPermissions.permissions ?? null) as StoredPermissions | null;
      if (!hasPermission(stored, currentUserRole, "manage_teams")) {
        return NextResponse.json(
          { error: "You do not have permission to manage users and teams." },
          { status: 403 }
        );
      }
    }

    // Normalize role and enforce hierarchy: cannot invite with role higher than your own
    const normalizedRole = normalizeRole(role) as Role;
    if (!isOwner && isRoleHigher(normalizedRole, currentUserRole)) {
      return NextResponse.json(
        { error: "You cannot invite a user with a higher role than your own." },
        { status: 403 }
      );
    }

    // Every user except Owner must have one site and one process.
    const isOwnerRole = normalizedRole === "owner";
    if (!isOwnerRole) {
      if (!siteId) {
        return NextResponse.json(
          { error: "Site is required for all users except Owner." },
          { status: 400 }
        );
      }
      if (!processId) {
        return NextResponse.json(
          { error: "Process is required for all users except Owner." },
          { status: 400 }
        );
      }
    }

    // Check for existing pending invite for same org + email
    const existingInvite = await prisma.invitation.findFirst({
      where: {
        organizationId: orgId,
        email,
        status: "pending",
      },
    });

    if (existingInvite) {
      return NextResponse.json(
        { error: "A pending invitation already exists for this email in this organization" },
        { status: 409 }
      );
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

    // Create new invitation in master DB (all values already normalized above)
    const masterInvite = await prisma.invitation.create({
      data: {
        token,
        organizationId: orgId,
        email,
        name: fullName || null,
        role: normalizedRole,
        jobTitle,
        siteId,
        processId,
        additionalRoleIds: additionalRoleIds.length > 0 ? additionalRoleIds : undefined,
        status: "pending",
        expiresAt,
        invitedBy: user.id,
      },
    });

    logger.info("Invitation created", {
      inviteId: masterInvite.id,
      email,
      name: masterInvite.name ?? "null",
      jobTitle: masterInvite.jobTitle ?? "null",
      siteId: masterInvite.siteId ?? "null",
      processId: masterInvite.processId ?? "null",
    });

    // Store tenant-specific invitation (site_id/process_id and additional_role_ids used when user accepts)
    await withTenantConnection(org.database.connectionString, async (client) => {
      const hasAdditionalRoleIdsColumn = await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'invitations' AND column_name = 'additional_role_ids'`
      ).then((r: { rows: { column_name: string }[] }) => r.rows.length > 0);
      if (hasAdditionalRoleIdsColumn) {
        await client.query(
          `
          INSERT INTO invitations
          (email, site_id, process_id, role, token, invited_by, expires_at, status, created_at, additional_role_ids)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW(), $8::uuid[])
          `,
          [email, siteId, processId, normalizedRole, token, user.id, expiresAt, additionalRoleIds.length > 0 ? additionalRoleIds : []]
        );
      } else {
        await client.query(
          `
          INSERT INTO invitations
          (email, site_id, process_id, role, token, invited_by, expires_at, status, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW())
          `,
          [email, siteId, processId, normalizedRole, token, user.id, expiresAt]
        );
      }
    });

    // Send invitation email
    try {
      await sendInvitationEmail({
        email,
        token,
        organizationName: org.name,
        inviterName: user.name || undefined,
        role: normalizedRole,
      });
      logger.info("Invitation email sent", {
        inviteId: masterInvite.id,
        email,
      });
    } catch (emailError) {
      // Log email error but don't fail the request
      // The invitation is already created in the database
      logger.error("Failed to send invitation email", emailError, {
        inviteId: masterInvite.id,
        email,
      });
    }

    logger.info("Invitation created", {
      inviteId: masterInvite.id,
      orgId,
      email,
      role: normalizedRole,
      invitedBy: user.id,
    });

    return NextResponse.json({
      success: true,
      inviteLink: `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'}/auth/invite?token=${token}`,
    });
  } catch (err) {
    logger.error("Failed to create invitation", err, {
      orgId: bodyData.orgId,
      email: bodyData.email,
    });

    // Handle duplicate token (should be extremely rare)
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "Token collision occurred. Please try again." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create invitation" },
      { status: 500 }
    );
  }
}
