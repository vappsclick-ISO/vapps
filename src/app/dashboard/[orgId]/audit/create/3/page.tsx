"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useMemo, useRef, Fragment } from "react";
import { format } from "date-fns";
import AuditWorkflowHeader from "@/components/audit/AuditWorkflowHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import "froala-editor/css/froala_editor.pkgd.min.css";
import "froala-editor/css/froala_style.min.css";

const FroalaEditor = dynamic(() => import("react-froala-wysiwyg"), { ssr: false });
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bold,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Code,
  Download,
  Eye,
  FileText,
  Italic,
  Lock,
  Minus,
  Paperclip,
  Plus,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  Underline,
  Upload,
  UserCheck,
  X,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";

type ComplianceStatus =
  | "compliant"
  | "not_audited"
  | "major_nc"
  | "minor_nc"
  | "ofi"
  | "positive"
  | "na"
  | "missing";

interface ChecklistRow {
  id: string;
  standard: string;
  clause: string;
  subclauses: string;
  requirement: string;
  question: string;
  evidenceExample: string;
  evidence: string;
  status: ComplianceStatus;
  statementOfNonconformity?: string;
  riskSeverity?: "high" | "medium" | "low";
  riskJustification?: string;
  justificationForClassification?: string;
  objectiveEvidence?: ObjectiveEvidenceItem[] | null;
}

/** Checklist item for manual row search (clause/subclause → requirement, question, evidenceExample). */
interface ManualChecklistItem {
  clause: string;
  subclause: string;
  requirement: string;
  question: string;
  evidenceExample: string;
}

type ObjectiveEvidenceItem = {
  id: string;
  description: string;
  fileName: string;
  s3Key: string;
  effectiveness: "effective" | "ineffective";
};

function isTrulyEmptyFindingRow(row: {
  clause?: string | null;
  subclauses?: string | null;
  requirement?: string | null;
  question?: string | null;
  evidenceExample?: string | null;
  evidence?: string | null;
  status?: ComplianceStatus | null;
  statementOfNonconformity?: string | null;
  riskSeverity?: "high" | "medium" | "low" | null;
}): boolean {
  const textEmpty = (v: unknown) => (typeof v !== "string" ? true : v.trim() === "");
  const allCoreEmpty =
    textEmpty(row.clause) &&
    textEmpty(row.subclauses) &&
    textEmpty(row.requirement) &&
    textEmpty(row.question) &&
    textEmpty(row.evidenceExample);
  const noEvidence = textEmpty(row.evidence);
  const defaultStatus = (row.status ?? "not_audited") === "not_audited";
  const noCa = textEmpty(row.statementOfNonconformity) && (row.riskSeverity == null);
  return allCoreEmpty && noEvidence && defaultStatus && noCa;
}

/** Map audit criteria to standard display name (e.g. for checklist rows). */
const CRITERIA_TO_STANDARD: Record<string, string> = {
  "ISO 9001 QUALITY": "ISO 9001:2015",
  "ISO 14001 ENVIRONMENT": "ISO 14001:2015",
  "ISO 45001 HEALTH & SAFETY": "ISO 45001:2018",
  "ISO 27001 INFORMATION SECURITY": "ISO 27001:2022",
  "IATF 16949": "IATF 16949:2016",
  "ESG & SUSTAINABILITY (GRI / IFRS S1/S2)": "ESG / GRI / IFRS",
};

/** Map program audit criteria (Step 1) to checklist criteria for fetching questions. */
const PROGRAM_CRITERIA_TO_CHECKLIST: Record<string, string> = {
  iso: "ISO 9001 QUALITY",
  esg: "ESG & SUSTAINABILITY (GRI / IFRS S1/S2)",
  legal: "ISO 27001 INFORMATION SECURITY",
};

const LEGEND_ITEMS: { key: ComplianceStatus; label: string; className: string; icon?: "x" | "o" | "dash"; badge?: string }[] = [
  { key: "compliant", label: "COMPLIANT", className: "bg-green-500 text-white rounded-full", icon: "x" },
  { key: "not_audited", label: "NOT AUDITED", className: "bg-gray-300 text-gray-700 rounded-full", icon: "o" },
  { key: "major_nc", label: "MAJOR NONCONFORMANCE", className: "bg-red-600 text-white rounded-md", badge: "MA" },
  { key: "minor_nc", label: "MINOR NONCONFORMANCE", className: "bg-orange-500 text-white rounded-md", badge: "mi" },
  { key: "ofi", label: "OPPORTUNITY FOR IMPROVEMENT", className: "bg-blue-600 text-white rounded-md", badge: "OFI" },
  { key: "positive", label: "POSITIVE ASPECT", className: "bg-green-600 text-white rounded-md", badge: "PA" },
  { key: "na", label: "NOT APPLICABLE", className: "bg-gray-500 text-white rounded-md", badge: "NA" },
  { key: "missing", label: "MISSING REQUIRED", className: "border-2 border-dashed border-gray-400 bg-gray-100 text-gray-700 rounded-md", icon: "dash" },
];

/** Short status labels for checklist list (e.g. "1. Conformity", "2. Not Auditable") */
const STATUS_CHECKLIST_LABEL: Record<ComplianceStatus, string> = {
  compliant: "Conformity",
  not_audited: "Not Auditable",
  major_nc: "Major Nonconformity",
  minor_nc: "Minor Nonconformity",
  ofi: "OFI",
  positive: "Positive",
  na: "NA",
  missing: "Missing",
};

/** Empty compliance details — sections stay empty until user selects Document Finding (CA) for a question. */
const EMPTY_COMPLIANCE_DETAILS = {
  standard: "",
  clause: "",
  subclauses: "",
  requirement: "",
  question: "",
  evidenceExample: "",
  evidenceSeen: "",
};

/** Default empty evidence items for CA form reset. */
const DEFAULT_EVIDENCE_ITEMS: { id: string; description: string; fileName: string; s3Key: string; effectiveness: "effective" | "ineffective" }[] = [
  { id: "ev-1", description: "", fileName: "", s3Key: "", effectiveness: "effective" },
  { id: "ev-2", description: "", fileName: "", s3Key: "", effectiveness: "effective" },
];

export default function CreateAuditStep3Page() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const orgId = params?.orgId as string;
  const programIdFromUrl = searchParams.get("programId") ?? null;
  const criteriaFromUrl = searchParams.get("criteria") ?? null;
  const checklistIdFromUrl = searchParams.get("checklistId") ?? null;
  const auditPlanIdFromUrl = searchParams.get("auditPlanId") ?? null;
  const step3IndexStorageKey = useMemo(() => {
    if (!orgId || !auditPlanIdFromUrl) return null;
    return `audit-step3-index:${orgId}:${auditPlanIdFromUrl}`;
  }, [orgId, auditPlanIdFromUrl]);
  const storedStep3Index = useMemo(() => {
    if (!step3IndexStorageKey) return null;
    try {
      const raw = window.localStorage.getItem(step3IndexStorageKey);
      if (!raw) return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  }, [step3IndexStorageKey]);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [criteria, setCriteria] = useState<string | null>(null);
  const [standardName, setStandardName] = useState<string>("—");
  const [rows, setRows] = useState<ChecklistRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [planStatus, setPlanStatus] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [resolvedProgramId, setResolvedProgramId] = useState<string | null>(null);
  const [savingFindings, setSavingFindings] = useState(false);
  const [submittingToAuditee, setSubmittingToAuditee] = useState(false);
  const [rowDialogOpen, setRowDialogOpen] = useState(false);
  const [rowDialogRowId, setRowDialogRowId] = useState<string | null>(null);
  const [rowDialogDraft, setRowDialogDraft] = useState<ChecklistRow | null>(null);
  const [rowDialogSaving, setRowDialogSaving] = useState(false);
  /** Plan summary for submission card: dates, audit number, lead auditor (resolved from members). */
  const [planSummary, setPlanSummary] = useState<{
    plannedDate: string | null;
    datePrepared: string | null;
    auditNumber: string | null;
    leadAuditorUserId: string | null;
  } | null>(null);
  const [leadAuditorDisplay, setLeadAuditorDisplay] = useState<string>("—");
  /** Checklist items for manual row search (by clause/subclause) under the selected standard. */
  const [checklistItemsForManual, setChecklistItemsForManual] = useState<ManualChecklistItem[]>([]);
  const [manualRowSearchQuery, setManualRowSearchQuery] = useState("");
  const [manualRowSearchOpen, setManualRowSearchOpen] = useState(false);
  const manualRowSearchRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<ChecklistRow[]>([]);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    if (!orgId) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        let programId = programIdFromUrl;
        let resolvedCriteria = criteriaFromUrl;

        let resolvedChecklistId: string | null = checklistIdFromUrl;
        if (auditPlanIdFromUrl) {
          const planRes = await apiClient.getAuditPlan(orgId, auditPlanIdFromUrl);
          if (cancelled || !planRes.plan) return;
          const plan = planRes.plan;
          setPlanStatus(plan.status ?? null);
          setCurrentUserRole(plan.currentUserRole ?? null);
          programId = plan.auditProgramId ?? programId;
          setResolvedProgramId(programId);
          if (plan.checklistId) resolvedChecklistId = plan.checklistId;
          resolvedCriteria = plan.criteria ?? (plan.programCriteria ? PROGRAM_CRITERIA_TO_CHECKLIST[plan.programCriteria] ?? plan.programCriteria : null) ?? resolvedCriteria;
          setPlanSummary({
            plannedDate: plan.plannedDate ?? null,
            datePrepared: plan.datePrepared ?? null,
            auditNumber: plan.auditNumber ?? null,
            leadAuditorUserId: plan.leadAuditorUserId ?? null,
          });
          const membersRes = await apiClient.getMembers(orgId);
          if (!cancelled && membersRes.teamMembers?.length) {
            const lead = membersRes.teamMembers.find((m: { id: string }) => m.id === plan.leadAuditorUserId);
            setLeadAuditorDisplay(lead ? `${lead.name || lead.email || "—"} | LEAD AUDITOR` : "—");
          }
        }

        if (!resolvedChecklistId && !resolvedCriteria && programId) {
          const progRes = await apiClient.getAuditProgram(orgId, programId);
          if (cancelled || !progRes.program) return;
          const progCriteria = progRes.program.auditCriteria;
          resolvedCriteria = progCriteria ? PROGRAM_CRITERIA_TO_CHECKLIST[progCriteria] ?? null : null;
        }

        if (!resolvedChecklistId && !resolvedCriteria) {
          setCriteria(null);
          setRows([]);
          setStandardName("—");
          setIsLoading(false);
          return;
        }

        setCriteria(resolvedCriteria ?? (resolvedChecklistId ? "Checklist" : null));
        setStandardName(CRITERIA_TO_STANDARD[resolvedCriteria ?? ""] ?? resolvedCriteria ?? "—");

        const res = resolvedChecklistId
          ? await apiClient.getChecklistQuestions(orgId, { checklistId: resolvedChecklistId })
          : await apiClient.getChecklistQuestions(orgId, { criteria: resolvedCriteria! });
        if (cancelled) return;

        const questions = res.questions ?? [];
        if (!cancelled) {
          setChecklistItemsForManual(
            questions.map((q) => ({
              clause: q.clause ?? "",
              subclause: q.subclause ?? "",
              requirement: q.requirement ?? "",
              question: q.question ?? "",
              evidenceExample: q.evidenceExample ?? "",
            }))
          );
        }
        const ts = Date.now();
        const standardLabel = resolvedChecklistId ? (resolvedCriteria ?? "Checklist") : (CRITERIA_TO_STANDARD[resolvedCriteria!] ?? resolvedCriteria!);
        let mapped: ChecklistRow[] = questions.map((q, i) => ({
          id: `row-${ts}-${i}`,
          standard: standardLabel,
          clause: q.clause ?? "",
          subclauses: q.subclause ?? "",
          requirement: q.requirement ?? "",
          question: q.question ?? "",
          evidenceExample: q.evidenceExample ?? "",
          evidence: "",
          status: "not_audited" as ComplianceStatus,
          riskJustification: "",
          justificationForClassification: "",
          objectiveEvidence: null,
        }));

        let loadedFindingsCount = 0;
        if (auditPlanIdFromUrl) {
          const findingsRes = await apiClient.getAuditPlanFindings(orgId, auditPlanIdFromUrl);
          const savedRaw = Array.isArray(findingsRes?.findings) ? [...findingsRes.findings] : [];
          const saved = savedRaw.filter((f: any) =>
            !isTrulyEmptyFindingRow({
              clause: f?.clause,
              subclauses: f?.subclauses,
              requirement: f?.requirement,
              question: f?.question,
              evidenceExample: f?.evidenceExample ?? f?.evidence_example,
              evidence: f?.evidenceSeen ?? f?.evidence_seen,
              status: f?.status,
              statementOfNonconformity: f?.statementOfNonconformity ?? f?.statement_of_nonconformity,
              riskSeverity: f?.riskSeverity ?? f?.risk_severity,
            })
          );
          if (!cancelled && saved.length > 0) {
            if (saved.length >= questions.length) {
              // Same or more saved than template: use saved as single source of truth so completed and manual rows always show
              mapped = saved.map((f: any, i: number) => ({
                id: `row-${ts}-${i}`,
                standard: (f.standard ?? standardLabel) || standardLabel,
                clause: f.clause ?? "",
                subclauses: f.subclauses ?? "",
                requirement: f.requirement ?? "",
                question: f.question ?? "",
                evidenceExample: f.evidenceExample ?? "",
                evidence: f.evidenceSeen ?? "",
                status: (f.status ?? "not_audited") as ComplianceStatus,
                statementOfNonconformity: f.statementOfNonconformity ?? undefined,
                riskSeverity: f.riskSeverity ?? undefined,
                riskJustification: f.riskJustification ?? "",
                justificationForClassification: f.justificationForClassification ?? "",
                objectiveEvidence: (f.objectiveEvidence as ObjectiveEvidenceItem[] | null) ?? null,
              }));
            } else {
              // Fewer saved than template: merge by index then append any extra (safety)
              const merged: ChecklistRow[] = questions.map((q, i) => {
                const f = saved[i];
                if (f) {
                  return {
                    id: `row-${ts}-${i}`,
                    standard: (f.standard ?? standardLabel) || standardLabel,
                    clause: f.clause ?? q.clause ?? "",
                    subclauses: f.subclauses ?? q.subclause ?? "",
                    requirement: f.requirement ?? q.requirement ?? "",
                    question: f.question ?? q.question ?? "",
                    evidenceExample: f.evidenceExample ?? q.evidenceExample ?? "",
                    evidence: f.evidenceSeen ?? "",
                    status: (f.status ?? "not_audited") as ComplianceStatus,
                    statementOfNonconformity: f.statementOfNonconformity ?? undefined,
                    riskSeverity: f.riskSeverity ?? undefined,
                    riskJustification: f.riskJustification ?? "",
                    justificationForClassification: f.justificationForClassification ?? "",
                    objectiveEvidence: (f.objectiveEvidence as ObjectiveEvidenceItem[] | null) ?? null,
                  };
                }
                return {
                  id: `row-${ts}-${i}`,
                  standard: standardLabel,
                  clause: q.clause ?? "",
                  subclauses: q.subclause ?? "",
                  requirement: q.requirement ?? "",
                  question: q.question ?? "",
                  evidenceExample: q.evidenceExample ?? "",
                  evidence: "",
                  status: "not_audited" as ComplianceStatus,
                  riskJustification: "",
                  justificationForClassification: "",
                  objectiveEvidence: null,
                };
              });
              for (let i = questions.length; i < saved.length; i++) {
                const f = saved[i];
                merged.push({
                  id: `row-${ts}-${i}`,
                  standard: (f.standard ?? standardLabel) || standardLabel,
                  clause: f.clause ?? "",
                  subclauses: f.subclauses ?? "",
                  requirement: f.requirement ?? "",
                  question: f.question ?? "",
                  evidenceExample: f.evidenceExample ?? "",
                  evidence: f.evidenceSeen ?? "",
                  status: (f.status ?? "not_audited") as ComplianceStatus,
                  statementOfNonconformity: f.statementOfNonconformity ?? undefined,
                  riskSeverity: f.riskSeverity ?? undefined,
                  riskJustification: f.riskJustification ?? "",
                  justificationForClassification: f.justificationForClassification ?? "",
                  objectiveEvidence: (f.objectiveEvidence as ObjectiveEvidenceItem[] | null) ?? null,
                });
              }
              mapped = merged;
            }
            loadedFindingsCount = saved.length;
          }
        }

        setRows(mapped);

        // When loading saved findings, show all completed rows by setting currentQuestionIndex
        // Prefer restoring the last saved position (localStorage), otherwise fall back to a heuristic.
        if (loadedFindingsCount > 0) {
          let nextIndex: number | null = storedStep3Index;
          if (nextIndex == null) {
            // Heuristic: find last row with any auditor input, then continue after it.
            let lastTouched = -1;
            for (let i = 0; i < mapped.length; i++) {
              const r = mapped[i];
              const touched =
                (r.evidence ?? "").trim() !== "" ||
                (r.statementOfNonconformity ?? "").trim() !== "" ||
                r.riskSeverity != null ||
                r.id?.startsWith?.("row-manual-");
              if (touched) lastTouched = i;
            }
            nextIndex = lastTouched >= 0 ? lastTouched + 1 : 0;
          }
          const clamped = Math.max(0, Math.min(nextIndex, mapped.length));
          setProgressIndex(clamped);
          setCurrentQuestionIndex(clamped);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError("Failed to load checklist questions.");
          setRows([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [orgId, programIdFromUrl, criteriaFromUrl, checklistIdFromUrl, auditPlanIdFromUrl]);

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (r.clause ?? "").toLowerCase().includes(q) ||
        (r.subclauses ?? "").toLowerCase().includes(q) ||
        (r.requirement ?? "").toLowerCase().includes(q) ||
        (r.question ?? "").toLowerCase().includes(q)
    );
  }, [rows, searchQuery]);

  /** For manual row: filter checklist items by clause/subclause (under selected standard). */
  const filteredManualChecklistItems = useMemo(() => {
    if (!manualRowSearchQuery.trim()) return [];
    const q = manualRowSearchQuery.trim().toLowerCase();
    return checklistItemsForManual.filter(
      (item) =>
        (item.clause ?? "").toLowerCase().includes(q) ||
        (item.subclause ?? "").toLowerCase().includes(q) ||
        (item.requirement ?? "").toLowerCase().includes(q)
    );
  }, [checklistItemsForManual, manualRowSearchQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (manualRowSearchRef.current && !manualRowSearchRef.current.contains(e.target as Node)) {
        setManualRowSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const submissionCard = useMemo(() => {
    if (!planSummary) return { startDate: "—", endDate: "—", manDays: "—", submissionDate: "—", authKey: auditPlanIdFromUrl ? `FIND_${format(new Date(), "yyyy")}_${auditPlanIdFromUrl.slice(0, 8)}` : "—" };
    const start = planSummary.plannedDate ? format(new Date(planSummary.plannedDate), "dd-MM-yyyy") : "—";
    const end = planSummary.datePrepared ? format(new Date(planSummary.datePrepared), "dd-MM-yyyy") : "—";
    let manDays = "—";
    if (planSummary.plannedDate && planSummary.datePrepared) {
      const days = (new Date(planSummary.datePrepared).getTime() - new Date(planSummary.plannedDate).getTime()) / (1000 * 60 * 60 * 24);
      manDays = `${Math.round(days * 10) / 10} Days`;
    }
    return {
      startDate: start,
      endDate: end,
      manDays,
      submissionDate: end,
      authKey: planSummary.auditNumber || (auditPlanIdFromUrl ? `FIND_${format(new Date(), "yyyy")}_${auditPlanIdFromUrl.slice(0, 8)}` : "—"),
    };
  }, [planSummary, auditPlanIdFromUrl]);

  const addRow = () => {
    const currentDisplayedId = filteredRows[currentQuestionIndex]?.id;
    let nextIndex = currentQuestionIndex + 1;
    setRows((prev) => {
      const newRow: ChecklistRow = {
        id: `row-manual-${Date.now()}`,
        standard: standardName !== "—" ? standardName : "",
        clause: "",
        subclauses: "",
        requirement: "",
        question: "",
        evidenceExample: "",
        evidence: "",
        status: "not_audited" as ComplianceStatus,
      };
      const baseIdx = currentDisplayedId ? prev.findIndex((r) => r.id === currentDisplayedId) : prev.length - 1;
      const insertAt = baseIdx >= 0 ? baseIdx + 1 : prev.length;
      nextIndex = insertAt;
      return [...prev.slice(0, insertAt), newRow, ...prev.slice(insertAt)];
    });
    // Ensure the new manual row is visible as the current row.
    setSearchQuery("");
    setCurrentQuestionIndex(nextIndex);
    setManualRowSearchQuery("");
    setManualRowSearchOpen(true);
  };

  /** Apply a checklist item (from clause/subclause search) to a manual row. */
  const applyChecklistItemToRow = (rowId: string, item: ManualChecklistItem) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? {
              ...r,
              clause: item.clause,
              subclauses: item.subclause,
              requirement: item.requirement,
              question: item.question,
              evidenceExample: item.evidenceExample,
            }
          : r
      )
    );
  };

  const removeRow = (id: string) => {
    setRows((prev) => {
      const removedIdx = prev.findIndex((r) => r.id === id);
      const next = prev.filter((r) => r.id !== id);
      if (removedIdx >= 0) {
        setCurrentQuestionIndex((ci) => {
          if (removedIdx < ci) return Math.max(0, ci - 1);
          if (removedIdx === ci) return Math.max(0, ci - 1);
          return ci;
        });
      }
      return next;
    });
    if (activeCARowId === id) {
      setActiveCARowId(null);
      setComplianceDetails(EMPTY_COMPLIANCE_DETAILS);
      setRiskSeverity("medium");
      setStatementOfNonconformity("");
      setRiskJustification("");
      setEvidenceItems(DEFAULT_EVIDENCE_ITEMS.map((item) => ({ ...item })));
      setJustificationForClassification("");
    }
  };

  const canEditRowDialog = planStatus !== "findings_submitted_to_auditee";

  const openNcFlowForRow = (row: ChecklistRow, idx?: number) => {
    // Ensure consistent indexing (avoid filtered index issues).
    setSearchQuery("");
    if (typeof idx === "number") setCurrentQuestionIndex(idx);
    setActiveCARowId(row.id);
    setComplianceDetails((prev) => ({
      ...prev,
      standard: row.standard,
      clause: row.clause,
      subclauses: row.subclauses,
      requirement: row.requirement,
      question: row.question,
      evidenceExample: row.evidenceExample,
      evidenceSeen: row.evidence,
    }));
    setRiskSeverity(row.riskSeverity ?? "medium");
    setStatementOfNonconformity(row.statementOfNonconformity ?? "");
    setRiskJustification(row.riskJustification ?? "");
    setJustificationForClassification(row.justificationForClassification ?? "");
    setEvidenceItems(
      (row.objectiveEvidence && row.objectiveEvidence.length > 0)
        ? row.objectiveEvidence
        : DEFAULT_EVIDENCE_ITEMS.map((item) => ({ ...item }))
    );
    setTimeout(() => {
      checklistSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const openRowDialog = (rowId: string) => {
    const row = rowsRef.current.find((r) => r.id === rowId) ?? rows.find((r) => r.id === rowId);
    if (!row) return;
    const isNc = row.status === "minor_nc" || row.status === "major_nc";
    setRowDialogRowId(rowId);
    setRowDialogDraft({
      ...row,
      riskJustification: row.riskJustification ?? "",
      justificationForClassification: row.justificationForClassification ?? "",
      objectiveEvidence: isNc
        ? (row.objectiveEvidence && row.objectiveEvidence.length > 0
            ? row.objectiveEvidence
            : DEFAULT_EVIDENCE_ITEMS.map((item) => ({ ...item })))
        : (row.objectiveEvidence ?? null),
    });
    setRowDialogOpen(true);
  };

  const persistRowsToServer = async (nextRows: ChecklistRow[]) => {
    if (!orgId || !auditPlanIdFromUrl) return;
    const rowsToPersist = nextRows.filter((r) => !isTrulyEmptyFindingRow(r));
    const findings = rowsToPersist.map((r, i) => ({
      rowIndex: i,
      standard: r.standard,
      clause: r.clause,
      subclauses: r.subclauses,
      requirement: r.requirement,
      question: r.question,
      evidenceExample: r.evidenceExample,
      evidenceSeen: r.evidence,
      status: r.status,
      statementOfNonconformity: r.statementOfNonconformity,
      riskSeverity: r.riskSeverity,
      riskJustification: r.riskJustification,
      justificationForClassification: r.justificationForClassification,
      objectiveEvidence: r.objectiveEvidence,
    }));
    await apiClient.saveAuditPlanFindings(orgId, auditPlanIdFromUrl, findings);
    setRows(rowsToPersist);
    rowsRef.current = rowsToPersist;
  };

  const updateRow = (id: string, field: keyof ChecklistRow, value: string | ComplianceStatus | "high" | "medium" | "low") => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const [complianceDetails, setComplianceDetails] = useState(EMPTY_COMPLIANCE_DETAILS);

  const [riskSeverity, setRiskSeverity] = useState<"high" | "medium" | "low">("medium");
  const [riskJustification, setRiskJustification] = useState("");
  const [statementOfNonconformity, setStatementOfNonconformity] = useState("");
  /** When user clicks Document Finding (CA), this row receives form values (Evidence Seen, Statement of Nonconformity, Risk Severity) on Save & Continue. */
  const [activeCARowId, setActiveCARowId] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [progressIndex, setProgressIndex] = useState(0);
  const checklistSectionRef = useRef<HTMLDivElement>(null);
  const checklistTableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!step3IndexStorageKey) return;
    try {
      window.localStorage.setItem(step3IndexStorageKey, String(progressIndex));
    } catch {
      // ignore storage errors
    }
  }, [progressIndex, step3IndexStorageKey]);

  useEffect(() => {
    // Never allow progressIndex to go backwards.
    setProgressIndex((p) => Math.max(p, currentQuestionIndex));
  }, [currentQuestionIndex]);

  useEffect(() => {
    const currentRow = filteredRows[currentQuestionIndex];
    const isManual = currentRow?.id?.startsWith?.("row-manual-");
    if (!isManual) {
      setManualRowSearchQuery("");
      setManualRowSearchOpen(false);
    }
  }, [currentQuestionIndex, filteredRows]);

  const [evidenceItems, setEvidenceItems] = useState<ObjectiveEvidenceItem[]>([...DEFAULT_EVIDENCE_ITEMS]);
  const [uploadingEvidenceId, setUploadingEvidenceId] = useState<string | null>(null);
  const addEvidenceItem = () => {
    setEvidenceItems((prev) => [
      ...prev,
      {
        id: `ev-${Date.now()}`,
        description: "",
        fileName: "",
        s3Key: "",
        effectiveness: "effective",
      },
    ]);
  };
  const updateEvidenceItem = (id: string, field: keyof ObjectiveEvidenceItem, value: string) => {
    setEvidenceItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };
  const setEvidenceEffectiveness = (id: string, value: "effective" | "ineffective") => {
    setEvidenceItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, effectiveness: value } : item))
    );
  };

  const [justificationForClassification, setJustificationForClassification] = useState("");

  type OfiRow = {
    id: string;
    ofiRef: string;
    standard: string;
    site: string;
    processArea: string;
    clause: string;
    subclauses: string;
    ofiPa: "ofi" | "pa";
  };
  const [ofiRows, setOfiRows] = useState<OfiRow[]>([
    {
      id: "ofi-1",
      ofiRef: "OFI-2026-001",
      standard: "ISO 9001:2015",
      site: "SITE A",
      processArea: "PRODUCTION",
      clause: "7.1.3",
      subclauses: "N/A",
      ofiPa: "ofi",
    },
  ]);
  const addOfiRow = () => {
    setOfiRows((prev) => [
      ...prev,
      {
        id: `ofi-${Date.now()}`,
        ofiRef: "",
        standard: "",
        site: "",
        processArea: "",
        clause: "",
        subclauses: "",
        ofiPa: "ofi",
      },
    ]);
  };
  const updateOfiRow = (id: string, field: keyof OfiRow, value: string) => {
    setOfiRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };
  const setOfiPa = (id: string, value: "ofi" | "pa") => {
    setOfiRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ofiPa: value } : r))
    );
  };
  const removeOfiRow = (id: string) => {
    setOfiRows((prev) => prev.filter((r) => r.id !== id));
  };

  const stepQuery = useMemo(() => {
    const p = new URLSearchParams();
    if (auditPlanIdFromUrl) p.set("auditPlanId", auditPlanIdFromUrl);
    if (programIdFromUrl) p.set("programId", programIdFromUrl);
    if (criteriaFromUrl) p.set("criteria", criteriaFromUrl);
    if (checklistIdFromUrl) p.set("checklistId", checklistIdFromUrl);
    return p.toString();
  }, [auditPlanIdFromUrl, programIdFromUrl, criteriaFromUrl, checklistIdFromUrl]);

  const currentRow = filteredRows[currentQuestionIndex] ?? null;
  const isCurrentMinorOrMajorNc =
    currentRow && (currentRow.status === "minor_nc" || currentRow.status === "major_nc");
  const isCaOpenForCurrentRow = currentRow && activeCARowId === currentRow.id;
  const stripHtml = (s: string) => (s ?? "").replace(/<[^>]*>/g, "").trim();
  const caRequiredFieldsFilled =
    stripHtml(statementOfNonconformity) !== "" &&
    stripHtml(riskJustification) !== "" &&
    stripHtml(justificationForClassification) !== "" &&
    (stripHtml(complianceDetails.evidenceSeen ?? "") !== "" || (currentRow?.evidence ?? "").trim() !== "");

  type CaValidationField = "evidenceSeen" | "riskJustification" | "statementOfNonconformity" | "justificationForClassification";
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<CaValidationField, string>>>({});
  const refEvidenceSeen = useRef<HTMLDivElement>(null);
  const refRiskJustification = useRef<HTMLDivElement>(null);
  const refStatementOfNonconformity = useRef<HTMLDivElement>(null);
  const refJustificationForClassification = useRef<HTMLDivElement>(null);
  const fieldRefs: Record<CaValidationField, React.RefObject<HTMLDivElement | null>> = {
    evidenceSeen: refEvidenceSeen,
    riskJustification: refRiskJustification,
    statementOfNonconformity: refStatementOfNonconformity,
    justificationForClassification: refJustificationForClassification,
  };
  const firstErrorFieldOrder: CaValidationField[] = ["evidenceSeen", "riskJustification", "statementOfNonconformity", "justificationForClassification"];
  useEffect(() => {
    if (Object.keys(fieldErrors).length > 0) setFieldErrors({});
  }, [statementOfNonconformity, riskJustification, justificationForClassification, complianceDetails.evidenceSeen, currentRow?.evidence]);

  const canEditStep3 =
    planStatus !== "closed" && currentUserRole === "assigned_auditor";

  const lockedSteps = useMemo(() => {
    if (!planStatus || !currentUserRole) return [];
    const locked: number[] = [];
    if (currentUserRole === "lead_auditor" && !["pending_closure", "closed"].includes(planStatus)) locked.push(6);
    if (currentUserRole === "assigned_auditor" && !["ca_submitted_to_auditor", "pending_closure", "closed"].includes(planStatus)) locked.push(5);
    return locked;
  }, [planStatus, currentUserRole]);

  return (
    <div className="space-y-6">
      <AuditWorkflowHeader currentStep={3} orgId={orgId} allowedSteps={[3, 5]} stepQuery={stepQuery || undefined} exitHref="../.." />

      <Dialog
        open={rowDialogOpen}
        onOpenChange={(open) => {
          setRowDialogOpen(open);
          if (!open) {
            setRowDialogRowId(null);
            setRowDialogDraft(null);
            setRowDialogSaving(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Checklist Question — View / Edit</DialogTitle>
            <DialogDescription>
              Edit status and evidence. If status is Minor/Major NC, you can also edit CA fields.
            </DialogDescription>
          </DialogHeader>

          {rowDialogDraft && (() => {
            // Dialog is for non-NC rows only; if a row becomes Minor/Major, we route to the CA flow.
            const isNc = false;
            return (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Standard</Label>
                  <Input value={rowDialogDraft.standard} readOnly className="border-gray-200 bg-gray-50 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Clause</Label>
                    <Input value={rowDialogDraft.clause} readOnly className="border-gray-200 bg-gray-50 text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Subclause</Label>
                    <Input value={rowDialogDraft.subclauses} readOnly className="border-gray-200 bg-gray-50 text-sm" />
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Audit Question</Label>
                  <Input value={rowDialogDraft.question} readOnly className="border-gray-200 bg-gray-50 text-sm" />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Status</Label>
                  <Select
                    value={rowDialogDraft.status}
                    onValueChange={(v) => {
                      // Minor/Major NC must use the original CA flow (below sections), not the dialog.
                      if (v === "minor_nc" || v === "major_nc") {
                        if (rowDialogRowId) {
                          const baseRows = rowsRef.current.length > 0 ? rowsRef.current : rows;
                          const idx = baseRows.findIndex((r) => r.id === rowDialogRowId);
                          const row = idx >= 0 ? baseRows[idx] : null;
                          if (row) {
                            setRowDialogOpen(false);
                            openNcFlowForRow({ ...row, status: v }, idx);
                            return;
                          }
                        }
                      }
                      setRowDialogDraft((d) => (d ? { ...d, status: v as ComplianceStatus } : d));
                    }}
                    disabled={!canEditRowDialog}
                  >
                    <SelectTrigger className="h-9 rounded-md border-gray-200">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {LEGEND_ITEMS.map((item) => (
                        <SelectItem key={item.key} value={item.key}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Minor/Major NC fields are handled in the CA flow below, not in this dialog. */}

                <div className="space-y-2 md:col-span-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Evidence Seen</Label>
                  <div className={cn("overflow-hidden rounded-lg border", canEditRowDialog ? "border-gray-200" : "border-gray-200 opacity-75")}>
                    <FroalaEditor
                      tag="textarea"
                      model={rowDialogDraft.evidence ?? ""}
                      onModelChange={(v: string) => setRowDialogDraft((d) => (d ? { ...d, evidence: v } : d))}
                      config={{ heightMin: 120, charCounterCount: true, placeholderText: "Evidence seen..." }}
                    />
                  </div>
                </div>

                {/* Minor/Major NC detail sections are intentionally not shown here. */}
              </div>
            );
          })()}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRowDialogOpen(false)}>
              Close
            </Button>
            {canEditRowDialog && (
              <Button
                type="button"
                className="bg-green-600 hover:bg-green-700"
                disabled={!rowDialogDraft || !rowDialogRowId || rowDialogSaving || savingFindings || !auditPlanIdFromUrl}
                onClick={async () => {
                  if (!rowDialogDraft || !rowDialogRowId) return;
                  setRowDialogSaving(true);
                  try {
                    const updatedRows = (rowsRef.current.length > 0 ? rowsRef.current : rows).map((r) =>
                      r.id === rowDialogRowId ? { ...r, ...rowDialogDraft } : r
                    );
                    await persistRowsToServer(updatedRows);
                    setRowDialogOpen(false);
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setRowDialogSaving(false);
                  }
                }}
              >
                {rowDialogSaving ? "Saving…" : "Save changes"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-lg border border-gray-200 bg-white p-8">
        <div className={cn(!canEditStep3 && "pointer-events-none select-none opacity-90")}>
        {/* Step 3 Header */}
        <div className="border-b border-gray-200 mx-8 my-4 ">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-green-600">
            TO BE COMPLETED BY THE AUDITOR
          </p>
          <h1 className="text-2xl font-bold uppercase text-gray-900">
            STEP 3 OF 6: AUDIT FINDINGS
          </h1>
        </div>
        {/* Audit Checklist — questions from Step 2 criteria (ISO 9001, ISO 14001, etc.) */}
        <div className="mx-8 my-4">
          {isLoading && (
            <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 px-6 py-8 text-center text-gray-600">
              Loading checklist questions based on audit criteria...
            </div>
          )}
          {!isLoading && loadError && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-6 py-4 text-red-800">
              {loadError}
            </div>
          )}
          {!isLoading && !loadError && !criteria && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-6 py-6">
              <p className="font-medium text-amber-900">
                No audit criteria selected. The checklist questions depend on the criteria you select in Step 2 (e.g., ISO 9001 Quality, ISO 14001 Environment).
              </p>
            </div>
          )}
          {!isLoading && !loadError && criteria && (
            <>
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold uppercase text-gray-900">AUDIT CHECKLIST</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Criteria: {criteria}. One question at a time.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      placeholder="Search questions..."
                      className="h-10 w-64 rounded-lg border-gray-300 pl-9"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button onClick={addRow} size="sm" className="bg-green-600 hover:bg-green-700">
                    <Plus className="mr-2 h-4 w-4" />
                    ADD MANUAL ENTRY ROW
                  </Button>
                </div>
              </div>

              {filteredRows.length === 0 ? (
                <div className="mx-8 my-4 rounded-lg border border-gray-200 bg-gray-50 p-8 text-center text-gray-600">
                  No questions match your search. Clear the search or add a manual entry row.
                </div>
              ) : (
                <Fragment>
                  {currentQuestionIndex >= filteredRows.length ? (
                    <div className="mx-8 my-4 rounded-lg border border-green-200 bg-green-50 p-8 text-center">
                      <p className="text-lg font-semibold text-green-800">All questions completed</p>
                      <p className="mt-2 text-sm text-green-700">Use &quot;Save &amp; Continue Checklist Loop&quot; below to save findings and return to the audit list.</p>
                    </div>
                  ) : (
                    <div ref={checklistTableRef} className="mx-8 my-4 space-y-3">
                      <p className="text-sm font-medium text-gray-600">
                        Question {currentQuestionIndex + 1} of {filteredRows.length}
                      </p>
                      {filteredRows[currentQuestionIndex]?.id?.startsWith?.("row-manual-") && (
                        <div
                          ref={manualRowSearchRef}
                          className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                        >
                          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-600">
                            Search by Clause / Subclause under {criteria}
                          </label>
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <Input
                              placeholder="e.g. 4.1 or 4.1.1"
                              className="h-9 pl-8 pr-3"
                              value={manualRowSearchQuery}
                              onChange={(e) => {
                                setManualRowSearchQuery(e.target.value);
                                setManualRowSearchOpen(true);
                              }}
                              onFocus={() => setManualRowSearchOpen(true)}
                            />
                            {manualRowSearchOpen && (
                              <ul className="absolute z-10 mt-1 max-h-52 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                                {filteredManualChecklistItems.length === 0 ? (
                                  <li className="px-3 py-2 text-sm text-gray-500">
                                    {manualRowSearchQuery.trim() ? "No matches" : "Type clause or subclause to search"}
                                  </li>
                                ) : (
                                  filteredManualChecklistItems.slice(0, 12).map((item, i) => (
                                    <li
                                      key={`${item.clause}-${item.subclause}-${i}`}
                                      className="cursor-pointer px-3 py-2 text-sm hover:bg-gray-100"
                                      onClick={() => {
                                        const currentRow = filteredRows[currentQuestionIndex];
                                        if (currentRow) applyChecklistItemToRow(currentRow.id, item);
                                        setManualRowSearchQuery("");
                                        setManualRowSearchOpen(false);
                                      }}
                                    >
                                      <span className="font-medium text-gray-900">
                                        {item.clause} / {item.subclause}
                                      </span>
                                      <span className="ml-1 text-gray-600 line-clamp-1">
                                        — {item.requirement}
                                      </span>
                                    </li>
                                  ))
                                )}
                              </ul>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-100">
                          <TableHead className="whitespace-nowrap font-semibold uppercase text-gray-700">STANDARD (SYSTEM)</TableHead>
                          <TableHead className="whitespace-nowrap font-semibold uppercase text-gray-700">CLAUSE</TableHead>
                          <TableHead className="whitespace-nowrap font-semibold uppercase text-gray-700">SUBCLAUSES</TableHead>
                          <TableHead className="min-w-[160px] font-semibold uppercase text-gray-700">COMPLIANCE</TableHead>
                          <TableHead className="min-w-[200px] font-semibold uppercase text-gray-700">AUDIT QUESTION</TableHead>
                          <TableHead className="min-w-[160px] font-semibold uppercase text-gray-700 leading-tight">TYPICAL EXAMPLE OF EVIDENCE</TableHead>
                          <TableHead className="min-w-[140px] font-semibold uppercase text-gray-700">EVIDENCE SEEN</TableHead>
                          <TableHead className="min-w-[120px] font-semibold uppercase text-gray-700">COMPLIANCE</TableHead>
                          <TableHead className="w-[140px] font-semibold uppercase text-gray-700">ACTION</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRows.slice(0, Math.max(currentQuestionIndex, progressIndex) + 1).map((row, idx) => {
                          const isCurrent = idx === currentQuestionIndex;
                          const isNC = row.status === "major_nc" || row.status === "minor_nc";
                          const statusLabel = STATUS_CHECKLIST_LABEL[row.status] ?? "—";
                          return (
                            <TableRow
                              key={row.id}
                              className={cn("align-top", isCurrent ? "bg-white ring-1 ring-orange-200" : "bg-gray-50/80")}
                            >
                              <TableCell className="align-top py-2">
                                {isCurrent ? (
                                  <Input
                                    value={row.standard}
                                    onChange={(e) => updateRow(row.id, "standard", e.target.value)}
                                    placeholder="e.g. ISO 9001:2015"
                                    className="h-9 min-w-[100px] rounded-md border-gray-200 bg-gray-50/50 text-sm text-gray-600"
                                  />
                                ) : (
                                  <span className="text-sm text-gray-700">{row.standard || "—"}</span>
                                )}
                              </TableCell>
                              <TableCell className="align-top py-2">
                                {isCurrent ? (
                                  <Input
                                    value={row.clause}
                                    onChange={(e) => updateRow(row.id, "clause", e.target.value)}
                                    placeholder="e.g. 4.1"
                                    className="h-9 w-20 rounded-md border-gray-200 text-sm font-bold text-gray-900"
                                  />
                                ) : (
                                  <span className="text-sm font-medium text-gray-900">{row.clause || "—"}</span>
                                )}
                              </TableCell>
                              <TableCell className="align-top py-2">
                                {isCurrent ? (
                                  <Input
                                    value={row.subclauses}
                                    onChange={(e) => updateRow(row.id, "subclauses", e.target.value)}
                                    placeholder="e.g. 4.1.1"
                                    className="h-9 w-24 rounded-md border-gray-200 text-sm text-gray-600"
                                  />
                                ) : (
                                  <span className="text-sm text-gray-700">{row.subclauses || "—"}</span>
                                )}
                              </TableCell>
                              <TableCell className="align-top py-2 max-w-[160px]">
                                {isCurrent ? (
                                  <Textarea
                                    value={row.requirement}
                                    onChange={(e) => updateRow(row.id, "requirement", e.target.value)}
                                    placeholder="Compliance requirement"
                                    rows={2}
                                    className="min-w-[140px] resize-none rounded-md border-gray-200 text-sm text-gray-600"
                                  />
                                ) : (
                                  <span className="line-clamp-2 text-sm text-gray-700">{row.requirement || "—"}</span>
                                )}
                              </TableCell>
                              <TableCell className="align-top py-2 max-w-[200px]">
                                {isCurrent ? (
                                  <Textarea
                                    value={row.question}
                                    onChange={(e) => updateRow(row.id, "question", e.target.value)}
                                    placeholder="Audit question"
                                    rows={2}
                                    className="min-w-[180px] resize-none rounded-md border-gray-200 text-sm font-medium text-gray-900"
                                  />
                                ) : (
                                  <span className="line-clamp-2 text-sm text-gray-800">{row.question || "—"}</span>
                                )}
                              </TableCell>
                              <TableCell className="align-top py-2 max-w-[160px]">
                                {isCurrent ? (
                                  <Textarea
                                    value={row.evidenceExample}
                                    onChange={(e) => updateRow(row.id, "evidenceExample", e.target.value)}
                                    placeholder="Typical evidence"
                                    rows={2}
                                    className="min-w-[140px] resize-none rounded-md border-gray-200 text-sm text-gray-600"
                                  />
                                ) : (
                                  <span className="line-clamp-2 text-sm text-gray-600">{row.evidenceExample || "—"}</span>
                                )}
                              </TableCell>
                              <TableCell className="align-top py-2 max-w-[140px]">
                                {isCurrent ? (
                                  <Input
                                    value={row.evidence}
                                    onChange={(e) => updateRow(row.id, "evidence", e.target.value)}
                                    placeholder="Enter evidence details..."
                                    className="min-w-[120px] rounded-md border-gray-200 bg-gray-50/80 text-sm italic text-muted-foreground placeholder:italic"
                                  />
                                ) : (
                                  <span className="line-clamp-2 text-sm italic text-gray-600">{row.evidence || "—"}</span>
                                )}
                              </TableCell>
                              <TableCell className="align-top py-2">
                                {isCurrent ? (
                                  <Select value={row.status} onValueChange={(v) => updateRow(row.id, "status", v as ComplianceStatus)}>
                                    <SelectTrigger className="h-9 min-w-[100px] rounded-md border-gray-200">
                                      <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {LEGEND_ITEMS.map((item) => (
                                        <SelectItem key={item.key} value={item.key}>
                                          {item.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <span className="text-sm font-medium text-gray-800">{statusLabel}</span>
                                )}
                              </TableCell>
                              <TableCell className="align-top py-2">
                                {isCurrent ? (
                                  !isNC ? (
                                    <div className="flex items-center gap-2">
                                      <Button
                                        size="sm"
                                        className="gap-1.5 rounded-md bg-green-600 px-3 text-xs font-semibold uppercase text-white hover:bg-green-700"
                                        onClick={() => setCurrentQuestionIndex((i) => Math.min(i + 1, filteredRows.length))}
                                      >
                                        Next
                                      </Button>
                                      {row.id.startsWith("row-manual-") && (
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="ghost"
                                          className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                                          disabled={planStatus === "findings_submitted_to_auditee"}
                                          onClick={() => removeRow(row.id)}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                  ) : (
                                    <Button
                                      size="sm"
                                      className="gap-1.5 rounded-md bg-orange-500 px-3 text-xs font-semibold uppercase text-white hover:bg-orange-600"
                                      onClick={() => {
                                        setActiveCARowId(row.id);
                                        setComplianceDetails((prev) => ({
                                          ...prev,
                                          standard: row.standard,
                                          clause: row.clause,
                                          subclauses: row.subclauses,
                                          requirement: row.requirement,
                                          question: row.question,
                                          evidenceExample: row.evidenceExample,
                                          evidenceSeen: row.evidence,
                                        }));
                                        setRiskSeverity(row.riskSeverity ?? "medium");
                                        setStatementOfNonconformity(row.statementOfNonconformity ?? "");
                                        setRiskJustification(row.riskJustification ?? "");
                                        setJustificationForClassification(row.justificationForClassification ?? "");
                                        setEvidenceItems(
                                          (row.objectiveEvidence && row.objectiveEvidence.length > 0)
                                            ? row.objectiveEvidence
                                            : DEFAULT_EVIDENCE_ITEMS.map((item) => ({ ...item }))
                                        );
                                        setTimeout(() => {
                                          checklistSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                                        }, 100);
                                      }}
                                    >
                                      <ArrowRight className="h-3.5 w-3.5" />
                                      Document Finding (CA)
                                    </Button>
                                  )
                                ) : (
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-medium text-green-700">Complete</span>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-8 px-2 text-xs"
                                      onClick={() => {
                                        if (isNC) {
                                          // Minor/Major NC keeps the original CA flow
                                          openNcFlowForRow(row, idx);
                                        } else {
                                          openRowDialog(row.id);
                                        }
                                      }}
                                    >
                                      <Eye className="mr-1.5 h-4 w-4" />
                                      View / Edit
                                    </Button>
                                    {row.id.startsWith("row-manual-") && (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                                        disabled={planStatus === "findings_submitted_to_auditee"}
                                        onClick={() => removeRow(row.id)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                  )}
                </Fragment>
              )}
            </>
          )}
        </div>
        {/* Compliance Legend */}
        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm mx-8 my-4">
          <h2 className="mb-4 text-xl font-bold uppercase text-gray-900">COMPLIANCE LEGEND</h2>
          <div className="flex flex-wrap items-center gap-4">
            {LEGEND_ITEMS.map((item) => (
              <div key={item.key} className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex h-7 min-w-[28px] items-center justify-center px-2 text-xs font-bold",
                    item.className
                  )}
                >
                  {item.icon === "x" && <X className="h-4 w-4" />}
                  {item.icon === "o" && <Circle className="h-3 w-3" strokeWidth={3} />}
                  {item.icon === "dash" && <Minus className="h-4 w-4" />}
                  {item.badge && item.badge}
                </span>
                <span className="text-sm font-medium text-gray-700">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Compliance Details — pre-filled when user clicks Document Finding (CA); scroll target for CA flow */}
        <div ref={checklistSectionRef} className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm mx-8 my-4">
          <h2 className="mb-6 text-xl font-bold uppercase text-gray-900">COMPLIANCE DETAILS</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">3.2.1 STANDARD</Label>
              <Input
                value={complianceDetails.standard}
                readOnly
                className="border-gray-200 bg-gray-50 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">3.2.2 CLAUSE</Label>
              <Input
                value={complianceDetails.clause}
                readOnly
                className="border-gray-200 bg-green-50 text-sm font-medium"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">3.2.3 SUBCLAUSES</Label>
              <Input
                value={complianceDetails.subclauses}
                readOnly
                className="border-gray-200 bg-green-50 text-sm"
              />
            </div>
          </div>
          <div className="mt-6 space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">3.2.4 COMPLIANCE REQUIREMENT</Label>
            <Input
              value={complianceDetails.requirement}
              readOnly
              className="border-gray-200 bg-gray-50 text-sm"
            />
          </div>
          <div className="mt-6 space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">3.2.5 AUDIT QUESTION</Label>
            <Input
              value={complianceDetails.question}
              readOnly
              className="border-gray-200 bg-gray-50 text-sm"
            />
          </div>
          <div className="mt-6 space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">3.2.6 TYPICAL EXAMPLE OF EVIDENCE</Label>
            <Input
              value={complianceDetails.evidenceExample}
              readOnly
              className="border-gray-200 bg-gray-50 text-sm"
            />
          </div>
          <div ref={refEvidenceSeen} className={cn("mt-6 space-y-2", fieldErrors.evidenceSeen && "rounded-lg border-2 border-red-500 bg-red-50/30 p-4")}>
            <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">3.2.7 EVIDENCE SEEN</Label>
            <div className={cn("overflow-hidden rounded-lg border", fieldErrors.evidenceSeen ? "border-red-500" : "border-gray-200")}>
              <FroalaEditor
                tag="textarea"
                model={complianceDetails.evidenceSeen ?? ""}
                onModelChange={(v: string) => setComplianceDetails((prev) => ({ ...prev, evidenceSeen: v }))}
                config={{
                  heightMin: 120,
                  placeholderText: "Document detailed findings, interview notes, and physical evidence observed...",
                  charCounterCount: true,
                }}
              />
            </div>
            {fieldErrors.evidenceSeen && (
              <p className="text-sm font-medium text-red-600">{fieldErrors.evidenceSeen}</p>
            )}
          </div>
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start">
            <Button variant="outline" size="sm" className="gap-2 border-gray-300 font-medium uppercase">
              <Upload className="h-4 w-4" />
              Upload Supporting Document
            </Button>
            <div className="flex flex-1 items-start gap-3 rounded-lg border-2 border-red-200 bg-red-50 px-4 py-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
              <p className="text-sm font-medium text-red-800">
                Warning: Submission of false evidence or intentional omission of findings is a breach of ISO 19011:2026 professional code of conduct and system integrity.
              </p>
            </div>
          </div>
        </div>

        {/* Risk Severity */}
        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm mx-8 my-4">
          <h2 className="mb-6 text-xl font-bold uppercase text-gray-900">RISK SEVERITY (CURRENT STATUS)</h2>
          <div className="flex flex-wrap gap-6">
            {(["high", "medium", "low"] as const).map((level) => (
              <Label
                key={level}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border-2 px-6 py-4 transition-colors",
                  riskSeverity === level
                    ? "border-green-500 bg-green-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                    level === "high" && (riskSeverity === "high" ? "border-red-600 bg-red-500" : "border-red-300 bg-red-100"),
                    level === "medium" && (riskSeverity === "medium" ? "border-green-600 bg-green-500" : "border-green-300 bg-green-50"),
                    level === "low" && (riskSeverity === "low" ? "border-blue-600 bg-blue-500" : "border-blue-300 bg-blue-100")
                  )}
                >
                  {riskSeverity === level && <span className="h-2 w-2 rounded-full bg-white" />}
                </span>
                <input
                  type="radio"
                  name="riskSeverity"
                  value={level}
                  checked={riskSeverity === level}
                  onChange={() => setRiskSeverity(level)}
                  className="sr-only"
                />
                <span className={cn("font-semibold uppercase text-gray-900", riskSeverity === level && "font-bold")}>
                  {level}
                </span>
              </Label>
            ))}
          </div>
          <div ref={refRiskJustification} className={cn("mt-8 space-y-2", fieldErrors.riskJustification && "rounded-lg border-2 border-red-500 bg-red-50/30 p-4")}>
            <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
              RISK JUSTIFICATION & COMMENTS (MANDATORY)
            </Label>
            <div className={cn("overflow-hidden rounded-lg border", fieldErrors.riskJustification ? "border-red-500" : "border-gray-200")}>
              <FroalaEditor
                tag="textarea"
                model={riskJustification}
                onModelChange={setRiskJustification}
                config={{
                  heightMin: 100,
                  placeholderText: "Explain the rationale behind the selected risk level...",
                  charCounterCount: true,
                }}
              />
            </div>
            {fieldErrors.riskJustification && (
              <p className="text-sm font-medium text-red-600">{fieldErrors.riskJustification}</p>
            )}
          </div>
          <div className="mt-8 rounded-lg bg-slate-800 p-6 text-white">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500">
                <Check className="h-4 w-4" />
              </div>
              <h3 className="text-lg font-bold uppercase text-green-300">RISK EVALUATION GUIDELINE</h3>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div>
                <div className="mb-2 font-semibold uppercase text-red-300">HIGH SEVERITY</div>
                <p className="text-sm text-slate-200">
                  Direct impact on product safety, regulatory compliance, or system-wide failure. Requires immediate containment.
                </p>
              </div>
              <div>
                <div className="mb-2 font-semibold uppercase text-orange-300">MEDIUM SEVERITY</div>
                <p className="text-sm text-slate-200">
                  Partial failure of core process. May impact customer satisfaction or operational efficiency if not addressed.
                </p>
              </div>
              <div>
                <div className="mb-2 font-semibold uppercase text-blue-300">LOW SEVERITY</div>
                <p className="text-sm text-slate-200">
                  Isolated administrative error or minor process deviation. Negligible impact on quality or safety.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Classification, Site, Process & Standard Requirement - 4 cards as in image */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 mx-8 my-4">
          {/* Card 1: CLASSIFICATION */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-900">
              CLASSIFICATION
            </h2>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                AUTO-DERIVED STATUS
              </Label>
              <div className="relative">
                <Input
                  value="MA"
                  readOnly
                  className="h-12 border-2 border-red-500 bg-white pr-10 text-2xl font-bold text-red-600"
                />
                <Lock className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>
              <p className="text-xs text-gray-500">
                SYSTEM RULE: FIELD LOCKS AFTER SUBMISSION TO LEAD AUDITOR
              </p>
            </div>
          </div>
          {/* Card 2: SITE / UNIT */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-900">
              SITE / UNIT
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  3.5.1 SITE (SYSTEM GENERATED)
                </Label>
                <Input
                  value="MANUFACTURING COMPLEX - UNIT 4"
                  readOnly
                  className="border-gray-200 bg-gray-100 text-sm font-medium text-gray-700"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  LOCATION DESCRIPTION
                </Label>
                <Input
                  placeholder="e.g. Production Floor, Second Bay"
                  className="border-gray-200 text-sm"
                />
              </div>
            </div>
          </div>
          {/* Card 3: PROCESS / AREA */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-900">
              PROCESS / AREA
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  3.6.1 PROCESS ID (SYSTEM GENERATED)
                </Label>
                <Input
                  value="PROC-2026-MFG-008"
                  readOnly
                  className="border-gray-200 bg-gray-100 text-sm font-medium text-gray-700"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  PROCESS NAME
                </Label>
                <Input
                  value="CORE PRODUCTION & ASSEMBLY"
                  readOnly
                  className="border-gray-200 bg-gray-100 text-sm font-medium text-gray-700"
                />
              </div>
            </div>
          </div>
          {/* Card 4: STANDARD REQUIREMENT */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-900">
              STANDARD REQUIREMENT
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  AUTO-LINKED CLAUSE REFERENCE
                </Label>
                <Input
                  value="4.1"
                  readOnly
                  className="border-2 border-green-400 bg-green-50/50 text-lg font-bold text-green-700"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  MANUAL REFERENCE / ADDENDUM
                </Label>
                <Input
                  placeholder="e.g. Clause 4.1.2 - Local Addendum v2"
                  className="border-gray-200 text-sm"
                />
              </div>
            </div>
          </div>
        </div>
        {/* Statement of Nonconformity */}
        <div ref={refStatementOfNonconformity} className={cn("rounded-lg border border-gray-200 bg-white p-6 shadow-sm mx-8 my-4", fieldErrors.statementOfNonconformity && "border-2 border-red-500 bg-red-50/30")}>
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-900">
            STATEMENT OF NONCONFORMITY
          </h2>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded border-gray-300"
                  aria-label="Bold"
                >
                  <Bold className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded border-gray-300"
                  aria-label="Italic"
                >
                  <Italic className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded border-gray-300"
                  aria-label="Underline"
                >
                  <Underline className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded border-gray-300"
                  aria-label="Clear"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded border-gray-300"
                  aria-label="HTML"
                >
                  <Code className="h-4 w-4" />
                </Button>
              </div>
              <span className="text-xs text-gray-500">
                PROFESSIONAL FINDINGS EDITOR (DOC 34 V10 MODE)
              </span>
            </div>
            <div className={cn("overflow-hidden rounded-lg border", fieldErrors.statementOfNonconformity ? "border-red-500" : "border-gray-200")}>
              <FroalaEditor
                tag="textarea"
                model={statementOfNonconformity}
                onModelChange={setStatementOfNonconformity}
                config={{
                  heightMin: 200,
                  placeholderText: "Document the nonconformity statement precisely. Include specific facts, what was expected, and what was observed.",
                  charCounterCount: true,
                }}
              />
            </div>
            {fieldErrors.statementOfNonconformity && (
              <p className="mt-2 text-sm font-medium text-red-600">{fieldErrors.statementOfNonconformity}</p>
            )}
          </div>

          {/* Guidelines / Tips */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm  my-4">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-700">
                  1
                </div>
                <div className="space-y-1">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-gray-900">
                    WHAT WENT WRONG
                  </h3>
                  <p className="text-sm text-gray-700">
                    Describe the deviation from the established requirement clearly.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-700">
                  2
                </div>
                <div className="space-y-1">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-gray-900">
                    NO ROOT CAUSE
                  </h3>
                  <p className="text-sm text-gray-700">
                    <span className="underline">Do not analyze root causes in this section.</span> This is for findings only
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-700">
                  3
                </div>
                <div className="space-y-1">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-gray-900">
                    NO SOLUTION
                  </h3>
                  <p className="text-sm text-gray-700">
                    <span className="underline">Avoid proposing fixes or corrective actions in the finding statement</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm mx-8 my-4">
          {/* Objective Evidence */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-900">
              OBJECTIVE EVIDENCE
            </h2>
            <div className="space-y-4">
              {evidenceItems.map((item, index) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-700">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1 space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                          EVIDENCE DESCRIPTION
                        </Label>
                        <Input
                          placeholder="e.g. Employee Training Matrix - Unit 4 Rev 2"
                          value={item.description}
                          onChange={(e) => updateEvidenceItem(item.id, "description", e.target.value)}
                          className="border-gray-200 text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                            LINKED MEDIA / UPLOAD
                          </Label>
                          <Label className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100">
                            <FileText className="h-4 w-4 shrink-0 text-gray-500" />
                            <span className="truncate">
                              {item.fileName || "Select file"}
                            </span>
                            <input
                              type="file"
                              className="hidden"
                              disabled={!!uploadingEvidenceId}
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file || !orgId) {
                                  e.target.value = "";
                                  return;
                                }
                                setUploadingEvidenceId(item.id);
                                try {
                                  const planId = auditPlanIdFromUrl || "draft";
                                  const res = await apiClient.uploadAuditDocument(file, orgId, planId, 3);
                                  updateEvidenceItem(item.id, "fileName", res.name);
                                  updateEvidenceItem(item.id, "s3Key", res.key);
                                } catch (err) {
                                  console.error(err);
                                } finally {
                                  setUploadingEvidenceId(null);
                                  e.target.value = "";
                                }
                              }}
                            />
                          </Label>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                            EFFECTIVENESS SELECTOR
                          </Label>
                          <div className="flex gap-4">
                            <Label
                              className={cn(
                                "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                                item.effectiveness === "effective"
                                  ? "border-green-500 bg-green-50 text-green-700 ring-1 ring-green-500"
                                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
                              )}
                            >
                              <input
                                type="radio"
                                name={`effectiveness-${item.id}`}
                                checked={item.effectiveness === "effective"}
                                onChange={() => setEvidenceEffectiveness(item.id, "effective")}
                                className="sr-only"
                              />
                              <span className={cn("flex h-3 w-3 items-center justify-center rounded-full border-2 border-green-500", item.effectiveness === "effective" ? "bg-green-500" : "bg-white")}>
                                {item.effectiveness === "effective" && <span className="h-1 w-1 rounded-full bg-white" />}
                              </span>
                              EFFECTIVE
                            </Label>
                            <Label
                              className={cn(
                                "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                                item.effectiveness === "ineffective"
                                  ? "border-red-500 bg-red-50 text-red-700 ring-1 ring-red-500"
                                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
                              )}
                            >
                              <input
                                type="radio"
                                name={`effectiveness-${item.id}`}
                                checked={item.effectiveness === "ineffective"}
                                onChange={() => setEvidenceEffectiveness(item.id, "ineffective")}
                                className="sr-only"
                              />
                              <span className={cn("flex h-3 w-3 items-center justify-center rounded-full border-2 border-red-500", item.effectiveness === "ineffective" ? "bg-red-500" : "bg-white")}>
                                {item.effectiveness === "ineffective" && <span className="h-1 w-1 rounded-full bg-white" />}
                              </span>
                              INEFFECTIVE
                            </Label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={addEvidenceItem}
              className="text-green-600 hover:bg-green-50 hover:text-green-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              <span className="font-bold">ADD ADDITIONAL EVIDENCE ITEM</span>
            </Button>
          </div>
        </div>
        {/* Justification for Classification */}
        <div ref={refJustificationForClassification} className={cn("rounded-lg border border-gray-200 bg-white p-6 shadow-sm mx-8 my-4", fieldErrors.justificationForClassification && "border-2 border-red-500 bg-red-50/30")}>
          <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-gray-900">
            JUSTIFICATION FOR CLASSIFICATION
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            MANDATORY EXPLANATION: WHY MA OR MI?
          </p>
          <div className={cn("overflow-hidden rounded-lg border", fieldErrors.justificationForClassification ? "border-red-500" : "border-gray-200")}>
            <FroalaEditor
              tag="textarea"
              model={justificationForClassification}
              onModelChange={setJustificationForClassification}
              config={{
                heightMin: 140,
                placeholderText: "Provide a logical justification based on the severity of the deviation and its impact on the management system...",
                charCounterCount: true,
              }}
            />
          </div>
          {fieldErrors.justificationForClassification && (
            <p className="mt-2 text-sm font-medium text-red-600">{fieldErrors.justificationForClassification}</p>
          )}
        </div>

        {/* OFI / Positive Aspect Recording */}
        <div className="rounded-lg border border-green-200 bg-green-50/50 p-6 shadow-sm mx-8 my-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-900">
              OFI / POSITIVE ASPECT RECORDING
            </h2>
            <span className="rounded-full border border-green-400 px-3 py-1 text-xs font-medium text-green-700">
              OPTIONAL DOCUMENTATION FLOW
            </span>
          </div>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-200 bg-gray-50">
                  <TableHead className="text-xs font-semibold uppercase text-gray-700">OFI REF #</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-gray-700">STANDARD</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-gray-700">SITE</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-gray-700">PROCESS / AREA</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-gray-700">CLAUSE</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-gray-700">SUBCLAUSES (IF ANY)</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-gray-700">OFI / PA</TableHead>
                  <TableHead className="w-10 text-xs font-semibold uppercase text-gray-700"> </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ofiRows.map((row) => (
                  <TableRow key={row.id} className="border-gray-200">
                    <TableCell className="p-2">
                      <Input
                        value={row.ofiRef}
                        onChange={(e) => updateOfiRow(row.id, "ofiRef", e.target.value)}
                        className="h-8 border-gray-200 text-xs"
                        placeholder="e.g. OFI-2026-001"
                      />
                    </TableCell>
                    <TableCell className="p-2">
                      <Input
                        value={row.standard}
                        onChange={(e) => updateOfiRow(row.id, "standard", e.target.value)}
                        className="h-8 border-gray-200 text-xs"
                        placeholder="ISO 9001:2015"
                      />
                    </TableCell>
                    <TableCell className="p-2">
                      <Input
                        value={row.site}
                        onChange={(e) => updateOfiRow(row.id, "site", e.target.value)}
                        className="h-8 border-gray-200 text-xs"
                        placeholder="SITE A"
                      />
                    </TableCell>
                    <TableCell className="p-2">
                      <Input
                        value={row.processArea}
                        onChange={(e) => updateOfiRow(row.id, "processArea", e.target.value)}
                        className="h-8 border-gray-200 text-xs"
                        placeholder="PRODUCTION"
                      />
                    </TableCell>
                    <TableCell className="p-2">
                      <Input
                        value={row.clause}
                        onChange={(e) => updateOfiRow(row.id, "clause", e.target.value)}
                        className="h-8 border-gray-200 text-xs font-bold"
                        placeholder="7.1.3"
                      />
                    </TableCell>
                    <TableCell className="p-2">
                      <Input
                        value={row.subclauses}
                        onChange={(e) => updateOfiRow(row.id, "subclauses", e.target.value)}
                        className="h-8 border-gray-200 text-xs"
                        placeholder="N/A"
                      />
                    </TableCell>
                    <TableCell className="p-2">
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setOfiPa(row.id, "ofi")}
                          className={cn(
                            "h-auto rounded-md px-2 py-1 text-xs font-medium",
                            row.ofiPa === "ofi"
                              ? "bg-blue-100 text-blue-700 border-blue-200"
                              : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                          )}
                        >
                          OFI
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setOfiPa(row.id, "pa")}
                          className={cn(
                            "h-auto rounded-md px-2 py-1 text-xs font-medium",
                            row.ofiPa === "pa"
                              ? "bg-green-100 text-green-700 border-green-200"
                              : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                          )}
                        >
                          PA
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="p-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-500 hover:text-red-600"
                        onClick={() => removeOfiRow(row.id)}
                        aria-label="Remove row"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={addOfiRow}
            className="mt-4 border-green-400 bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800"
          >
            <Plus className="mr-2 h-4 w-4" />
            + ADD MORE OFIS / POSITIVE ASPECTS
          </Button>
        </div>
        {/* Audit Nonconformity Matrix */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm mx-8 my-4">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-900">
            AUDIT NONCONFORMITY MATRIX
          </h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-200 bg-gray-100">
                  <TableHead className="text-xs font-semibold uppercase text-gray-700">
                    NONCONFORMITY REFERENCE
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-gray-700">STANDARD</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-gray-700">SITE</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-gray-700">PROCESS / AREA</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-gray-700">CLAUSE</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="border-gray-200 bg-white">
                  <TableCell className="text-sm text-gray-700">
                    <span className="text-xs text-gray-500">REF:</span>{" "}
                    NC/2806/51/P3/FRA/881
                  </TableCell>
                  <TableCell className="text-sm text-gray-700">ISO 9001:2015</TableCell>
                  <TableCell className="text-sm font-bold text-gray-900">SITE A</TableCell>
                  <TableCell className="text-sm text-gray-700">HR</TableCell>
                  <TableCell className="text-sm font-bold text-red-600">5.2.1</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex gap-3 rounded-lg border border-amber-200 bg-amber-50/80 p-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
            <div className="min-w-0 space-y-1 text-sm">
              <p className="font-bold text-gray-900">
                SYSTEM AUTOMATION RULE (MATRIX LOGIC)
              </p>
              <p className="text-gray-700">
                Nonconformity references follow the global standard{" "}
                <span className="underline text-blue-600">Module</span>/
                <span className="underline text-blue-600">Year</span>/
                <span className="underline text-blue-600">Site</span>/
                <span className="underline text-blue-600">Process</span>/
                <span className="underline text-blue-600">AuditType</span>/
                <span className="underline text-blue-600">NCE</span>
              </p>
              <p className="text-gray-600">
                All Major (MA) nonconformities trigger a mandatory follow-up audit within 30 days, while Minor (m) NCs require CA submission within 60 days.
              </p>
            </div>
          </div>
        </div>
        {/* Save & Continue Checklist Loop — ONLY for Minor/Major NC (CA) */}
        {isCurrentMinorOrMajorNc && isCaOpenForCurrentRow && (
          <div className="flex justify-center">
            <Button
            type="button"
            className="rounded-full border-2 border-green-500 bg-white px-8 py-6 text-base font-bold uppercase text-green-600 hover:bg-green-50 hover:text-green-700"
            disabled={!auditPlanIdFromUrl || savingFindings || planStatus === "findings_submitted_to_auditee"}
            onClick={async () => {
              if (!orgId || !auditPlanIdFromUrl || planStatus === "findings_submitted_to_auditee") return;
              setFieldErrors({});
              const wasDocumentingCA = !!activeCARowId;
              const isCaOpenForThisSave = isCurrentMinorOrMajorNc && isCaOpenForCurrentRow;
              if (isCaOpenForThisSave) {
                const errors: Partial<Record<CaValidationField, string>> = {};
                if (stripHtml(statementOfNonconformity) === "") errors.statementOfNonconformity = "Statement of Nonconformity is required.";
                if (stripHtml(riskJustification) === "") errors.riskJustification = "Risk Justification & Comments is required.";
                if (stripHtml(justificationForClassification) === "") errors.justificationForClassification = "Justification for Classification is required.";
                const evidenceFilled = stripHtml(complianceDetails.evidenceSeen ?? "") !== "" || (currentRow?.evidence ?? "").trim() !== "";
                if (!evidenceFilled) errors.evidenceSeen = "Evidence Seen (or Evidence in the checklist row) is required.";
                if (Object.keys(errors).length > 0) {
                  setFieldErrors(errors);
                  const firstField = firstErrorFieldOrder.find((f) => errors[f]);
                  if (firstField) {
                    const ref = fieldRefs[firstField].current;
                    if (ref) {
                      ref.scrollIntoView({ behavior: "smooth", block: "center" });
                      setTimeout(() => {
                        const focusable = ref.querySelector<HTMLElement>("textarea, [contenteditable=\"true\"], .fr-element");
                        if (focusable) focusable.focus();
                      }, 400);
                    }
                  }
                  return;
                }
              }
              setSavingFindings(true);
              try {
                const rowsToSave = rowsRef.current.length > 0 ? rowsRef.current : rows;
                const rowsToPersist = rowsToSave.filter((r) => !isTrulyEmptyFindingRow(r));
                const findings = rowsToPersist.map((r, i) => {
                  const isActiveCA = activeCARowId === r.id;
                  return {
                    rowIndex: i,
                    standard: r.standard,
                    clause: r.clause,
                    subclauses: r.subclauses,
                    requirement: r.requirement,
                    question: r.question,
                    evidenceExample: r.evidenceExample,
                    evidenceSeen: isActiveCA ? (complianceDetails.evidenceSeen ?? r.evidence) : r.evidence,
                    status: r.status,
                    statementOfNonconformity: isActiveCA ? (statementOfNonconformity || r.statementOfNonconformity) : r.statementOfNonconformity,
                    riskSeverity: isActiveCA ? riskSeverity : r.riskSeverity,
                    riskJustification: isActiveCA ? riskJustification : r.riskJustification,
                    justificationForClassification: isActiveCA ? justificationForClassification : r.justificationForClassification,
                    objectiveEvidence: isActiveCA ? evidenceItems : r.objectiveEvidence,
                  };
                });
                await apiClient.saveAuditPlanFindings(orgId, auditPlanIdFromUrl, findings);
                // Keep in-memory rows consistent so empty manual rows don't reappear.
                setRows(rowsToPersist);
                if (wasDocumentingCA && activeCARowId) {
                  updateRow(activeCARowId, "evidence", complianceDetails.evidenceSeen ?? "");
                  updateRow(activeCARowId, "statementOfNonconformity", statementOfNonconformity);
                  updateRow(activeCARowId, "riskSeverity", riskSeverity);
                  updateRow(activeCARowId, "riskJustification", riskJustification);
                  updateRow(activeCARowId, "justificationForClassification", justificationForClassification);
                  updateRow(activeCARowId, "objectiveEvidence", evidenceItems as any);
                  setActiveCARowId(null);
                  setComplianceDetails(EMPTY_COMPLIANCE_DETAILS);
                  setRiskSeverity("medium");
                  setStatementOfNonconformity("");
                  setRiskJustification("");
                  setEvidenceItems(DEFAULT_EVIDENCE_ITEMS.map((item) => ({ ...item })));
                  setJustificationForClassification("");
                  setCurrentQuestionIndex((i) => Math.min(i + 1, filteredRows.length));
                  setTimeout(() => {
                    checklistTableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }, 150);
                }
                const nextIndex = Math.min(currentQuestionIndex + 1, filteredRows.length);
                if (nextIndex >= filteredRows.length) router.push(`/dashboard/${orgId}/audit`);
              } catch (e) {
                console.error(e);
              } finally {
                setSavingFindings(false);
              }
            }}
          >
            <Paperclip className="mr-2 h-5 w-5" />
            {savingFindings ? "Saving…" : "SAVE & CONTINUE CHECKLIST LOOP"}
          </Button>
          </div>
        )}
        {/* Submission summary card (dark) — dynamic from plan */}
        <div className="rounded-xl border-2 border-green-500/40 bg-gray-900 p-6 shadow-lg ring-2 ring-green-400/20 md:p-8 mx-8 my-4">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Auditor Profile */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-400">
                <UserCheck className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">Auditor Profile</span>
              </div>
              <p className="text-xl font-bold text-white">{leadAuditorDisplay.split(" | ")[0] || "—"}</p>
              <p className="text-sm text-gray-400">{leadAuditorDisplay}</p>
            </div>
            {/* Audit Timeline */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-400">
                <Clock className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">Audit Timeline</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <span className="text-gray-500">START DATE</span>
                <span className="text-white">{submissionCard.startDate}</span>
                <span className="text-gray-500">END DATE</span>
                <span className="text-white">{submissionCard.endDate}</span>
                <span className="text-gray-500">TOTAL MAN-DAYS</span>
                <span className="text-white">{submissionCard.manDays}</span>
                <span className="text-gray-500">SUBMISSION DATE</span>
                <span className="text-white">{submissionCard.submissionDate}</span>
              </div>
            </div>
            {/* Authentication Key */}
            <div className="flex flex-col items-start gap-2 md:items-end">
              <div className="flex flex-col items-center gap-2 rounded-lg bg-gray-800 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-700">
                  <ShieldCheck className="h-7 w-7 text-red-500" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Authentication Key</span>
                <span className="text-sm font-medium text-gray-300">{submissionCard.authKey}</span>
              </div>
            </div>
          </div>
          {/* Final Submission Notice */}
          <div className="mt-6 flex gap-3 rounded-lg border border-red-300 bg-red-950/50 p-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" aria-hidden />
            <p className="text-sm font-medium text-red-100">
              FINAL SUBMISSION NOTICE: SUBMITTING THIS FORM TO THE AUDITEE WILL LOCK STEP 3 PERMANENTLY. NO FURTHER MODIFICATIONS TO FINDINGS OR EVIDENCE CAN BE MADE AFTER THIS ACTION.
            </p>
          </div>
          {/* Submit to Auditee — sets status findings_submitted_to_auditee; auditor can do nothing after */}
          <div className="mt-6 flex justify-center gap-2">
            <Button
              type="button"
              className="rounded-lg bg-green-600 px-8 py-6 text-base font-bold uppercase text-white hover:bg-green-700"
              disabled={!auditPlanIdFromUrl || savingFindings || planStatus === "findings_submitted_to_auditee"}
              onClick={async () => {
                if (!orgId || !auditPlanIdFromUrl || planStatus === "findings_submitted_to_auditee") return;
                setSavingFindings(true);
                try {
                  const rowsToSave = rowsRef.current.length > 0 ? rowsRef.current : rows;
                  const rowsToPersist = rowsToSave.filter((r) => !isTrulyEmptyFindingRow(r));
                  const findings = rowsToPersist.map((r, i) => {
                    const isActiveCA = activeCARowId === r.id;
                    return {
                      rowIndex: i,
                      standard: r.standard,
                      clause: r.clause,
                      subclauses: r.subclauses,
                      requirement: r.requirement,
                      question: r.question,
                      evidenceExample: r.evidenceExample,
                      evidenceSeen: isActiveCA ? (complianceDetails.evidenceSeen ?? r.evidence) : r.evidence,
                      status: r.status,
                      statementOfNonconformity: isActiveCA ? (statementOfNonconformity || r.statementOfNonconformity) : r.statementOfNonconformity,
                      riskSeverity: isActiveCA ? riskSeverity : r.riskSeverity,
                    riskJustification: isActiveCA ? riskJustification : r.riskJustification,
                    justificationForClassification: isActiveCA ? justificationForClassification : r.justificationForClassification,
                    objectiveEvidence: isActiveCA ? evidenceItems : r.objectiveEvidence,
                    };
                  });
                  await apiClient.saveAuditPlanFindings(orgId, auditPlanIdFromUrl, findings);
                  setRows(rowsToPersist);
                  if (activeCARowId) {
                    updateRow(activeCARowId, "evidence", complianceDetails.evidenceSeen ?? "");
                    updateRow(activeCARowId, "statementOfNonconformity", statementOfNonconformity);
                    updateRow(activeCARowId, "riskSeverity", riskSeverity);
                  }
                  router.push(`/dashboard/${orgId}/audit`);
                } catch (e) {
                  console.error(e);
                } finally {
                  setSavingFindings(false);
                }
              }}
            >
              <Save className="mr-2 h-5 w-5" />
              {savingFindings ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              className="rounded-lg bg-red-600 px-8 py-6 text-base font-bold uppercase text-white hover:bg-red-700"
              disabled={!auditPlanIdFromUrl || submittingToAuditee || planStatus === "findings_submitted_to_auditee"}
              onClick={async () => {
                if (!orgId || !auditPlanIdFromUrl || planStatus === "findings_submitted_to_auditee") return;
                setSubmittingToAuditee(true);
                try {
                  const rowsToSave = rowsRef.current.length > 0 ? rowsRef.current : rows;
                  const rowsToPersist = rowsToSave.filter((r) => !isTrulyEmptyFindingRow(r));
                  const findingsForSubmit = rowsToPersist.map((r) => {
                    const isActiveCA = activeCARowId === r.id;
                    return {
                      standard: r.standard, clause: r.clause, subclauses: r.subclauses, requirement: r.requirement,
                      question: r.question, evidenceExample: r.evidenceExample,
                      evidenceSeen: isActiveCA ? (complianceDetails.evidenceSeen ?? r.evidence) : r.evidence,
                      status: r.status,
                      statementOfNonconformity: isActiveCA ? (statementOfNonconformity || r.statementOfNonconformity) : r.statementOfNonconformity,
                      riskSeverity: isActiveCA ? riskSeverity : r.riskSeverity,
                      riskJustification: isActiveCA ? riskJustification : r.riskJustification,
                      justificationForClassification: isActiveCA ? justificationForClassification : r.justificationForClassification,
                      objectiveEvidence: isActiveCA ? evidenceItems : r.objectiveEvidence,
                    };
                  });
                  await apiClient.saveAuditPlanFindings(orgId, auditPlanIdFromUrl, findingsForSubmit);
                  setRows(rowsToPersist);
                  await apiClient.updateAuditPlanStatus(orgId, auditPlanIdFromUrl, "findings_submitted_to_auditee");
                  const params = new URLSearchParams();
                  if (programIdFromUrl || resolvedProgramId) params.set("programId", programIdFromUrl || resolvedProgramId || "");
                  if (criteria) params.set("criteria", criteria);
                  if (auditPlanIdFromUrl) params.set("auditPlanId", auditPlanIdFromUrl);
                  router.push(`/dashboard/${orgId}/audit/create/4${params.toString() ? `?${params.toString()}` : ""}`);
                } catch (e) {
                  console.error(e);
                } finally {
                  setSubmittingToAuditee(false);
                }
              }}
            >
              <Send className="mr-2 h-5 w-5" />
              {submittingToAuditee ? "Submitting…" : "SUBMIT TO AUDITEE"}
            </Button>
          </div>
        </div>
      </div>
      {/* Bottom navigation */}
      {/* <div className="flex items-center justify-between py-4">
        <Button
          variant="outline"
          className="border-gray-300 text-gray-600 hover:bg-gray-50"
          asChild
        >
          <Link
            href={(() => {
              const params = new URLSearchParams();
              const pid = programIdFromUrl || resolvedProgramId;
              if (pid) params.set("programId", pid);
              if (criteria) params.set("criteria", criteria);
              if (auditPlanIdFromUrl) params.set("auditPlanId", auditPlanIdFromUrl);
              const q = params.toString();
              return `/dashboard/${orgId}/audit/create/2${q ? `?${q}` : ""}`;
            })()}
            className="inline-flex items-center gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous Step
          </Link>
        </Button>
        <Button
          className="bg-green-600 text-white hover:bg-green-700"
          asChild
        >
          <Link
            href={(() => {
              const params = new URLSearchParams();
              const pid = programIdFromUrl || resolvedProgramId;
              if (pid) params.set("programId", pid);
              if (criteria) params.set("criteria", criteria);
              if (auditPlanIdFromUrl) params.set("auditPlanId", auditPlanIdFromUrl);
              const q = params.toString();
              return `/dashboard/${orgId}/audit/create/4${q ? `?${q}` : ""}`;
            })()}
            className="inline-flex items-center gap-2"
          >
            Save & Continue
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div> */}
        </div>
    </div>
  );
}
