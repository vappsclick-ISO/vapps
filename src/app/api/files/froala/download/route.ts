import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "@/lib/s3";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const key = new URL(req.url).searchParams.get("key");

    if (!key) {
      return NextResponse.json({ error: "Missing key" }, { status: 400 });
    }

    const signedUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: key,
      }),
      { expiresIn: 60 }
    );

    return NextResponse.redirect(signedUrl);
  } catch {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
}
