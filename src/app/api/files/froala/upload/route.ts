import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { uploadFileToS3 } from "@/lib/s3";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop()!;
    const key = `froala/${uuid()}.${ext}`;

    await uploadFileToS3(buffer, key, file.type);

    // Froala requires 'link'
    return NextResponse.json({
      link: `/api/files/froala/download?key=${encodeURIComponent(key)}`,
    });
  } catch (err: any) {
    console.error("[Froala Upload Error]:", err);
    return NextResponse.json({ error: err.message || "Upload failed" }, { status: 500 });
  }
}
