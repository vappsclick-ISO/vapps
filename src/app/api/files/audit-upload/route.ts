import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { uploadFileToS3 } from "@/lib/s3";
import { getCurrentUser } from "@/lib/get-server-session";

export const runtime = "nodejs";

/**
 * POST /api/files/audit-upload
 * Upload a file to S3 under audit-documents/{orgId}/{auditPlanId}/step-{step}/
 * FormData: file (required), orgId, auditPlanId, step, [fileType]
 * Used by audit workflow steps 3, 4, 5 (and Froala in step 4).
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const orgId = (formData.get("orgId") as string) || (req.nextUrl.searchParams.get("orgId") as string);
    const auditPlanId = (formData.get("auditPlanId") as string) || (req.nextUrl.searchParams.get("auditPlanId") as string);
    const step = (formData.get("step") as string) || (req.nextUrl.searchParams.get("step") as string);
    const fileType = formData.get("fileType") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop() || "bin";
    const sanitized = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const unique = `${uuid().slice(0, 8)}-${sanitized}`;

    const prefix = "audit-documents";
    const pathParts = [prefix, orgId || "unknown", auditPlanId || "draft", `step-${step || "0"}`, unique];
    const key = pathParts.join("/");

    await uploadFileToS3(buffer, key, file.type);

    const link = `/api/files/download?key=${encodeURIComponent(key)}`;
    return NextResponse.json({
      success: true,
      link,
      key,
      name: file.name,
      size: file.size,
      type: file.type,
      url: `s3://${process.env.AWS_S3_BUCKET_NAME}/${key}`,
    });
  } catch (err: any) {
    console.error("[Audit Upload Error]:", err);
    return NextResponse.json({ error: err.message || "Upload failed" }, { status: 500 });
  }
}
