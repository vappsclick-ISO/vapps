import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withTenantConnection } from "@/lib/db/connection-helper";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    // O(1) lookup: Find invitation in master DB by token
    const masterInvite = await prisma.invitation.findUnique({
      where: { token },
      include: {
        organization: {
          include: { database: true },
        },
      },
    });

    if (!masterInvite) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    // Check invitation status - if already accepted, still return data (for UI purposes)
    // but frontend should handle this gracefully
    if (masterInvite.status !== "pending" && masterInvite.status !== "accepted") {
      return NextResponse.json(
        { error: `This invitation has already been ${masterInvite.status}` },
        { status: 400 }
      );
    }
    
    // If already accepted, we'll still return the data but the frontend should redirect
    const isAlreadyAccepted = masterInvite.status === "accepted";

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

    const org = masterInvite.organization;

    if (!org.database) {
      logger.error("Organization database not found", null, {
        orgId: org.id,
      });
      return NextResponse.json(
        { error: "Organization database not available" },
        { status: 500 }
      );
    }

    // Get tenant-specific invitation details with site/process info
    let tenantInvite: any = null;
    await withTenantConnection(org.database.connectionString, async (client) => {
      const result = await client.query(
        `
        SELECT i.*, s.name as site_name, p.name as process_name
        FROM invitations i
        LEFT JOIN sites s ON s.id = i.site_id::text
        LEFT JOIN processes p ON p.id = i.process_id::text
        WHERE i.token = $1
        LIMIT 1
        `,
        [token]
      );

      tenantInvite = result.rows[0];
    });

    if (!tenantInvite) {
      logger.error("Tenant invitation not found", null, {
        orgId: org.id,
        token,
        masterInviteId: masterInvite.id,
      });
      return NextResponse.json(
        { error: "Invitation data not found" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      email: masterInvite.email,
      role: tenantInvite.role,
      status: masterInvite.status, // Include status so frontend knows if already accepted
      org: {
        id: org.id,
        name: org.name,
      },
      site: tenantInvite.site_id
        ? {
            id: tenantInvite.site_id,
            name: tenantInvite.site_name,
          }
        : null,
      process: tenantInvite.process_id
        ? {
            id: tenantInvite.process_id,
            name: tenantInvite.process_name,
          }
        : null,
      expiresAt: masterInvite.expiresAt,
    });
  } catch (err) {
    logger.error("Failed to resolve invitation", err, {
      token: req.nextUrl.searchParams.get("token"),
    });

    return NextResponse.json(
      { error: "Failed to resolve invitation" },
      { status: 500 }
    );
  }
}
