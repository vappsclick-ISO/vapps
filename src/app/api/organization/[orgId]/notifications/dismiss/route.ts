import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/organization/[orgId]/notifications/dismiss
 * Mark one or more notifications (activities) as dismissed for the current user.
 * Body: { activityIds: string[] }
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

    const body = await req.json();
    const activityIds = Array.isArray(body?.activityIds) ? body.activityIds as string[] : [];
    if (activityIds.length === 0) {
      return NextResponse.json({ ok: true, dismissed: 0 });
    }

    await prisma.userNotificationDismissal.createMany({
      data: activityIds.map((activityId) => ({
        userId: ctx.user.id,
        organizationId: orgId,
        activityId,
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({ ok: true, dismissed: activityIds.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error dismissing notifications:", error);
    return NextResponse.json(
      { error: "Failed to dismiss notifications", message },
      { status: 500 }
    );
  }
}
