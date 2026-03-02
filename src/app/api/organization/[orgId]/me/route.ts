import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { prisma } from "@/lib/prisma";
import { roleToLeadershipTier, roleToSystemRoleDisplay } from "@/lib/roles";

/**
 * GET /api/organization/[orgId]/me
 * Returns the current user's membership info in this org: leadership tier, system role, job title.
 * Used e.g. on the profile page to show "Support", "Member", "Senior Product Manager".
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
      select: { ownerId: true },
    });
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const membership = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: { userId: ctx.user.id, organizationId: orgId },
      },
      select: { role: true, leadershipTier: true, jobTitle: true },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "You are not a member of this organization" },
        { status: 404 }
      );
    }

    const isOwner = org.ownerId === ctx.user.id;
    const leadershipTier = membership.leadershipTier || roleToLeadershipTier(membership.role);
    const systemRole = roleToSystemRoleDisplay(membership.role);
    const jobTitle =
      (membership.jobTitle && membership.jobTitle.trim()) || (isOwner ? "Owner" : null);

    return NextResponse.json({
      leadershipTier,
      systemRole,
      jobTitle,
      isOwner,
    });
  } catch (error) {
    console.error("Error fetching org membership:", error);
    return NextResponse.json(
      { error: "Failed to load membership" },
      { status: 500 }
    );
  }
}
