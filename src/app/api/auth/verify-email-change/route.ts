import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/auth/verify-email-change?token=xxx
 * Verifies the token from the email link and updates the user's email to the new one.
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.redirect(
        new URL("/auth/login?error=InvalidToken", req.url)
      );
    }

    const record = await prisma.emailChangeRequest.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!record) {
      return NextResponse.redirect(
        new URL("/auth/login?error=InvalidToken", req.url)
      );
    }

    if (record.expires < new Date()) {
      await prisma.emailChangeRequest.delete({ where: { token } }).catch(() => {});
      return NextResponse.redirect(
        new URL("/auth/login?error=TokenExpired", req.url)
      );
    }

    // Check new email is not taken by another user
    const existing = await prisma.user.findUnique({
      where: { email: record.newEmail },
    });
    if (existing && existing.id !== record.userId) {
      await prisma.emailChangeRequest.delete({ where: { token } }).catch(() => {});
      return NextResponse.redirect(
        new URL("/auth/login?error=EmailTaken", req.url)
      );
    }

    // Update user email and set emailVerified
    await prisma.user.update({
      where: { id: record.userId },
      data: {
        email: record.newEmail,
        emailVerified: new Date(),
      },
    });

    await prisma.emailChangeRequest.delete({ where: { token } });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
    return NextResponse.redirect(
      new URL("/auth/?emailChanged=true", baseUrl)
    );
  } catch (error) {
    console.error("verify-email-change error", error);
    return NextResponse.redirect(
      new URL("/auth/login?error=VerificationFailed", req.url)
    );
  }
}
