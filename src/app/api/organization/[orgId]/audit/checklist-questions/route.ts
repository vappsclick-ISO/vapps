import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { withTenantConnection } from "@/lib/db/connection-helper";
import { CRITERIA_TO_CHECKLIST_KEY, PROGRAM_CRITERIA_TO_CHECKLIST_KEY } from "@/lib/audit-checklists";
import iso9001Questions from "@/lib/audit-checklists/iso-9001.json";
import iso14001Questions from "@/lib/audit-checklists/iso-14001.json";
import iso45001Questions from "@/lib/audit-checklists/iso-45001.json";
import iso27001Questions from "@/lib/audit-checklists/iso-27001.json";
import iatf16949Questions from "@/lib/audit-checklists/iatf-16949.json";

type ChecklistItem = {
  clause: string;
  subclause: string;
  requirement: string;
  question: string;
  evidenceExample: string;
};

const CHECKLIST_BY_KEY: Record<string, ChecklistItem[]> = {
  "iso-9001": iso9001Questions as ChecklistItem[],
  "iso-14001": iso14001Questions as ChecklistItem[],
  "iso-45001": iso45001Questions as ChecklistItem[],
  "iso-27001": iso27001Questions as ChecklistItem[],
  "iatf-16949": iatf16949Questions as ChecklistItem[],
};

/**
 * GET /api/organization/[orgId]/audit/checklist-questions
 * Query: ?checklistId=uuid  (from DB)  OR  ?criteria=...  OR  ?programCriteria=...
 * When checklistId is provided, returns questions from org's audit_checklist_questions.
 * Otherwise uses legacy criteria/programCriteria -> static JSON.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const ctx = await getRequestContext(req, orgId);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const checklistId = searchParams.get("checklistId")?.trim();
    const criteria = searchParams.get("criteria")?.trim();
    const programCriteria = searchParams.get("programCriteria")?.trim();

    if (checklistId) {
      const connectionString = ctx.tenant.connectionString;
      if (!connectionString) {
        return NextResponse.json({ error: "Tenant database not found" }, { status: 404 });
      }
      const questions: ChecklistItem[] = [];
      await withTenantConnection(connectionString, async (client) => {
        const tableCheck = await client.query(
          `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_checklist_questions'`
        );
        if (tableCheck.rows.length === 0) return;
        const result = await client.query(
          `SELECT clause, subclause, requirement, question, evidence_example
           FROM audit_checklist_questions
           WHERE audit_checklist_id = $1
           ORDER BY sort_order, clause, subclause`,
          [checklistId]
        );
        for (const r of result.rows) {
          questions.push({
            clause: r.clause ?? "",
            subclause: r.subclause ?? "",
            requirement: r.requirement ?? "",
            question: r.question ?? "",
            evidenceExample: r.evidence_example ?? "",
          });
        }
      });
      return NextResponse.json({
        questions,
        checklistId,
        criteria: null,
        checklistKey: null,
      });
    }

    let checklistKey: string | null = null;
    if (criteria) {
      checklistKey = CRITERIA_TO_CHECKLIST_KEY[criteria] ?? null;
    }
    if (!checklistKey && programCriteria) {
      checklistKey = PROGRAM_CRITERIA_TO_CHECKLIST_KEY[programCriteria] ?? null;
    }

    if (!checklistKey) {
      return NextResponse.json({
        questions: [],
        criteria: criteria ?? programCriteria ?? null,
        checklistKey: null,
        message: criteria || programCriteria ? "No predefined questions for this criteria." : "Provide criteria, programCriteria, or checklistId query param.",
      });
    }

    const questions = CHECKLIST_BY_KEY[checklistKey] ?? [];

    return NextResponse.json({
      questions,
      criteria: criteria ?? programCriteria,
      checklistKey,
    });
  } catch (error) {
    console.error("Error fetching checklist questions:", error);
    return NextResponse.json(
      { error: "Failed to fetch checklist questions" },
      { status: 500 }
    );
  }
}
