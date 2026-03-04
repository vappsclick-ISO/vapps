import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Base URL for redirects (avoids 0.0.0.0 on EC2/behind proxy when req.url is internal)
const getRedirectBase = () =>
  process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    const base = getRedirectBase();

    if (!token) {
      return NextResponse.redirect(new URL("/auth/login?error=InvalidToken", base));
    }

    const record = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!record || record.expires < new Date()) {
      return NextResponse.redirect(new URL("/auth/login?error=TokenExpired", base));
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

    return NextResponse.redirect(new URL("/auth/?verified=true", base));
  } catch (error) {
    console.error("VERIFY_EMAIL_ERROR", error);
    return NextResponse.redirect(new URL("/auth/?error=VerificationFailed", getRedirectBase()));
  }
}
