/**
 * Claim issuer for an issue that has no issuer recorded (e.g. created before issuer column existed).
 * Only allows setting issuer when current value is NULL; the current user becomes the issuer.
 */

import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { getTenantClient } from "@/lib/db/tenant-pool";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; processId: string; issueId: string }> }
) {
  let client;
  try {
    const { orgId, processId, issueId } = await params;

    const ctx = await getRequestContext(req, orgId);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!orgId || !processId || !issueId) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    client = await getTenantClient(orgId);

    // Ensure issuer column exists (tenant may not have run migration 011)
    await client.query(
      `ALTER TABLE "issues" ADD COLUMN IF NOT EXISTS "issuer" TEXT, ADD COLUMN IF NOT EXISTS "verifier" TEXT`
    );

    // Update issuer only when currently NULL (one-time claim)
    const result = await client.query(
      `UPDATE issues
       SET issuer = $1, "updatedAt" = NOW()
       WHERE id = $2 AND "processId" = $3 AND (issuer IS NULL OR issuer = '')
       RETURNING id, title, status, issuer`,
      [ctx.user.id, issueId, processId]
    );

    if (result.rowCount === 0) {
      // Issue may already have an issuer (e.g. GET returned null due to fallback query)
      const existing = await client.query(
        `SELECT id, issuer FROM issues WHERE id = $1 AND "processId" = $2`,
        [issueId, processId]
      );
      client.release();
      if (existing.rows.length === 0) {
        return NextResponse.json(
          { error: "Issue not found." },
          { status: 404 }
        );
      }
      const existingIssuer = existing.rows[0].issuer;
      const existingId = existingIssuer != null ? String(existingIssuer).trim() : '';
      const userId = ctx.user.id != null ? String(ctx.user.id).trim() : '';
      if (existingId !== '' && existingId === userId) {
        return NextResponse.json({
          issue: { id: issueId, issuer: userId },
          message: "You are already the issuer.",
        });
      }
      return NextResponse.json(
        {
          error:
            "This issue already has an issuer recorded. Only the user who created the issue can verify it.",
        },
        { status: 403 }
      );
    }

    client.release();
    const issue = result.rows[0];
    return NextResponse.json({
      issue: { ...issue, issuer: issue.issuer != null ? String(issue.issuer) : null },
      message: "Issuer recorded.",
    });
  } catch (e: any) {
    if (client) try { client.release(); } catch (_) { /* already released */ }
    console.error("claim-issuer error:", e);
    return NextResponse.json(
      { error: "Failed to claim issuer", message: e?.message },
      { status: 500 }
    );
  }
}
