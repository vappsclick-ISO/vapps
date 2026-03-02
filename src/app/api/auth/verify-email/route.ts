import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.redirect(new URL("/auth/login?error=InvalidToken", req.url));
    }

    const record = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!record || record.expires < new Date()) {
      return NextResponse.redirect(
        new URL("/auth/login?error=TokenExpired", req.url)
      );
    }

    // ✅ Verify user
    await prisma.user.update({
      where: { email: record.identifier },
      data: { emailVerified: new Date() },
    });

    // ✅ Remove token
    await prisma.verificationToken.delete({
      where: { token },
    });

    return NextResponse.redirect(
      new URL("/auth/?verified=true", req.url)
    );
  } catch (error) {
    console.error("VERIFY_EMAIL_ERROR", error);
    return NextResponse.redirect(
      new URL("/auth/?error=VerificationFailed", req.url)
    );
  }
}
