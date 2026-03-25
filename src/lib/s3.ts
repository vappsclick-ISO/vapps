/**
 * AWS S3 Utility Library
 * 
 * Provides secure file upload, download, and deletion functions for private S3 bucket.
 * All operations use IAM credentials from environment variables.
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { FileType } from "@/types/file";

// Validate environment variables
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.error("[S3] Missing AWS credentials. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in environment variables.");
}

if (!process.env.AWS_S3_BUCKET_NAME) {
  console.error("[S3] Missing AWS_S3_BUCKET_NAME. Please set this in environment variables.");
}

// Initialize S3 client with credentials from environment
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "eu-north-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Two buckets – you set TWO env vars so the app knows which bucket is which:
//   AWS_S3_BUCKET_NAME   = documents bucket (e.g. vapps-documents)  → avatars, Froala, issue uploads
//   AWS_S3_BUCKET_AUDIT  = audit bucket (e.g. vapp-uploads-prod)     → audit workflow uploads only
// Same AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION are used for both.
const BUCKET_DOCUMENTS = process.env.AWS_S3_BUCKET_NAME!;
const BUCKET_AUDIT = process.env.AWS_S3_BUCKET_AUDIT || BUCKET_DOCUMENTS; // fallback to documents if not set
const UPLOAD_FOLDER = process.env.AWS_S3_UPLOAD_FOLDER || "issue-reviews";

/** Keys under this prefix are in the audit bucket; all other keys are in the documents bucket. */
const AUDIT_KEY_PREFIX = "audit-documents/";

function getBucketForKey(key: string): string {
  return key.startsWith(AUDIT_KEY_PREFIX) ? BUCKET_AUDIT : BUCKET_DOCUMENTS;
}

/**
 * Generate a unique file key for S3 storage
 * Format: issue-reviews/{orgId}/{processId}/{issueId}/{timestamp}-{random}-{filename}
 */
export function generateFileKey(
  orgId: string,
  processId: string,
  issueId: string,
  fileName: string,
  fileType: FileType
) {
  return `${orgId}/${processId}/${issueId}/${fileType}/${fileName}`;
}

/**
 * Upload a file to S3
 * @param file - File buffer or stream
 * @param key - S3 object key (path)
 * @param contentType - MIME type of the file
 * @param options.useAuditBucket - If true, upload to audit bucket (vapp-uploads-prod). Otherwise use documents bucket (vapps-documents).
 * @returns S3 object key and URL metadata
 */
export async function uploadFileToS3(
  file: Buffer | Uint8Array,
  key: string,
  contentType: string,
  options?: { useAuditBucket?: boolean }
): Promise<{ key: string; url: string; size: number }> {
  const bucket = options?.useAuditBucket ? BUCKET_AUDIT : BUCKET_DOCUMENTS;
  if (!bucket) {
    throw new Error("AWS_S3_BUCKET_NAME (and optionally AWS_S3_BUCKET_AUDIT) must be set in environment variables.");
  }

  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error("AWS credentials are not set. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in your .env file.");
  }

  try {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file,
      ContentType: contentType,
      ServerSideEncryption: "AES256",
      Metadata: {
        uploadedAt: new Date().toISOString(),
      },
    });

    await s3Client.send(command);

    return {
      key,
      url: `s3://${bucket}/${key}`,
      size: file.length,
    };
  } catch (error: any) {
    console.error("[S3 Upload Error]:", error);
    if (error.name === "InvalidAccessKeyId" || error.name === "SignatureDoesNotMatch") {
      throw new Error("Invalid AWS credentials. Please check your AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.");
    } else if (error.name === "NoSuchBucket") {
      throw new Error(`S3 bucket "${bucket}" does not exist. Check AWS_S3_BUCKET_NAME / AWS_S3_BUCKET_AUDIT.`);
    } else if (error.name === "AccessDenied") {
      throw new Error(`Access denied to S3 bucket "${bucket}". Please check IAM permissions.`);
    } else if (error.$metadata?.httpStatusCode === 403) {
      throw new Error("Access forbidden. Please check your AWS IAM user has s3:PutObject permission.");
    }
    throw new Error(`Failed to upload file to S3: ${error.message || error.name || "Unknown error"}`);
  }
}

/**
 * Generate a presigned URL for secure file download
 * @param key - S3 object key
 * @param expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns Presigned URL that expires after specified time
 */
export async function getPresignedDownloadUrl(
  key: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<string> {
  const bucket = getBucketForKey(key);
  if (!bucket) {
    throw new Error("AWS_S3_BUCKET_NAME environment variable is not set");
  }

  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
  } catch (error: any) {
    console.error("[S3 Presigned URL Error]:", error);
    throw new Error(`Failed to generate presigned URL: ${error.message}`);
  }
}

/**
 * Check if a file exists in S3
 * @param key - S3 object key
 * @returns File metadata if exists, null otherwise
 */
export async function checkFileExists(key: string): Promise<{ size: number; contentType: string; lastModified: Date } | null> {
  const bucket = getBucketForKey(key);
  if (!bucket) {
    throw new Error("AWS_S3_BUCKET_NAME environment variable is not set");
  }

  try {
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await s3Client.send(command);
    
    return {
      size: response.ContentLength || 0,
      contentType: response.ContentType || "application/octet-stream",
      lastModified: response.LastModified || new Date(),
    };
  } catch (error: any) {
    if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
      return null;
    }
    console.error("[S3 Check File Error]:", error);
    throw new Error(`Failed to check file existence: ${error.message}`);
  }
}

/**
 * Delete a file from S3
 * @param key - S3 object key
 */
export async function deleteFileFromS3(key: string): Promise<void> {
  const bucket = getBucketForKey(key);
  if (!bucket) {
    throw new Error("AWS_S3_BUCKET_NAME environment variable is not set");
  }

  try {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await s3Client.send(command);
  } catch (error: any) {
    console.error("[S3 Delete Error]:", error);
    throw new Error(`Failed to delete file from S3: ${error.message}`);
  }
}

/**
 * Extract S3 key from URL or key string
 * Handles both s3:// URLs and plain keys
 */
export function extractS3Key(urlOrKey: string): string {
  if (urlOrKey.startsWith("s3://")) {
    // Extract key from s3://bucket/key format
    const parts = urlOrKey.replace("s3://", "").split("/");
    parts.shift(); // Remove bucket name
    return parts.join("/");
  }
  return urlOrKey;
}


export { s3Client as s3 };