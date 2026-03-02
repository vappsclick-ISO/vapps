import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";

import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/schemas/auth/auth.schema";
import { sendVerificationEmail } from "@/helpers/mailer";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    // Get inviteToken from raw body (it's optional and may not be in schema)
    const inviteToken = (body as any).inviteToken;

    const exists = await prisma.user.findUnique({
      where: { email },
    });

    if (exists) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // ✅ Create user (unverified)
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
      },
    });

    // ✅ Create verification token
    const token = crypto.randomUUID();
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h

    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token,
        expires,
      },
    });

    // ✅ Send verification email
    await sendVerificationEmail({
      email,
      token,
    });

    // ✅ If inviteToken is provided, auto-accept the invite after registration
    let inviteAccepted = false;
    if (inviteToken) {
      try {
        // Verify invite exists and matches email
        const invite = await prisma.invitation.findUnique({
          where: { token: inviteToken },
          include: {
            organization: {
              include: { database: true },
            },
          },
        });

        if (invite && invite.email.toLowerCase() === email.toLowerCase() && invite.status === "pending") {
          // Auto-verify email for invited users (skip email verification step)
          await prisma.user.update({
            where: { id: user.id },
            data: { emailVerified: new Date() },
          });

          // Accept invite will be handled by the frontend after login
          inviteAccepted = true;
          logger.info("User registered with invite token", {
            userId: user.id,
            inviteId: invite.id,
            email,
          });
        }
      } catch (inviteError) {
        // Log but don't fail registration if invite acceptance fails
        logger.error("Failed to auto-accept invite during registration", inviteError, {
          userId: user.id,
          inviteToken,
        });
      }
    }

    return NextResponse.json(
      {
        message: inviteAccepted
          ? "Registration successful. You can now log in and your invitation will be accepted automatically."
          : "Registration successful. Please verify your email before logging in.",
        inviteAccepted,
        inviteToken: inviteAccepted ? inviteToken : undefined,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error("Registration error", error);
    return NextResponse.json(
      { error: "Failed to register user" },
      { status: 500 }
    );
  }
}
