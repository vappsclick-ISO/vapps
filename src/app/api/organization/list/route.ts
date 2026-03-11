import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-server-session";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/organization/list
 * Get all organizations where the current user is a member (owner, admin, or member)
 */
export async function GET(req: NextRequest) {
  try {
    if (process.env.NODE_ENV === "development") {
      console.log("[GET /api/organization/list] Incoming cookies:", req.headers.get("cookie") ?? "(none)");
    }
    const user = await getCurrentUser(req);
    if (!user || !user.id) {
      if (process.env.NODE_ENV === "development") {
        console.log("[GET /api/organization/list] No session – user:", user);
      }
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
            slug: true,
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

    // Format response (slug used for URL-friendly routes)
    const organizations = userOrgs.map((userOrg) => ({
      id: userOrg.organization.id,
      slug: userOrg.organization.slug ?? userOrg.organization.id,
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
