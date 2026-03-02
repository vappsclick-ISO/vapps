import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-server-session";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/organization/list
 * Get all organizations where the current user is a member (owner, admin, or member)
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // OPTIMIZED: Use _count instead of include to reduce payload size
    // This avoids fetching all user IDs when we only need the count
    const userOrgs = await prisma.userOrganization.findMany({
      where: {
        userId: user.id,
      },
      select: {
        role: true,
        organization: {
          select: {
            id: true,
            name: true,
            createdAt: true,
            _count: {
              select: {
                users: true,
              },
            },
          },
        },
      },
      orderBy: {
        organization: {
          createdAt: "desc",
        },
      },
    });

    // Format response
    const organizations = userOrgs.map((userOrg) => ({
      id: userOrg.organization.id,
      name: userOrg.organization.name,
      role: userOrg.role, // owner, admin, or member
      createdAt: userOrg.organization.createdAt,
      memberCount: userOrg.organization._count.users,
    }));

    return NextResponse.json({ organizations }, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching user organizations:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch organizations",
        message: process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
