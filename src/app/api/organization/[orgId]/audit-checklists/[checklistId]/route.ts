import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { withTenantConnection } from "@/lib/db/connection-helper";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; checklistId: string }> }
) {
  try {
    const { orgId, checklistId } = await params;
    const ctx = await getRequestContext(_req, orgId);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connectionString = ctx.tenant.connectionString;
    if (!connectionString) {
      return NextResponse.json({ error: "Tenant database not found" }, { status: 404 });
    }

    let checklist: {
      id: string;
      name: string;
      questions: Array<{
        id: string;
        clause: string;
        subclause: string;
        requirement: string;
        question: string;
        evidenceExample: string;
        sortOrder: number;
      }>;
    } | null = null;

    await withTenantConnection(connectionString, async (client) => {
      const listCheck = await client.query(
        `SELECT id, name FROM audit_checklists WHERE id = $1`,
        [checklistId]
      );
      const row = listCheck.rows[0];
      if (!row) return;

      const questionsResult = await client.query(
        `SELECT id, clause, subclause, requirement, question, evidence_example, sort_order
         FROM audit_checklist_questions
         WHERE audit_checklist_id = $1
         ORDER BY sort_order, clause, subclause`,
        [checklistId]
      );

      checklist = {
        id: row.id,
        name: row.name ?? "",
        questions: questionsResult.rows.map((q) => ({
          id: q.id,
          clause: q.clause ?? "",
          subclause: q.subclause ?? "",
          requirement: q.requirement ?? "",
          question: q.question ?? "",
          evidenceExample: q.evidence_example ?? "",
          sortOrder: q.sort_order ?? 0,
        })),
      };
    });

    if (!checklist) {
      return NextResponse.json({ error: "Checklist not found" }, { status: 404 });
    }
    return NextResponse.json({ checklist });
  } catch (error) {
    console.error("Error fetching audit checklist:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit checklist" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; checklistId: string }> }
) {
  try {
    const { orgId, checklistId } = await params;
    const ctx = await getRequestContext(req, orgId);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connectionString = ctx.tenant.connectionString;
    if (!connectionString) {
      return NextResponse.json({ error: "Tenant database not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const name = (body.name ?? body.title ?? "").trim();
    if (!name) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    await withTenantConnection(connectionString, async (client) => {
      const result = await client.query(
        `UPDATE audit_checklists SET name = $1, updated_at = now() WHERE id = $2 RETURNING id, name`,
        [name, checklistId]
      );
      if (result.rowCount === 0) {
        throw new Error("Checklist not found");
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update audit checklist";
    if (message === "Checklist not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error("Error updating audit checklist:", error);
    return NextResponse.json(
      { error: "Failed to update audit checklist" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; checklistId: string }> }
) {
  try {
    const { orgId, checklistId } = await params;
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
        `DELETE FROM audit_checklists WHERE id = $1 RETURNING id`,
        [checklistId]
      );
      if (result.rowCount === 0) {
        throw new Error("Checklist not found");
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete audit checklist";
    if (message === "Checklist not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error("Error deleting audit checklist:", error);
    return NextResponse.json(
      { error: "Failed to delete audit checklist" },
      { status: 500 }
    );
  }
}
