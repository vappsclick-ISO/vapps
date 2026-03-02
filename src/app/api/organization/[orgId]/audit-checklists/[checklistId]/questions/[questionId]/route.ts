import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { withTenantConnection } from "@/lib/db/connection-helper";

/**
 * PATCH /api/organization/[orgId]/audit-checklists/[checklistId]/questions/[questionId]
 * Update a question. Body: { clause?, subclause?, requirement?, question?, evidenceExample?, sortOrder? }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; checklistId: string; questionId: string }> }
) {
  try {
    const { orgId, checklistId, questionId } = await params;
    const ctx = await getRequestContext(req, orgId);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connectionString = ctx.tenant.connectionString;
    if (!connectionString) {
      return NextResponse.json({ error: "Tenant database not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (body.clause !== undefined) {
      updates.push(`clause = $${idx++}`);
      values.push((body.clause ?? "").trim());
    }
    if (body.subclause !== undefined) {
      updates.push(`subclause = $${idx++}`);
      values.push((body.subclause ?? "").trim());
    }
    if (body.requirement !== undefined) {
      updates.push(`requirement = $${idx++}`);
      values.push((body.requirement ?? "").trim());
    }
    if (body.question !== undefined) {
      updates.push(`question = $${idx++}`);
      values.push((body.question ?? "").trim());
    }
    if (body.evidenceExample !== undefined) {
      updates.push(`evidence_example = $${idx++}`);
      values.push((body.evidenceExample ?? "").trim());
    }
    if (body.evidence_example !== undefined) {
      updates.push(`evidence_example = $${idx++}`);
      values.push((body.evidence_example ?? "").trim());
    }
    if (typeof body.sortOrder === "number") {
      updates.push(`sort_order = $${idx++}`);
      values.push(body.sortOrder);
    }
    if (typeof body.sort_order === "number") {
      updates.push(`sort_order = $${idx++}`);
      values.push(body.sort_order);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    updates.push(`updated_at = now()`);
    values.push(questionId, checklistId);

    await withTenantConnection(connectionString, async (client) => {
      const result = await client.query(
        `UPDATE audit_checklist_questions
         SET ${updates.join(", ")}
         WHERE id = $${idx} AND audit_checklist_id = $${idx + 1}`,
        values
      );
      if (result.rowCount === 0) {
        throw new Error("Question not found");
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update question";
    if (message === "Question not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error("Error updating checklist question:", error);
    return NextResponse.json(
      { error: "Failed to update question" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/organization/[orgId]/audit-checklists/[checklistId]/questions/[questionId]
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; checklistId: string; questionId: string }> }
) {
  try {
    const { orgId, checklistId, questionId } = await params;
    const ctx = await getRequestContext(_req, orgId);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connectionString = ctx.tenant.connectionString;
    if (!connectionString) {
      return NextResponse.json({ error: "Tenant database not found" }, { status: 404 });
    }

    await withTenantConnection(connectionString, async (client) => {
      const result = await client.query(
        `DELETE FROM audit_checklist_questions WHERE id = $1 AND audit_checklist_id = $2 RETURNING id`,
        [questionId, checklistId]
      );
      if (result.rowCount === 0) {
        throw new Error("Question not found");
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete question";
    if (message === "Question not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error("Error deleting checklist question:", error);
    return NextResponse.json(
      { error: "Failed to delete question" },
      { status: 500 }
    );
  }
}
