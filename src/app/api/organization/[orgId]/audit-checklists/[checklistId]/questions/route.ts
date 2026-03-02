import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { withTenantConnection } from "@/lib/db/connection-helper";

export async function POST(
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
    const clause = (body.clause ?? "").trim();
    const subclause = (body.subclause ?? "").trim();
    const requirement = (body.requirement ?? "").trim();
    const question = (body.question ?? "").trim();
    const evidenceExample = (body.evidenceExample ?? body.evidence_example ?? "").trim();
    const sortOrder = typeof body.sortOrder === "number" ? body.sortOrder : (body.sort_order ?? 0);

    let questionRow: {
      id: string;
      clause: string;
      subclause: string;
      requirement: string;
      question: string;
      evidenceExample: string;
      sortOrder: number;
    } | null = null;

    await withTenantConnection(connectionString, async (client) => {
      const checklistCheck = await client.query(
        `SELECT id FROM audit_checklists WHERE id = $1`,
        [checklistId]
      );
      if (checklistCheck.rows.length === 0) {
        throw new Error("Checklist not found");
      }

      const insert = await client.query(
        `INSERT INTO audit_checklist_questions (audit_checklist_id, clause, subclause, requirement, question, evidence_example, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, clause, subclause, requirement, question, evidence_example, sort_order`,
        [checklistId, clause, subclause, requirement, question, evidenceExample, sortOrder]
      );
      const r = insert.rows[0];
      questionRow = {
        id: r.id,
        clause: r.clause ?? "",
        subclause: r.subclause ?? "",
        requirement: r.requirement ?? "",
        question: r.question ?? "",
        evidenceExample: r.evidence_example ?? "",
        sortOrder: r.sort_order ?? 0,
      };
    });

    return NextResponse.json({ question: questionRow });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to add question";
    if (message === "Checklist not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error("Error adding checklist question:", error);
    return NextResponse.json(
      { error: "Failed to add question" },
      { status: 500 }
    );
  }
}
