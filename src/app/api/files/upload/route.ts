import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { uploadFileToS3, generateFileKey } from "@/lib/s3";
import { getCurrentUser } from "@/lib/get-server-session";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const orgId = formData.get("orgId") as string | null;
    const processId = formData.get("processId") as string | null;
    const issueId = formData.get("issueId") as string | null;
    const fileType = formData.get("fileType") as string | null;

    console.log("[File Upload] Received:", { 
      fileName: file?.name, 
      orgId, 
      processId, 
      issueId, 
      fileType 
    });

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop();
    if (!ext) {
      return NextResponse.json({ error: "File has no extension" }, { status: 400 });
    }

    let key: string;
    let responseData: any;

    // Check if this is an issue review file upload (has orgId, processId, issueId, fileType)
    if (orgId && processId && issueId && fileType) {
      // Issue review file upload - use structured key
      const user = await getCurrentUser();
      if (!user || !user.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Validate fileType is one of the allowed types
      if (!["containment", "rootCause", "actionPlan"].includes(fileType)) {
        return NextResponse.json({ error: "Invalid fileType" }, { status: 400 });
      }

      // Generate structured key for issue review files
      const timestamp = Date.now();
      const randomId = uuid().split("-")[0];
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      key = generateFileKey(orgId, processId, issueId, `${timestamp}-${randomId}-${sanitizedFileName}`, fileType as any);

      await uploadFileToS3(buffer, key, file.type);

      // Return response in expected format for issue review files
      responseData = {
        success: true,
        file: {
          key,
          name: file.name,
          size: file.size,
          type: file.type,
          url: `s3://${process.env.AWS_S3_BUCKET_NAME}/${key}`,
        },
      };
    } else {
      // Froala editor file upload - use simple key
      key = `froala/${uuid()}.${ext}`;
      await uploadFileToS3(buffer, key, file.type);

      // Froala requires JSON with `link`
      responseData = {
        link: `/api/files/froala/download?key=${encodeURIComponent(key)}`,
      };
    }

    return NextResponse.json(responseData);
  } catch (err: any) {
    console.error("[File Upload Error]:", err);
    return NextResponse.json({ error: err.message || "Upload failed" }, { status: 500 });
  }
}
