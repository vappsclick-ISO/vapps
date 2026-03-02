import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-server-session";
import { prisma } from "@/lib/prisma";
import { withTenantConnection } from "@/lib/db/connection-helper";
import { logger } from "@/lib/logger";
import { normalizeRole, isRoleHigher, getHigherRole, roleToLeadershipTier, type Role } from "@/lib/roles";

export async function POST(req: NextRequest) {
  let token: string | undefined;
  let user: any = null;
  
  try {
    user = await getCurrentUser();
    if (!user || !user.id || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    token = body.token;

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    // O(1) lookup: Find invitation in master DB by token
    // Explicitly select jobTitle and name to ensure they're included even if Prisma client is outdated
    const masterInvite = await prisma.invitation.findUnique({
      where: { token },
      select: {
        id: true,
        token: true,
        organizationId: true,
        email: true,
        name: true, // Explicitly select name
        role: true,
        jobTitle: true, // Explicitly select jobTitle
        siteId: true,
        processId: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        acceptedAt: true,
        invitedBy: true,
        organization: {
          include: { database: true },
        },
      },
    });

    if (!masterInvite) {
      return NextResponse.json(
        { error: "Invalid or expired invitation" },
        { status: 404 }
      );
    }

    // Check invitation status
    if (masterInvite.status !== "pending") {
      return NextResponse.json(
        { error: `This invitation has already been ${masterInvite.status}` },
        { status: 400 }
      );
    }

    // Check expiration
    if (new Date() > masterInvite.expiresAt) {
      // Update status to expired
      await prisma.invitation.update({
        where: { id: masterInvite.id },
        data: { status: "expired" },
      });

      return NextResponse.json(
        { error: "This invitation has expired" },
        { status: 400 }
      );
    }

    // Email verification
    if (masterInvite.email.toLowerCase() !== user.email.toLowerCase()) {
      logger.warn("Invitation email mismatch", {
        inviteId: masterInvite.id,
        inviteEmail: masterInvite.email,
        userEmail: user.email,
        userId: user.id,
      });

      return NextResponse.json(
        { error: "This invitation was sent to a different email address" },
        { status: 403 }
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

    // Check if user already belongs to this organization
    const existingMembership = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: orgId,
        },
      },
    });

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

    // Process invitation acceptance with atomic transaction
    await withTenantConnection(org.database.connectionString, async (client) => {
      await client.query("BEGIN");

      try {
        // Handle organization membership
        const leadershipTier = roleToLeadershipTier(inviteRole);
        
        // Update user's name if provided in invitation and user's name is empty
        if (masterInvite.name && (!user.name || user.name.trim() === "")) {
          try {
            await prisma.user.update({
              where: { id: user.id },
              data: { name: masterInvite.name },
            });
            logger.info("Updated user name from invitation", {
              userId: user.id,
              name: masterInvite.name,
            });
          } catch (updateError: any) {
            // Log but don't fail - name update is not critical
            logger.warn("Failed to update user name from invitation", updateError, {
              userId: user.id,
              name: masterInvite.name,
            });
          }
        }
        
        if (!existingMembership) {
          // Create new membership
          const jobTitleToSave = masterInvite.jobTitle ?? null;
          
          logger.info("Creating UserOrganization with jobTitle", {
            userId: user.id,
            orgId,
            inviteJobTitle: masterInvite.jobTitle || "null",
            jobTitleToSave: jobTitleToSave || "null",
          });
          
          // Create UserOrganization with jobTitle
          // Use try-catch to handle case where Prisma client doesn't recognize jobTitle field yet
          try {
            await prisma.userOrganization.create({
              data: {
                userId: user.id,
                organizationId: orgId,
                role: inviteRole,
                leadershipTier: leadershipTier, // Store leadership tier explicitly
                jobTitle: jobTitleToSave, // Store jobTitle from invitation
              },
            });
          } catch (prismaError: any) {
            // If jobTitle field doesn't exist in Prisma client, create without it and log warning
            if (prismaError.message?.includes("Unknown argument `jobTitle`") || 
                prismaError.message?.includes("jobTitle")) {
              logger.warn("Prisma client doesn't recognize jobTitle field, creating without it", {
                userId: user.id,
                orgId,
                error: prismaError.message,
              });
              await prisma.userOrganization.create({
                data: {
                  userId: user.id,
                  organizationId: orgId,
                  role: inviteRole,
                  leadershipTier: leadershipTier,
                  // jobTitle omitted - will be null until Prisma client is regenerated
                },
              });
            } else {
              throw prismaError; // Re-throw if it's a different error
            }
          }

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
            const jobTitleToUpdate = masterInvite.jobTitle ?? null;
            
            logger.info("Updating UserOrganization with jobTitle", {
              userId: user.id,
              orgId,
              inviteJobTitle: masterInvite.jobTitle || "null",
              jobTitleToUpdate: jobTitleToUpdate || "null",
            });
            
            // Update UserOrganization with jobTitle
            // Use try-catch to handle case where Prisma client doesn't recognize jobTitle field yet
            try {
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
                  jobTitle: jobTitleToUpdate, // Update jobTitle from invitation
                },
              });
            } catch (prismaError: any) {
              // If jobTitle field doesn't exist in Prisma client, update without it and log warning
              if (prismaError.message?.includes("Unknown argument `jobTitle`") || 
                  prismaError.message?.includes("jobTitle")) {
                logger.warn("Prisma client doesn't recognize jobTitle field, updating without it", {
                  userId: user.id,
                  orgId,
                  error: prismaError.message,
                });
                await prisma.userOrganization.update({
                  where: {
                    userId_organizationId: {
                      userId: user.id,
                      organizationId: orgId,
                    },
                  },
                  data: { 
                    role: inviteRole,
                    leadershipTier: leadershipTier,
                    // jobTitle omitted - will remain null until Prisma client is regenerated
                  },
                });
              } else {
                throw prismaError; // Re-throw if it's a different error
              }
            }

            logger.info("User role upgraded", {
              userId: user.id,
              orgId,
              oldRole: currentRole,
              newRole: inviteRole,
              leadershipTier,
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

    // Mark invitation as accepted in master DB
    await prisma.invitation.update({
      where: { id: masterInvite.id },
      data: {
        status: "accepted",
        acceptedAt: new Date(),
      },
    });

    logger.info("Invitation accepted", {
      inviteId: masterInvite.id,
      userId: user.id,
      orgId,
    });

    return NextResponse.json({
      success: true,
      orgId,
      organizationName: org.name,
    });
  } catch (err) {
    logger.error("Failed to accept invitation", err, {
      token,
      userId: user?.id,
    });

    return NextResponse.json(
      { error: "Failed to accept invitation" },
      { status: 500 }
    );
  }
}
