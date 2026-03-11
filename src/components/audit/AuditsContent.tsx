"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { getDashboardPath } from "@/lib/subdomain";
import { apiClient } from "@/lib/api-client";
import { useOrg } from "@/components/providers/org-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  EllipsisVertical,
  Funnel,
  Plus,
  Search,
  Cloud,
  Folder,
  Upload,
  History,
  Pencil,
  FileEdit,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import AuditHistoryDialog, { AuditHistoryEntry } from "./AuditHistoryDialog";

const NEXT_STEP_LABELS: Record<number, string> = {
  3: "Complete Findings (Step 3)",
  4: "Corrective Action (Step 4)",
  5: "Effectiveness Verification (Step 5)",
  6: "Final Closure (Step 6)",
};

type Audit = {
  id: string;
  auditProgramRef: string; // "Audit/Year/Site/Process/Audit Type"
  auditPlanId?: string;
  auditProgramId?: string;
  nextStepForUser?: number | null;
  /** Raw status from API for role logic (e.g. "closed") */
  planStatus?: string;
  leadAuditorUserId?: string | null;
  auditeeUserId?: string | null;
  assignedAuditorIds?: string[];
  standard: string;
  scopeMethodBoundaries: string;
  auditType: string;
  site: string;
  process: string;
  clause: string;
  subclauses: string;
  ncClassification: "Major" | "Minor";
  riskLevel: string;
  plannedDate: string;
  actualDate: string;
  dueDate: string;
  kpiScore: string | null;
  auditStatus: string;
  criteria?: string;
};

function TableHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-semibold text-gray-800">{title}</span>
      {sub && <span className="text-xs font-normal text-gray-500">{sub}</span>}
    </div>
  );
}

const getClassificationColor = (classification: string) => {
  if (classification === "Major") return "bg-red-500 text-white";
  return "bg-yellow-100 text-yellow-800";
};

const getRiskLevelColor = (riskLevel: string) => {
  if (riskLevel === "High") return "bg-red-500 text-white";
  if (riskLevel === "Medium") return "bg-yellow-100 text-yellow-800";
  return "bg-blue-100 text-blue-800";
};

/** Audit status labels with day thresholds: Success ≤ 30 days / In-Progress < 30 days / Pending > 30 days / Fail > 40 days */
const AUDIT_STATUS_SUCCESS = "Success ≤ 30 days";
const AUDIT_STATUS_IN_PROGRESS = "In-Progress < 30 days";
const AUDIT_STATUS_PENDING = "Pending > 30 days";
const AUDIT_STATUS_FAIL = "Fail > 40 days";

function getAuditStatusByDays(
  planStatus: string,
  plannedDate: string | null,
  datePrepared: string | null,
  createdAt: string | null
): string {
  const refDate = plannedDate || datePrepared || createdAt;
  const refTime = refDate ? new Date(refDate).getTime() : Date.now();
  const days = Math.floor((Date.now() - refTime) / (24 * 60 * 60 * 1000));

  if (planStatus === "closed") return AUDIT_STATUS_SUCCESS;
  const inProgress = [
    "plan_submitted_to_auditee",
    "findings_submitted_to_auditee",
    "ca_submitted_to_auditor",
    "pending_closure",
    "verification_ineffective",
  ].includes(planStatus);
  if (inProgress || planStatus === "draft") {
    if (days < 30) return AUDIT_STATUS_IN_PROGRESS;
    if (days <= 40) return AUDIT_STATUS_PENDING;
    return AUDIT_STATUS_FAIL;
  }
  if (days < 30) return AUDIT_STATUS_IN_PROGRESS;
  if (days <= 40) return AUDIT_STATUS_PENDING;
  return AUDIT_STATUS_FAIL;
}

const getStatusColor = (status: string) => {
  if (status === AUDIT_STATUS_SUCCESS) return "bg-green-100 text-green-800";
  if (status === AUDIT_STATUS_IN_PROGRESS) return "bg-yellow-100 text-yellow-800";
  if (status === AUDIT_STATUS_PENDING) return "bg-gray-100 text-gray-800";
  if (status === AUDIT_STATUS_FAIL) return "bg-red-100 text-red-700";
  return "";
};

/** Steps 1,2,6 = lead; 3,5 = auditor; 4 = auditee. Edit only for own tab; no edit after closed. */
function canEditAudit(audit: Audit, currentUserId: string | null): boolean {
  if (!currentUserId || audit.planStatus === "closed") return false;
  const isLead = audit.leadAuditorUserId === currentUserId;
  const isAuditee = audit.auditeeUserId === currentUserId;
  const isAssigned = (audit.assignedAuditorIds ?? []).includes(currentUserId);
  const step = audit.nextStepForUser;
  return (
    (isLead && (step === 6 || step == null)) ||
    (isAssigned && (step === 3 || step === 5)) ||
    (isAuditee && step === 4)
  );
}

/** Step to open when user clicks Edit: 2 for lead (plan form) when no step, else their step. */
function getEditStep(audit: Audit, currentUserId: string | null): number | null {
  if (!currentUserId) return null;
  const step = audit.nextStepForUser;
  if (step != null && step >= 3 && step <= 6) return step;
  return audit.leadAuditorUserId === currentUserId ? 2 : null;
}

function getColumns(
  handleViewHistory: (audit: Audit) => void,
  handleOpenStep: (audit: Audit, step: number) => void,
  handleEditAudit: (audit: Audit, step: number) => void,
  currentUserId: string | null
): ColumnDef<Audit>[] {
  return [
  {
    accessorKey: "auditProgramRef",
    header: () => <TableHeader title="Audit Program Ref." sub="(Audit/Year/Site/Process/Audit Type)" />,
    cell: ({ row }) => <span className="font-medium text-gray-900">{row.original.auditProgramRef}</span>,
  },
  {
    accessorKey: "standard",
    header: () => <TableHeader title="Standard" sub="(e.g., ISO 9001, ESG & Sustainability)" />,
    cell: ({ row }) => <span className="text-gray-700">{row.original.standard}</span>,
  },
  {
    accessorKey: "scopeMethodBoundaries",
    header: () => <TableHeader title="Scope, Method & Boundaries" sub="(On-Site/Remote/Hybrid)" />,
    cell: ({ row }) => <span className="text-gray-700">{row.original.scopeMethodBoundaries}</span>,
  },
  {
    accessorKey: "auditType",
    header: () => <TableHeader title="Audit Type" sub="FPA/SPA/TPA" />,
    cell: ({ row }) => (
      <span className="bg-gray-100 text-gray-700 py-1 px-2 rounded-full text-xs font-medium">
        {row.original.auditType}
      </span>
    ),
  },
  {
    accessorKey: "site",
    header: () => <TableHeader title="Site" />,
    cell: ({ row }) => <span className="text-gray-700">{row.original.site}</span>,
  },
  {
    accessorKey: "process",
    header: () => <TableHeader title="Process" />,
    cell: ({ row }) => <span className="text-gray-700">{row.original.process}</span>,
  },
  {
    accessorKey: "clause",
    header: () => <TableHeader title="Clause" />,
    cell: ({ row }) => <span className="text-gray-700">{row.original.clause}</span>,
  },
  {
    accessorKey: "subclauses",
    header: () => <TableHeader title="Subclauses" />,
    cell: ({ row }) => <span className="text-gray-700">{row.original.subclauses}</span>,
  },
  {
    accessorKey: "ncClassification",
    header: () => <TableHeader title="NC Classification" sub="(Major/Minor)" />,
    cell: ({ row }) => {
      const label = row.original.ncClassification === "Major" ? "MA" : "mi";
      return (
        <span className={`${getClassificationColor(row.original.ncClassification)} py-1 px-2 rounded-full text-xs font-medium`}>
          {label}
        </span>
      );
    },
  },
  {
    accessorKey: "riskLevel",
    header: () => <TableHeader title="Risk Level" sub="(High/Medium/Low)" />,
    cell: ({ row }) => (
      <span className={`${getRiskLevelColor(row.original.riskLevel)} py-1 px-2 rounded-full text-xs font-medium`}>
        {row.original.riskLevel}
      </span>
    ),
  },
  {
    accessorKey: "plannedDate",
    header: () => <TableHeader title="Planned Date" />,
    cell: ({ row }) => <span className="text-gray-700">{row.original.plannedDate}</span>,
  },
  {
    accessorKey: "actualDate",
    header: () => <TableHeader title="Actual Date" />,
    cell: ({ row }) => (
      <span className="text-gray-700">{row.original.actualDate || "—"}</span>
    ),
  },
  {
    accessorKey: "dueDate",
    header: () => <TableHeader title="Due Date (30 days)" />,
    cell: ({ row }) => <span className="text-gray-700">{row.original.dueDate}</span>,
  },
  {
    accessorKey: "kpiScore",
    header: () => <TableHeader title="KPI (Score)" />,
    cell: ({ row }) => {
      const score = row.original.kpiScore;
      if (!score) return <span className="text-gray-400">—</span>;
      if (score === "Consistent" || score.toLowerCase() === "consistent")
        return <span className="font-medium text-green-600">Consistent</span>;
      if (score === "Inconsistent" || score.toLowerCase() === "inconsistent")
        return <span className="font-medium text-red-600">Inconsistent</span>;
      return <span className="text-gray-700">{score}</span>;
    },
  },
  {
    accessorKey: "auditStatus",
    header: () => (
      <TableHeader
        title="Audit Status"
        sub={"Success ≤ 30 days / In-Progress < 30 days / Pending > 30 days / Fail > 40 days"}
      />
    ),
    cell: ({ row }) => {
      const status = row.original.auditStatus;
      const badgeClass = getStatusColor(status);
      if (!badgeClass) return <span className="text-gray-700">{status}</span>;
      return (
        <span className={`${badgeClass} py-1 px-2 rounded-full text-xs font-medium`}>
          {status}
        </span>
      );
    },
  },
  {
    accessorKey: "nextStepForUser",
    id: "yourAction",
    header: () => <TableHeader title="Your Action" sub="Step requiring your input or Complete" />,
    cell: ({ row }) => {
      const audit = row.original;
      if (audit.planStatus === "closed") {
        return (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleOpenStep(audit, 1); }}
            className="text-sm font-medium text-green-700 hover:underline focus:outline-none"
          >
            Complete
          </button>
        );
      }
      const step = audit.nextStepForUser;
      if (step == null) return <span className="text-gray-400">—</span>;
      return (
        <span className="text-sm font-medium text-green-700">
          {NEXT_STEP_LABELS[step] ?? `Step ${step}`}
        </span>
      );
    },
  },
  {
    id: "actions",
    header: () => <TableHeader title="Actions" sub="View Share Download PDF" />,
    cell: ({ row }) => {
      const audit = row.original;
      const step = audit.nextStepForUser;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200"
              onClick={(e) => e.stopPropagation()}
            >
              <EllipsisVertical size={18} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
            {audit.planStatus === "closed" && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenStep(audit, 1); }}>
                <Pencil className="mr-2 h-4 w-4" />
                View audit (all steps)
              </DropdownMenuItem>
            )}
            {canEditAudit(audit, currentUserId) && getEditStep(audit, currentUserId) != null && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); const s = getEditStep(audit, currentUserId); if (s != null) handleEditAudit(audit, s); }}>
                <FileEdit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => handleViewHistory(audit)}>
              <History className="mr-2 h-4 w-4" />
              View History
            </DropdownMenuItem>
            {step != null && audit.planStatus !== "closed" && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenStep(audit, step); }}>
                <Pencil className="mr-2 h-4 w-4" />
                {NEXT_STEP_LABELS[step] ?? `Open Step ${step}`}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
  ];
}

function formatDate(date: string | Date | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-");
}

function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mapPlansToAudits(list: any[]): Audit[] {
  return list.map((p: any) => {
    const auditPart = p.auditNumber || p.id || "—";
    const dateForYear = p.plannedDate || p.datePrepared || p.createdAt;
    const year = dateForYear ? new Date(dateForYear).getFullYear() : "—";
    const site = p.site ?? p.siteName ?? p.programSite ?? "—";
    const process = p.process ?? p.processName ?? p.programProcess ?? "—";
    const auditType = (p.auditType || "FPA").toString().toUpperCase();
    const auditProgramRef = `${auditPart}/${year}/${site}/${process}/${auditType}`;
    const plannedDateFormatted = p.plannedDate ? formatDate(p.plannedDate) : "—";
    const dueDate =
      p.plannedDate
        ? formatDate(new Date(new Date(p.plannedDate).getTime() + 30 * 24 * 60 * 60 * 1000))
        : "—";
    const kpiScore =
      p.kpiScore != null && String(p.kpiScore).trim() !== "" ? String(p.kpiScore).trim() : null;
    return {
      id: p.auditNumber || p.id,
      auditProgramRef,
      auditPlanId: p.id,
      auditProgramId: p.auditProgramId,
      nextStepForUser: p.nextStepForUser ?? null,
      planStatus: p.status,
      leadAuditorUserId: p.leadAuditorUserId ?? null,
      auditeeUserId: p.auditeeUserId ?? null,
      assignedAuditorIds: p.assignedAuditorIds ?? [],
      standard: p.criteria || p.programCriteria || "—",
      scopeMethodBoundaries: "On-Site",
      auditType,
      site,
      process,
      clause: p.firstClause ?? p.clause ?? "—",
      subclauses: p.firstSubclauses ?? p.subclauses ?? "—",
      ncClassification: "Minor",
      riskLevel: "Medium",
      plannedDate: plannedDateFormatted,
      actualDate: p.findingsSubmittedAt ? formatDate(p.findingsSubmittedAt) : "—",
      dueDate,
      kpiScore,
      auditStatus: getAuditStatusByDays(p.status, p.plannedDate ?? null, p.datePrepared ?? null, p.createdAt ?? null),
      criteria: p.criteria,
    };
  });
}

function buildAuditHistoryEntries(plan: any, audit: Audit): AuditHistoryEntry[] {
  const entries: AuditHistoryEntry[] = [];
  const createdAt: string | null = plan.createdAt ?? plan.planSubmittedAt ?? null;

  if (createdAt) {
    entries.push({
      id: "created",
      type: "Created",
      title: "Audit created",
      description: `Audit plan created${plan.criteria ? ` (criteria: ${plan.criteria})` : ""}.`,
      date: formatDateTime(createdAt),
      by: "Lead Auditor",
    });
  }

  if (plan.planSubmittedAt) {
    entries.push({
      id: "plan_submitted",
      type: "Updated",
      title: "Plan submitted to auditee",
      description: "Lead auditor submitted the audit plan to the auditee.",
      date: formatDateTime(plan.planSubmittedAt),
      by: "Lead Auditor",
    });
  }

  if (plan.findingsSubmittedAt) {
    entries.push({
      id: "findings_submitted",
      type: "Updated",
      title: "Findings submitted to auditee",
      description: "Assigned auditor submitted audit findings to the auditee.",
      date: formatDateTime(plan.findingsSubmittedAt),
      by: "Assigned Auditor",
    });
  }

  const step4 = plan.step4Data as { auditeeComments?: string; dateOfReview?: string } | null | undefined;
  if (step4 && plan.status && ["ca_submitted_to_auditor", "pending_closure", "verification_ineffective", "closed"].includes(plan.status)) {
    entries.push({
      id: "ca_submitted",
      type: "Updated",
      title: "Corrective action submitted",
      description: step4.auditeeComments && String(step4.auditeeComments).trim().length > 0
        ? String(step4.auditeeComments)
        : "Auditee submitted systemic corrective action for review.",
      date: formatDateTime(step4.dateOfReview ?? plan.updatedAt ?? plan.planSubmittedAt ?? plan.createdAt ?? null),
      by: "Auditee",
    });
  }

  const step5 = plan.step5Data as { verificationOutcome?: string; auditorComments?: string; verificationStartedAt?: string } | null | undefined;
  if (step5 && (step5.verificationOutcome === "effective" || step5.verificationOutcome === "ineffective")) {
    entries.push({
      id: "step5_verification",
      type: "Updated",
      title: `Effectiveness verification marked ${step5.verificationOutcome === "effective" ? "effective" : "ineffective"}`,
      description: step5.auditorComments && String(step5.auditorComments).trim().length > 0
        ? String(step5.auditorComments)
        : step5.verificationOutcome === "effective"
          ? "Assigned auditor verified corrective actions as effective."
          : "Assigned auditor marked corrective actions as ineffective.",
      date: formatDateTime(step5.verificationStartedAt ?? plan.updatedAt ?? null),
      by: "Assigned Auditor",
    });

    if (step5.verificationOutcome === "ineffective") {
      entries.push({
        id: "returned_step5",
        type: "Escalated",
        title: "Returned to auditee from Step 5",
        description: step5.auditorComments && String(step5.auditorComments).trim().length > 0
          ? String(step5.auditorComments)
          : "Audit was returned to the auditee from Step 5 for revised corrective action.",
        date: formatDateTime(step5.verificationStartedAt ?? plan.updatedAt ?? null),
        by: "Assigned Auditor",
      });
    }
  }

  const step6 = plan.step6Data as { finalDecision?: string; managementComments?: string; dateApproved?: string; timeApproved?: string } | null | undefined;
  if (step6 && (step6.finalDecision === "effective" || step6.finalDecision === "ineffective")) {
    const decisionDateString = step6.dateApproved
      ? `${step6.dateApproved} ${step6.timeApproved ?? ""}`.trim()
      : null;
    entries.push({
      id: "step6_decision",
      type: step6.finalDecision === "effective" ? "Updated" : "Escalated",
      title: step6.finalDecision === "effective" ? "Audit finalized and closed" : "Audit re-opened by management",
      description: step6.managementComments && String(step6.managementComments).trim().length > 0
        ? String(step6.managementComments)
        : step6.finalDecision === "effective"
          ? "Management confirmed all findings are addressed and closed the audit."
          : "Management decided the audit does not meet closure criteria and re-opened it for further action.",
      date: formatDateTime(decisionDateString || plan.updatedAt || null),
      by: "Lead Auditor / Management",
    });

    if (step6.finalDecision === "ineffective") {
      entries.push({
        id: "returned_step6",
        type: "Escalated",
        title: "Returned to auditee from Step 6",
        description: step6.managementComments && String(step6.managementComments).trim().length > 0
          ? String(step6.managementComments)
          : "Audit was returned to the auditee from Step 6 for additional corrective action.",
        date: formatDateTime(decisionDateString || plan.updatedAt || null),
        by: "Lead Auditor / Management",
      });
    }
  }

  return entries;
}

export default function AuditsContent() {
  const router = useRouter();
  const { data: session } = useSession();
  const currentUserId = (session?.user as { id?: string })?.id ?? null;
  const { slug } = useOrg();
  const [historyAudit, setHistoryAudit] = useState<Audit | null>(null);
  const [historyEntries, setHistoryEntries] = useState<AuditHistoryEntry[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const createAuditHref = getDashboardPath(slug, "audit/create/1");

  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ["auditPlans", slug],
    queryFn: () => apiClient.getAuditPlans(slug),
    enabled: !!slug,
    staleTime: 60 * 1000,
  });

  const audits = useMemo(
    () => (plansData?.plans ? mapPlansToAudits(plansData.plans) : []),
    [plansData?.plans]
  );

  const handleViewHistory = useCallback(
    async (audit: Audit) => {
      if (!slug || !audit.auditPlanId) return;
      setHistoryAudit(audit);
      setHistoryLoading(true);
      try {
        const res = await apiClient.getAuditPlan(slug, audit.auditPlanId);
        const plan = (res as { plan?: any }).plan;
        if (plan) {
          setHistoryEntries(buildAuditHistoryEntries(plan, audit));
        } else {
          setHistoryEntries([]);
        }
      } catch (e) {
        console.error(e);
        setHistoryEntries([]);
      } finally {
        setHistoryLoading(false);
      }
    },
    [slug]
  );

  const handleEditAudit = useCallback(
    (audit: Audit, step: number) => {
      if (audit.auditPlanId && slug) {
        const params = new URLSearchParams();
        params.set("auditPlanId", audit.auditPlanId);
        if (audit.auditProgramId) params.set("programId", audit.auditProgramId);
        if (audit.criteria) params.set("criteria", audit.criteria);
        router.push(getDashboardPath(slug, `audit/create/${step}`) + (params.toString() ? `?${params.toString()}` : ""));
      }
    },
    [slug, router]
  );

  const handleOpenStep = useCallback(
    (audit: Audit, step: number) => {
      if (audit.auditPlanId && slug) {
        const params = new URLSearchParams();
        params.set("auditPlanId", audit.auditPlanId);
        if (audit.auditProgramId) params.set("programId", audit.auditProgramId);
        if (audit.criteria) params.set("criteria", audit.criteria);
        router.push(getDashboardPath(slug, `audit/create/${step}`) + (params.toString() ? `?${params.toString()}` : ""));
      }
    },
    [slug, router]
  );

  const columns = useMemo(
    () => getColumns(handleViewHistory, handleOpenStep, handleEditAudit, currentUserId),
    [handleViewHistory, handleOpenStep, handleEditAudit, currentUserId]
  );

  const table = useReactTable({
    data: audits,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Audits</h1>
          <p className="text-sm text-gray-600">Internal checks, reviews, and compliance status</p>
        </div>
        <Button variant="dark" className="flex items-center gap-2" asChild>
          <Link href={createAuditHref}>
            <Plus size={18} /> Create Audit
          </Link>
        </Button>
      </div>

      {/* Tenant Information Banner */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Cloud className="text-blue-600" size={20} />
            <div>
              <p className="text-sm font-medium text-gray-900">Active Tenant: Acme Corporation</p>
              <a href="#" className="text-xs text-blue-600 hover:underline">Auth0 Organization</a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Folder className="text-gray-600" size={18} />
              <span className="bg-yellow-100 text-yellow-800 text-xs font-medium py-1 px-2 rounded-full">
                Shared S3
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Upload className="text-gray-600" size={18} />
              <span className="text-sm text-gray-600">100 MB limit</span>
              <span className="bg-blue-600 text-white text-xs font-medium py-1 px-2 rounded-full">
                Pro
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Total Audits</p>
          <p className="text-2xl font-bold text-gray-900">6</p>
          <p className="text-xs text-gray-400 mt-1">All time</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Success Rate</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold text-gray-900">50%</p>
            <span className="bg-green-100 text-green-700 text-xs font-medium py-0.5 px-2 rounded-full">
              Good
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">Clean audits</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Backlogs</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold text-gray-900">2</p>
            <span className="bg-orange-100 text-orange-700 text-xs font-medium py-0.5 px-2 rounded-full">
              Attention
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">Pending audits</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Avg Closure Time</p>
          <p className="text-2xl font-bold text-gray-900">12 days</p>
          <p className="text-xs text-gray-400 mt-1">Average completion</p>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-6">
        <div className="flex-1 flex flex-col sm:flex-row gap-3 sm:gap-2 items-start sm:items-center w-full">
          <div className="relative w-full max-w-md">
            <Search
              size={18}
              className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-500"
            />
            <Input
              className="pl-10 border-none bg-[#F3F3F5]"
              placeholder="Search audits..."
            />
          </div>

          <div className="flex gap-2 sm:gap-3 flex-wrap">
            <Button variant="outline" className="flex items-center gap-2">
              <Funnel size={18} /> Filters
            </Button>
            <Button variant="outline">Sort By</Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <Card className="w-full">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-100">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="p-3 text-left font-medium text-gray-700 whitespace-nowrap border-b border-gray-200"
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>

              <tbody>
                {plansLoading ? (
                  <tr>
                    <td colSpan={columns.length} className="p-8 text-center text-gray-500">
                      Loading audits…
                    </td>
                  </tr>
                ) : table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="p-8 text-center text-gray-500">
                      No audits yet. Create one to get started.
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => {
                        const audit = row.original;
                        if (!audit.auditPlanId) return;
                        const step = getEditStep(audit, currentUserId);
                        if (step != null && canEditAudit(audit, currentUserId)) handleEditAudit(audit, step);
                        else if (audit.nextStepForUser != null) handleOpenStep(audit, audit.nextStepForUser);
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className="p-3 text-gray-700 whitespace-nowrap"
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Audit History Dialog */}
      <AuditHistoryDialog
        open={!!historyAudit}
        onOpenChange={(open) => {
          if (!open) {
            setHistoryAudit(null);
            setHistoryEntries(null);
            setHistoryLoading(false);
          }
        }}
        traceabilityId={historyAudit?.id ?? ""}
        entries={historyEntries ?? []}
        loading={historyLoading}
        detailHistoryHref={historyAudit?.auditPlanId && slug ? `${getDashboardPath(slug, "audit/history")}?auditPlanId=${historyAudit.auditPlanId}` : null}
      />
    </>
  );
}
