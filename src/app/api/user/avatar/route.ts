import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-server-session";
import { prisma } from "@/lib/prisma";
import { getPresignedDownloadUrl } from "@/lib/s3";

/**
 * GET /api/user/avatar
 * Redirects to the current user's profile image (presigned S3 URL).
 * If user has no custom image, returns 404 (caller can show fallback).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return new NextResponse(null, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { image: true },
    });

    const key = dbUser?.image;
    if (!key || key.startsWith("http")) {
      // No S3 key (or image is an external URL from OAuth)
      return new NextResponse(null, { status: 404 });
    }

    const url = await getPresignedDownloadUrl(key, 3600);
    return NextResponse.redirect(url);
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
