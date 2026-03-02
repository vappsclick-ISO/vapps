import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { withTenantConnection } from "@/lib/db/connection-helper";

/**
 * GET /api/organization/[orgId]/audit/plans/[planId]/findings
 * Get saved checklist findings for this audit plan.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; planId: string }> }
) {
  try {
    const { orgId, planId } = await params;
    const ctx = await getRequestContext(req, orgId);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connectionString = ctx.tenant.connectionString;
    if (!connectionString) {
      return NextResponse.json({ error: "Tenant database not found" }, { status: 404 });
    }

    const findings: any[] = [];

    await withTenantConnection(connectionString, async (client) => {
      const tableCheck = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_plan_findings'`
      );
      if (tableCheck.rows.length === 0) return;

      const colRes = await client.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'audit_plan_findings'
           AND column_name IN (
             'statement_of_nonconformity',
             'risk_severity',
             'risk_justification',
             'justification_for_classification',
             'objective_evidence'
           )`
      );
      const cols = new Set<string>(colRes.rows.map((r: { column_name: string }) => r.column_name));
      const hasStatement = cols.has("statement_of_nonconformity");
      const hasRiskSeverity = cols.has("risk_severity");
      const hasRiskJustification = cols.has("risk_justification");
      const hasJustificationForClassification = cols.has("justification_for_classification");
      const hasObjectiveEvidence = cols.has("objective_evidence");

      const extraSelect = [
        hasStatement ? "statement_of_nonconformity" : null,
        hasRiskSeverity ? "risk_severity" : null,
        hasRiskJustification ? "risk_justification" : null,
        hasJustificationForClassification ? "justification_for_classification" : null,
        hasObjectiveEvidence ? "objective_evidence" : null,
      ].filter(Boolean).join(", ");
      const extraSelectClause = extraSelect ? `, ${extraSelect}` : "";

      const result = await client.query(
        `SELECT id, row_index, standard, clause, subclauses, requirement, question, evidence_example, evidence_seen, status${extraSelectClause}
         FROM audit_plan_findings WHERE audit_plan_id = $1 ORDER BY row_index`,
        [planId]
      );
      for (const row of result.rows) {
        findings.push({
          id: row.id,
          rowIndex: row.row_index,
          standard: row.standard,
          clause: row.clause,
          subclauses: row.subclauses,
          requirement: row.requirement,
          question: row.question,
          evidenceExample: row.evidence_example,
          evidenceSeen: row.evidence_seen,
          status: row.status,
          statementOfNonconformity: hasStatement ? (row.statement_of_nonconformity ?? undefined) : undefined,
          riskSeverity: hasRiskSeverity ? (row.risk_severity ?? undefined) : undefined,
          riskJustification: hasRiskJustification ? (row.risk_justification ?? "") : "",
          justificationForClassification: hasJustificationForClassification ? (row.justification_for_classification ?? "") : "",
          objectiveEvidence: hasObjectiveEvidence ? (row.objective_evidence ?? null) : null,
        });
      }
    });

    const res = NextResponse.json({ findings });
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.headers.set("Pragma", "no-cache");
    return res;
  } catch (error) {
    console.error("Error fetching findings:", error);
    return NextResponse.json(
      { error: "Failed to fetch findings" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/organization/[orgId]/audit/plans/[planId]/findings
 * Save checklist findings (Step 3). Body: { findings: Array<{ standard, clause, subclauses, requirement, question, evidenceExample, evidenceSeen, status }> }
 * Replaces all findings for this plan.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; planId: string }> }
) {
  try {
    const { orgId, planId } = await params;
    const ctx = await getRequestContext(req, orgId);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connectionString = ctx.tenant.connectionString;
    if (!connectionString) {
      return NextResponse.json({ error: "Tenant database not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const findings: any[] = Array.isArray(body.findings) ? body.findings : [];

    await withTenantConnection(connectionString, async (client) => {
      const tableCheck = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_plan_findings'`
      );
      if (tableCheck.rows.length === 0) {
        throw new Error("audit_plan_findings table does not exist. Run tenant migration 014.");
      }

      await client.query(`DELETE FROM audit_plan_findings WHERE audit_plan_id = $1`, [planId]);

      const colRes = await client.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'audit_plan_findings'
           AND column_name IN (
             'statement_of_nonconformity',
             'risk_severity',
             'risk_justification',
             'justification_for_classification',
             'objective_evidence'
           )`
      );
      const cols = new Set<string>(colRes.rows.map((r: { column_name: string }) => r.column_name));
      const hasStatement = cols.has("statement_of_nonconformity");
      const hasRiskSeverity = cols.has("risk_severity");
      const hasRiskJustification = cols.has("risk_justification");
      const hasJustificationForClassification = cols.has("justification_for_classification");
      const hasObjectiveEvidence = cols.has("objective_evidence");

      for (let i = 0; i < findings.length; i++) {
        const f = findings[i];
        const columns = [
          "audit_plan_id",
          "row_index",
          "standard",
          "clause",
          "subclauses",
          "requirement",
          "question",
          "evidence_example",
          "evidence_seen",
          "status",
          hasStatement ? "statement_of_nonconformity" : null,
          hasRiskSeverity ? "risk_severity" : null,
          hasRiskJustification ? "risk_justification" : null,
          hasJustificationForClassification ? "justification_for_classification" : null,
          hasObjectiveEvidence ? "objective_evidence" : null,
        ].filter(Boolean) as string[];

        const values: any[] = [
          planId,
          i,
          f.standard ?? null,
          f.clause ?? null,
          f.subclauses ?? null,
          f.requirement ?? null,
          f.question ?? null,
          f.evidenceExample ?? f.evidence_example ?? null,
          f.evidenceSeen ?? f.evidence_seen ?? null,
          f.status ?? "not_audited",
        ];

        if (hasStatement) values.push(f.statementOfNonconformity ?? f.statement_of_nonconformity ?? null);
        if (hasRiskSeverity) values.push(f.riskSeverity ?? f.risk_severity ?? null);
        if (hasRiskJustification) values.push(f.riskJustification ?? f.risk_justification ?? null);
        if (hasJustificationForClassification) values.push(f.justificationForClassification ?? f.justification_for_classification ?? null);
        if (hasObjectiveEvidence) {
          const raw = f.objectiveEvidence ?? f.objective_evidence ?? null;
          values.push(raw != null && typeof raw === "object" ? JSON.stringify(raw) : raw);
        }

        const placeholders = values.map((_, idx) => `$${idx + 1}`).join(", ");
        try {
          await client.query(
            `INSERT INTO audit_plan_findings (${columns.join(", ")}) VALUES (${placeholders})`,
            values
          );
        } catch (insertErr: any) {
          (insertErr as any).rowIndex = i;
          (insertErr as any).columnCount = columns.length;
          (insertErr as any).valueCount = values.length;
          throw insertErr;
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    const message = error?.message ?? "Failed to save findings";
    const detail = error?.detail ?? null;
    console.error("Error saving findings:", message, detail ?? "", error);
    return NextResponse.json(
      { error: message, detail: detail ?? undefined },
      { status: 500 }
    );
  }
}
