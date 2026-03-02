import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { withTenantConnection } from "@/lib/db/connection-helper";
import { logger } from "@/lib/logger";
import { normalizeRole, isRoleHigher, roleToLeadershipTier } from "@/lib/roles";

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: "Missing token or password" },
        { status: 400 }
      );
    }

    // 1️⃣ Validate invite in master DB
    const masterInvite = await prisma.invitation.findUnique({
      where: { token },
      select: {
        id: true,
        token: true,
        organizationId: true,
        email: true,
        name: true, // Select name from invitation
        role: true,
        jobTitle: true,
        siteId: true,
        processId: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        organization: {
          include: { database: true },
        },
      },
    });

    if (!masterInvite) {
      return NextResponse.json(
        { error: "Invalid invite token" },
        { status: 404 }
      );
    }

    if (masterInvite.status !== "pending") {
      return NextResponse.json(
        { error: "Invite already used or expired" },
        { status: 400 }
      );
    }

    // Check expiration
    if (new Date() > masterInvite.expiresAt) {
      await prisma.invitation.update({
        where: { id: masterInvite.id },
        data: { status: "expired" },
      });
      return NextResponse.json(
        { error: "This invitation has expired" },
        { status: 400 }
      );
    }

    const orgId = masterInvite.organizationId;
    const org = masterInvite.organization;

    if (!org.database) {
      logger.error("Organization database not found", null, { orgId });
      return NextResponse.json(
        { error: "Organization database not available" },
        { status: 500 }
      );
    }

    // Get tenant-specific invitation details
    let tenantInvite: any = null;
    await withTenantConnection(org.database.connectionString, async (client) => {
      const result = await client.query(
        `SELECT * FROM invitations WHERE token = $1 LIMIT 1`,
        [token]
      );
      tenantInvite = result.rows[0];
    });

    if (!tenantInvite) {
      logger.error("Tenant invitation not found", null, {
        orgId,
        token,
        masterInviteId: masterInvite.id,
      });
      return NextResponse.json(
        { error: "Invitation data not found" },
        { status: 500 }
      );
    }

    const inviteRole = normalizeRole(tenantInvite.role);

    // Log tenant invite details for debugging
    logger.info("Tenant invite details", {
      siteId: tenantInvite.site_id,
      processId: tenantInvite.process_id,
      role: inviteRole,
      email: tenantInvite.email,
    });

    // 2️⃣ Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: masterInvite.email },
    });

    // 3️⃣ SECURITY: If user already exists, they must NOT use password-based acceptance
    // Existing users must log in first, then use the /accept endpoint (no password)
    if (existingUser) {
      logger.warn("Existing user attempted password-based invite acceptance", {
        userId: existingUser.id,
        email: existingUser.email,
        orgId,
        inviteId: masterInvite.id,
      });

      return NextResponse.json(
        {
          error: "ACCOUNT_EXISTS",
          message: "An account with this email already exists. Please log in to accept this invitation.",
          requiresLogin: true,
        },
        { status: 403 }
      );
    }

    // 4️⃣ User does NOT exist → create new account
    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email: masterInvite.email,
        name: masterInvite.name || null, // Save name from invitation
        password: hashed,
        emailVerified: new Date(), // invited users are auto-verified
      },
    });

    logger.info("User created via invite", {
      userId: user.id,
      email: user.email,
      orgId,
    });

    // 5️⃣ Check if user already belongs to this organization
    const existingMembership = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: orgId,
        },
      },
    });

    // 6️⃣ Attach user to org/site/process with atomic transaction
    await withTenantConnection(org.database.connectionString, async (client) => {
      await client.query("BEGIN");

      try {
        // Handle organization membership (master DB)
        const leadershipTier = roleToLeadershipTier(inviteRole);
        
        if (!existingMembership) {
          const jobTitleToSave = masterInvite.jobTitle ?? null;
          
          await prisma.userOrganization.create({
            data: {
              userId: user.id,
              organizationId: orgId,
              role: inviteRole,
              leadershipTier: leadershipTier, // Store leadership tier explicitly
              jobTitle: jobTitleToSave, // Store jobTitle from invitation
            },
          });

          logger.info("User added to organization", {
            userId: user.id,
            orgId,
            role: inviteRole,
            leadershipTier,
          });
        } else {
          // User already a member - upgrade role if invite role is higher
          const currentRole = normalizeRole(existingMembership.role);
          if (isRoleHigher(inviteRole, currentRole)) {
            await prisma.userOrganization.update({
              where: {
                userId_organizationId: {
                  userId: user.id,
                  organizationId: orgId,
                },
              },
              data: { 
                role: inviteRole,
                leadershipTier: leadershipTier, // Update leadership tier when role changes
              },
            });

            logger.info("User role upgraded", {
              userId: user.id,
              orgId,
              oldRole: currentRole,
              newRole: inviteRole,
            });
          }
        }

        // Add user to tenant-specific tables (site_users and/or process_users)
        // If process_id exists, add to both process_users AND site_users (process belongs to a site)
        // If only site_id exists, add to site_users only
        
        if (tenantInvite.site_id) {
          // Always add to site_users if site_id exists
          // sites.id is TEXT, but site_users.site_id is UUID - cast TEXT to UUID
          await client.query(
            `
            INSERT INTO site_users (site_id, user_id, role)
            VALUES ($1::text::uuid, $2, $3)
            ON CONFLICT (site_id, user_id) DO UPDATE
            SET role = EXCLUDED.role
            `,
            [tenantInvite.site_id, user.id, inviteRole]
          );
          
          logger.info("User added to site_users", {
            userId: user.id,
            siteId: tenantInvite.site_id,
            role: inviteRole,
          });
        }

        if (tenantInvite.process_id) {
          // Add to process_users if process_id exists
          // processes.id is TEXT, but process_users.process_id is UUID - cast TEXT to UUID
          await client.query(
            `
            INSERT INTO process_users (process_id, user_id, role)
            VALUES ($1::text::uuid, $2, $3)
            ON CONFLICT (process_id, user_id) DO UPDATE
            SET role = EXCLUDED.role
            `,
            [tenantInvite.process_id, user.id, inviteRole]
          );
          
          logger.info("User added to process_users", {
            userId: user.id,
            processId: tenantInvite.process_id,
            role: inviteRole,
          });
        }

        if (!tenantInvite.site_id && !tenantInvite.process_id) {
          logger.warn("No site_id or process_id in tenant invite", {
            tenantInviteId: tenantInvite.id,
            userId: user.id,
            email: tenantInvite.email,
          });
        }

        // Assign additional roles (e.g. Auditor) from invitation
        const rawAdditionalRoleIds = tenantInvite.additional_role_ids;
        const additionalRoleIds: string[] = Array.isArray(rawAdditionalRoleIds)
          ? rawAdditionalRoleIds
          : typeof rawAdditionalRoleIds === "string" && rawAdditionalRoleIds
            ? rawAdditionalRoleIds.replace(/[{}]/g, "").split(",").map((s) => s.trim()).filter(Boolean)
            : [];
        for (const roleId of additionalRoleIds) {
          if (!roleId) continue;
          try {
            await client.query(
              `INSERT INTO user_additional_roles (user_id, additional_role_id) VALUES ($1, $2::uuid) ON CONFLICT (user_id, additional_role_id) DO NOTHING`,
              [user.id, roleId]
            );
          } catch (e) {
            logger.warn("Could not assign additional role", { userId: user.id, roleId, error: e });
          }
        }

        // Mark invitation as accepted in tenant DB
        await client.query(
          `UPDATE invitations SET status = 'accepted' WHERE id = $1`,
          [tenantInvite.id]
        );

        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    });

    // 7️⃣ Mark invitation as accepted in master DB
    await prisma.invitation.update({
      where: { id: masterInvite.id },
      data: {
        status: "accepted",
        acceptedAt: new Date(),
      },
    });

    logger.info("Invitation accepted with password", {
      inviteId: masterInvite.id,
      userId: user.id,
      orgId,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Invite accepted successfully",
        email: user.email,
        orgId,
        organizationName: org.name,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error("Accept invite with password error", error);
    return NextResponse.json(
      { error: "Failed to accept invite" },
      { status: 500 }
    );
  }
}

