import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getCurrentUser } from "@/lib/get-server-session";
import { prisma } from "@/lib/prisma";
import { sendEmailChangeVerification } from "@/helpers/mailer";

const profileSelect = {
  id: true,
  name: true,
  email: true,
  image: true,
  phone: true,
  location: true,
  bio: true,
  jobTitle: true,
  department: true,
  employeeId: true,
  reportsTo: true,
  joinDate: true,
  createdAt: true,
} as const;

/**
 * GET /api/user/profile
 * Returns the current user's profile.
 */
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: profileSelect,
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...user,
      joinDate: user.joinDate?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/user/profile
 * Updates the current user's profile. Body can include: name, email, phone, location, bio, jobTitle, department, employeeId, reportsTo, joinDate.
 * If email is changed to a new address, a verification email is sent to the new address; the DB email is only updated after the user confirms via the link.
 */
export async function PATCH(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { email: true, ...profileSelect },
    });
    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const {
      name,
      email,
      phone,
      location,
      bio,
      jobTitle,
      department,
      employeeId,
      reportsTo,
      joinDate,
    } = body;

    const newEmail = typeof email === "string" ? email.trim() || null : null;
    const isEmailChange =
      newEmail !== null &&
      newEmail !== (existingUser.email ?? null) &&
      newEmail.length > 0;

    let emailVerificationSent = false;

    if (isEmailChange) {
      const other = await prisma.user.findUnique({
        where: { email: newEmail },
      });
      if (other && other.id !== currentUser.id) {
        return NextResponse.json(
          { error: "This email is already in use by another account." },
          { status: 400 }
        );
      }
      const token = randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await prisma.emailChangeRequest.deleteMany({
        where: { userId: currentUser.id },
      });
      await prisma.emailChangeRequest.create({
        data: {
          userId: currentUser.id,
          newEmail,
          token,
          expires,
        },
      });
      await sendEmailChangeVerification({ newEmail, token });
      emailVerificationSent = true;
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = typeof name === "string" ? name.trim() || null : null;
    if (!isEmailChange && email !== undefined) data.email = newEmail;
    if (phone !== undefined) data.phone = typeof phone === "string" ? phone.trim() || null : null;
    if (location !== undefined) data.location = typeof location === "string" ? location.trim() || null : null;
    if (bio !== undefined) data.bio = typeof bio === "string" ? bio.trim() || null : null;
    if (jobTitle !== undefined) data.jobTitle = typeof jobTitle === "string" ? jobTitle.trim() || null : null;
    if (department !== undefined) data.department = typeof department === "string" ? department.trim() || null : null;
    if (employeeId !== undefined) data.employeeId = typeof employeeId === "string" ? employeeId.trim() || null : null;
    if (reportsTo !== undefined) data.reportsTo = typeof reportsTo === "string" ? reportsTo.trim() || null : null;
    if (joinDate !== undefined) {
      data.joinDate = joinDate === null || joinDate === "" ? null : new Date(joinDate);
    }

    const user = await prisma.user.update({
      where: { id: currentUser.id },
      data,
      select: profileSelect,
    });

    return NextResponse.json({
      ...user,
      joinDate: user.joinDate?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      ...(emailVerificationSent && {
        emailVerificationSent: true,
        message: `Verification email sent to ${newEmail}. Your email will update after you confirm.`,
      }),
    });
  } catch (error: unknown) {
    console.error("Error updating profile:", error);
    const message = error instanceof Error ? error.message : "";
    const hint =
      message && (message.includes("column") || message.includes("Unknown field"))
        ? " Run: npx prisma migrate deploy && npx prisma generate"
        : "";
    return NextResponse.json(
      { error: "Failed to update profile." + hint },
      { status: 500 }
    );
  }
}
