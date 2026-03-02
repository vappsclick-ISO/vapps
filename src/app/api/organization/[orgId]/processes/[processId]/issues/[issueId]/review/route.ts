import { NextRequest, NextResponse } from "next/server";
import { getTenantClient } from "@/lib/db/tenant";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; processId: string; issueId: string }> }
) {
  let client;
  try {
    // Ensure params are resolved
    const resolvedParams = await params;
    console.log("[Review POST] Resolved params:", JSON.stringify(resolvedParams));
    
    if (!resolvedParams) {
      return NextResponse.json(
        { error: "Failed to resolve route parameters" },
        { status: 400 }
      );
    }
    
    const { orgId, processId, issueId } = resolvedParams;
    
    if (!orgId || !processId || !issueId) {
      console.error("[Review POST] Missing params:", { orgId, processId, issueId, resolvedParams });
      return NextResponse.json(
        { error: `Missing required parameters. Received: ${JSON.stringify(resolvedParams)}` },
        { status: 400 }
      );
    }
    
    console.log("[Review POST] Using params:", { orgId, processId, issueId });
    
    const body = await req.json();

    const { containmentText, rootCauseText, containmentFiles, rootCauseFiles, actionPlans } = body;

    // Get tenant database client
    const client = await getTenantClient(orgId);

    // Insert or update review data (upsert)
    await client.query(
      `INSERT INTO "issue_reviews" (
        "id", "issueId", "containmentText", "rootCauseText", 
        "containmentFiles", "rootCauseFiles", "actionPlans", 
        "submittedAt", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, NOW(), NOW(), NOW()
      )
      ON CONFLICT ("issueId") 
      DO UPDATE SET
        "containmentText" = EXCLUDED."containmentText",
        "rootCauseText" = EXCLUDED."rootCauseText",
        "containmentFiles" = EXCLUDED."containmentFiles",
        "rootCauseFiles" = EXCLUDED."rootCauseFiles",
        "actionPlans" = EXCLUDED."actionPlans",
        "submittedAt" = NOW(),
        "updatedAt" = NOW()`,
      [
        issueId,
        containmentText || null,
        rootCauseText || null,
        JSON.stringify(containmentFiles || []),
        JSON.stringify(rootCauseFiles || []),
        JSON.stringify(actionPlans || []),
      ]
    );

    await client.end();

    return NextResponse.json({
      message: "Review data saved successfully",
    });
  } catch (error: any) {
    console.error("Error saving review data:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save review data" },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; processId: string; issueId: string }> }
) {
  let client;
  try {
    // Ensure params are resolved
    const resolvedParams = await params;
    console.log("[Review GET] Resolved params:", JSON.stringify(resolvedParams));
    
    if (!resolvedParams) {
      return NextResponse.json(
        { error: "Failed to resolve route parameters" },
        { status: 400 }
      );
    }
    
    const { orgId, issueId } = resolvedParams;
    
    if (!orgId || !issueId) {
      console.error("[Review GET] Missing params:", { orgId, issueId, resolvedParams });
      return NextResponse.json(
        { error: `Missing required parameters. Received: ${JSON.stringify(resolvedParams)}` },
        { status: 400 }
      );
    }
    
    console.log("[Review GET] Using params:", { orgId, issueId });

    // Get tenant database client
    const client = await getTenantClient(orgId);

    // Fetch review data for this issue
    const result = await client.query(
      `SELECT * FROM "issue_reviews" WHERE "issueId" = $1`,
      [issueId]
    );

    await client.end();

    if (result.rows.length === 0) {
      return NextResponse.json({ review: null });
    }

    const review = result.rows[0];
    
    // Parse JSON strings back to arrays/objects
    try {
      if (review.containmentFiles && typeof review.containmentFiles === 'string') {
        review.containmentFiles = JSON.parse(review.containmentFiles);
      }
      if (review.rootCauseFiles && typeof review.rootCauseFiles === 'string') {
        review.rootCauseFiles = JSON.parse(review.rootCauseFiles);
      }
      if (review.actionPlans && typeof review.actionPlans === 'string') {
        review.actionPlans = JSON.parse(review.actionPlans);
      }
    } catch (parseError) {
      console.error("[Review GET] Error parsing JSON fields:", parseError);
      // If parsing fails, set to empty arrays
      review.containmentFiles = [];
      review.rootCauseFiles = [];
      review.actionPlans = [];
    }

    return NextResponse.json({ review });
  } catch (error: any) {
    console.error("Error fetching review data:", error);
    if (client) {
      try {
        await client.end();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    return NextResponse.json(
      { error: error.message || "Failed to fetch review data" },
      { status: 500 }
    );
  }
}
