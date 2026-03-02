"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { ArrowRight, ArrowUpRight, CalendarIcon, Check, ChevronRight, ExternalLink, Info, Pencil, Plus, Search, Trash2 } from "lucide-react";
import AuditWorkflowHeader from "@/components/audit/AuditWorkflowHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface OrganizationInfo {
  name?: string;
  registrationId?: string;
  industry?: string;
  subIndustry?: string;
}

function formatUIN(registrationId: string | undefined): string {
  if (!registrationId) return "—";
  return registrationId.startsWith("UIN-") ? registrationId : `UIN-${registrationId}`;
}

type SiteItem = { id: string; name: string; code?: string };
type ProcessItem = { id: string; name: string; siteId?: string; siteName?: string };
type MemberItem = { id: string; name: string; email: string; processId?: string; processName?: string; siteId?: string; siteName?: string; additionalRoles?: string[] };

function getProgramIdFromWindow(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("programId");
}

export default function CreateAuditStep1Page() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const orgId = params?.orgId as string;
  const [urlProgramId, setUrlProgramId] = useState<string | null>(() => getProgramIdFromWindow());
  const programIdFromUrl = searchParams.get("programId") ?? urlProgramId;
  const auditPlanIdFromUrl = searchParams.get("auditPlanId") ?? null;
  const currentUserId = (session?.user as { id?: string })?.id ?? null;
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [planStatus, setPlanStatus] = useState<string | null>(null);

  useEffect(() => {
    const q = getProgramIdFromWindow();
    if (q) setUrlProgramId(q);
  }, []);

  // When opened in context of an audit (auditPlanId in URL), fetch plan to know current user role for read-only
  useEffect(() => {
    if (!orgId || !auditPlanIdFromUrl) {
      if (!auditPlanIdFromUrl) setCurrentUserRole(null);
      return;
    }
    let cancelled = false;
    apiClient.getAuditPlan(orgId, auditPlanIdFromUrl).then((res) => {
      if (!cancelled && res.plan) {
        setCurrentUserRole(res.plan.currentUserRole ?? null);
        setPlanStatus(res.plan.status ?? null);
      }
    }).catch(() => { if (!cancelled) { setCurrentUserRole(null); setPlanStatus(null); } });
    return () => { cancelled = true; };
  }, [orgId, auditPlanIdFromUrl]);

  const [isLoading, setIsLoading] = useState(true);
  const [orgInfo, setOrgInfo] = useState<OrganizationInfo | null>(null);
  const [sites, setSites] = useState<SiteItem[]>([]);
  const [processes, setProcesses] = useState<ProcessItem[]>([]);
  const [members, setMembers] = useState<MemberItem[]>([]);

  const [startPeriod, setStartPeriod] = useState<Date | undefined>(undefined);
  const [endPeriod, setEndPeriod] = useState<Date | undefined>(undefined);
  const [processId, setProcessId] = useState<string | null>(null);
  const [programOwnerUserId, setProgramOwnerUserId] = useState<string | null>(null);
  const [programId, setProgramId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [programPurpose, setProgramPurpose] = useState<string | null>(null);
  const [auditScope, setAuditScope] = useState<string | null>(null);
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);
  const [auditType, setAuditType] = useState<string | null>(null);
  const [auditCriteria, setAuditCriteria] = useState<string | null>(null);

  const [risks, setRisks] = useState<{ id: string; rop: string; category: string; description: string; impact: string; impactClass: "gray" | "orange" | "green"; frequency: string; priority: string; priorityClass: "gray" | "red" | "green" }[]>([]);

  const [scheduleRows, setScheduleRows] = useState<{ audit: string; type: string; focus: string; frequency: string; months: string; lead: string }[]>([]);

  const [kpis, setKpis] = useState<{ id: string; kpi: string; description: string; impact: string; score: string; priority: string; comments: string }[]>([]);

  const [riskDialogOpen, setRiskDialogOpen] = useState(false);
  const [riskForm, setRiskForm] = useState<{ rop: string; category: string; description: string; impact: string; impactClass: "gray" | "orange" | "green"; frequency: string; priority: string; priorityClass: "gray" | "red" | "green" }>({ rop: "", category: "", description: "", impact: "", impactClass: "gray", frequency: "", priority: "", priorityClass: "gray" });
  const [editingRiskId, setEditingRiskId] = useState<string | null>(null);
  const addRisk = () => {
    setEditingRiskId(null);
    setRiskForm({ rop: "", category: "", description: "", impact: "", impactClass: "gray", frequency: "", priority: "", priorityClass: "gray" });
    setRiskDialogOpen(true);
  };
  const editRisk = (r: typeof risks[0]) => {
    setEditingRiskId(r.id);
    setRiskForm({ rop: r.rop, category: r.category, description: r.description, impact: r.impact, impactClass: r.impactClass, frequency: r.frequency, priority: r.priority, priorityClass: r.priorityClass });
    setRiskDialogOpen(true);
  };
  const submitRisk = () => {
    if (editingRiskId) {
      setRisks((prev) => prev.map((r) => (r.id === editingRiskId ? { ...r, ...riskForm } : r)));
      setEditingRiskId(null);
    } else {
      setRisks((prev) => [...prev, { id: `r${Date.now()}`, ...riskForm }]);
    }
    setRiskDialogOpen(false);
  };
  const removeRisk = (id: string) => setRisks((prev) => prev.filter((r) => r.id !== id));

  const [kpiDialogOpen, setKpiDialogOpen] = useState(false);
  const [kpiForm, setKpiForm] = useState({ kpi: "", description: "", impact: "", score: "", priority: "", comments: "" });
  const [editingKpiId, setEditingKpiId] = useState<string | null>(null);
  const addKpi = () => {
    setEditingKpiId(null);
    setKpiForm({ kpi: "", description: "", impact: "", score: "", priority: "", comments: "" });
    setKpiDialogOpen(true);
  };
  const editKpi = (k: typeof kpis[0]) => {
    setEditingKpiId(k.id);
    setKpiForm({ kpi: k.kpi, description: k.description, impact: k.impact, score: k.score, priority: k.priority, comments: k.comments });
    setKpiDialogOpen(true);
  };
  const submitKpi = () => {
    if (editingKpiId) {
      setKpis((prev) => prev.map((k) => (k.id === editingKpiId ? { ...k, ...kpiForm } : k)));
      setEditingKpiId(null);
    } else {
      setKpis((prev) => [...prev, { id: `k${Date.now()}`, ...kpiForm }]);
    }
    setKpiDialogOpen(false);
  };
  const removeKpi = (id: string) => setKpis((prev) => prev.filter((k) => k.id !== id));

  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleEditIndex, setScheduleEditIndex] = useState<number | null>(null);
  const [scheduleEditForm, setScheduleEditForm] = useState<{ audit: string; type: string; focus: string; frequency: string; months: string; lead: string }>({ audit: "", type: "", focus: "", frequency: "", months: "", lead: "" });
  const addScheduleRow = () => {
    setScheduleEditIndex(null);
    setScheduleEditForm({ audit: "", type: "", focus: "", frequency: "", months: "", lead: "" });
    setScheduleDialogOpen(true);
  };
  const editScheduleRow = (index: number) => {
    setScheduleEditIndex(index);
    setScheduleEditForm({ ...scheduleRows[index] });
    setScheduleDialogOpen(true);
  };
  const submitScheduleEdit = () => {
    if (scheduleEditIndex !== null) {
      setScheduleRows((prev) => prev.map((row, i) => (i === scheduleEditIndex ? scheduleEditForm : row)));
    } else {
      setScheduleRows((prev) => [...prev, scheduleEditForm]);
    }
    setScheduleEditIndex(null);
    setScheduleDialogOpen(false);
  };
  const removeScheduleRow = (index: number) => {
    setScheduleRows((prev) => prev.filter((_, i) => i !== index));
    if (scheduleEditIndex !== null && (scheduleEditIndex === index || scheduleEditIndex > index)) {
      setScheduleEditIndex(scheduleEditIndex === index ? null : scheduleEditIndex - 1);
      setScheduleDialogOpen(false);
    }
  };

  const [reviewRows, setReviewRows] = useState<{ id: string; pri: string; type: string; comments: string; priority: string; priorityClass: "gray" | "red"; action: string }[]>([]);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [reviewForm, setReviewForm] = useState<{ pri: string; type: string; comments: string; priority: string; priorityClass: "gray" | "red"; action: string }>({ pri: "", type: "", comments: "", priority: "", priorityClass: "gray", action: "" });
  const addReview = () => {
    setEditingReviewId(null);
    setReviewForm({ pri: "", type: "", comments: "", priority: "", priorityClass: "gray", action: "" });
    setReviewDialogOpen(true);
  };
  const editReview = (r: typeof reviewRows[0]) => {
    setEditingReviewId(r.id);
    setReviewForm({ pri: r.pri, type: r.type, comments: r.comments, priority: r.priority, priorityClass: r.priorityClass, action: r.action });
    setReviewDialogOpen(true);
  };
  const submitReview = () => {
    if (editingReviewId) {
      setReviewRows((prev) => prev.map((row) => (row.id === editingReviewId ? { ...row, ...reviewForm } : row)));
      setEditingReviewId(null);
    } else {
      setReviewRows((prev) => [...prev, { id: `p${Date.now()}`, ...reviewForm }]);
    }
    setReviewDialogOpen(false);
  };
  const removeReview = (id: string) => setReviewRows((prev) => prev.filter((r) => r.id !== id));

  const selectSite = (siteId: string) => {
    setSelectedSiteIds((prev) => {
      const next = prev.includes(siteId) ? [] : [siteId];
      if (next.length !== prev.length || (next.length === 1 && next[0] !== prev[0])) {
        setProcessId(null);
        setProgramOwnerUserId(null);
      }
      return next;
    });
  };

  // Current user must have Auditor role to create an audit
  const currentUserHasAuditorRole = useMemo(
    () => (members.find((m) => m.id === currentUserId)?.additionalRoles ?? []).includes("Auditor"),
    [members, currentUserId]
  );

  // Process(es) the current user is assigned to (user cannot audit their own process)
  const currentUserProcessIds = useMemo(() => {
    const processId = members.find((m) => m.id === currentUserId)?.processId;
    return processId ? [processId] : [];
  }, [members, currentUserId]);

  // Processes for selected site(s) only; exclude processes where the current user is assigned (no self-audit)
  const processesForSelectedSites = useMemo(
    () =>
      selectedSiteIds.length === 0
        ? []
        : processes
            .filter((p) => p.siteId && selectedSiteIds.includes(p.siteId))
            .filter((p) => !currentUserProcessIds.includes(p.id)),
    [processes, selectedSiteIds, currentUserProcessIds]
  );

  // Responsible owner = members assigned to the selected process (and thus site)
  const responsibleOwnerCandidates = useMemo(
    () => (processId ? members.filter((m) => m.processId === processId) : []),
    [members, processId]
  );

  useEffect(() => {
    if (!orgId) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    Promise.all([
      apiClient.getOrganizationInfo(orgId),
      apiClient.getSites(orgId),
      apiClient.getProcesses(orgId),
      apiClient.getMembers(orgId),
    ])
      .then(([orgRes, sitesRes, processesRes, membersRes]) => {
        if (cancelled) return;
        const info = orgRes.organizationInfo;
        setOrgInfo(info ? { name: info.name, registrationId: info.registrationId, industry: info.industry, subIndustry: info.subIndustry } : null);
        const siteList = sitesRes.sites ?? [];
        setSites(siteList.map((s: any) => ({ id: s.id, name: s.name ?? s.siteName ?? s.id, code: s.code })));
        setProcesses(processesRes.processes ?? []);
        const activeMembers = (membersRes.teamMembers ?? []).filter((m: any) => m.status === "Active");
        setMembers(activeMembers.map((m: any) => ({ id: m.id, name: m.name || m.email || "—", email: m.email ?? "", processId: m.processId, processName: m.processName, siteId: m.siteId, siteName: m.siteName, additionalRoles: m.additionalRoles ?? [] })));
      })
      .catch(() => {
        if (!cancelled) setOrgInfo(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [orgId, currentUserId]);

  useEffect(() => {
    if (!orgId || !programIdFromUrl) return;
    let cancelled = false;
    apiClient.getAuditProgram(orgId, programIdFromUrl).then((res) => {
      if (cancelled || !res.program) return;
      const p = res.program;
      setProgramId(p.id);
      if (p.startPeriod) setStartPeriod(new Date(p.startPeriod));
      if (p.endPeriod) setEndPeriod(new Date(p.endPeriod));
      if (p.processId) setProcessId(p.processId);
      if (p.programOwnerUserId) setProgramOwnerUserId(p.programOwnerUserId);
      if (p.programPurpose != null) setProgramPurpose(p.programPurpose);
      if (p.auditScope != null) setAuditScope(p.auditScope);
      if (p.auditType != null) setAuditType(p.auditType);
      if (p.auditCriteria != null) setAuditCriteria(p.auditCriteria);
      if (p.siteIds?.length) setSelectedSiteIds(p.siteIds);
      if (p.risks?.length) setRisks(p.risks.map((r: any, i: number) => ({
        id: `risk-${i}-${Date.now()}`,
        rop: r.rop ?? "",
        category: r.category ?? "",
        description: r.description ?? "",
        impact: r.impact ?? "",
        impactClass: (r.impactClass ?? "gray") as "gray" | "orange" | "green",
        frequency: r.frequency ?? "",
        priority: r.priority ?? "",
        priorityClass: (r.priorityClass ?? "gray") as "gray" | "red" | "green",
      })));
      if (p.scheduleRows?.length) setScheduleRows(p.scheduleRows.map((r: any) => ({
        audit: r.audit ?? "",
        type: r.type ?? "",
        focus: r.focus ?? "",
        frequency: r.frequency ?? "",
        months: r.months ?? "",
        lead: r.lead ?? "",
      })));
      if (p.kpis?.length) setKpis(p.kpis.map((k: any, i: number) => ({
        id: `kpi-${i}-${Date.now()}`,
        kpi: k.kpi ?? "",
        description: k.description ?? "",
        impact: k.impact ?? "",
        score: k.score ?? "",
        priority: k.priority ?? "",
        comments: k.comments ?? "",
      })));
      if (p.reviewRows?.length) setReviewRows(p.reviewRows.map((r: any, i: number) => ({
        id: `rev-${i}-${Date.now()}`,
        pri: r.pri ?? "",
        type: r.type ?? "",
        comments: r.comments ?? "",
        priority: r.priority ?? "",
        priorityClass: (r.priorityClass === "red" ? "red" : "gray") as "gray" | "red",
        action: r.action ?? "",
      })));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [orgId, programIdFromUrl]);

  const stepQuery = useMemo(() => {
    const p = new URLSearchParams();
    if (programIdFromUrl) p.set("programId", programIdFromUrl);
    if (auditPlanIdFromUrl) p.set("auditPlanId", auditPlanIdFromUrl);
    const c = searchParams.get("criteria");
    if (c) p.set("criteria", c);
    return p.toString();
  }, [programIdFromUrl, auditPlanIdFromUrl, searchParams]);

  const canEditStep1 =
    planStatus !== "closed" &&
    (!auditPlanIdFromUrl || currentUserRole === "lead_auditor");

  const lockedSteps = useMemo(() => {
    if (!planStatus || !currentUserRole) return [];
    const locked: number[] = [];
    if (currentUserRole === "lead_auditor" && !["pending_closure", "closed"].includes(planStatus)) locked.push(6);
    if (currentUserRole === "assigned_auditor" && !["ca_submitted_to_auditor", "pending_closure", "closed"].includes(planStatus)) locked.push(5);
    return locked;
  }, [planStatus, currentUserRole]);

  // User must have Auditor role to create an audit; creator is always the Lead Auditor
  if (!isLoading && currentUserId && !currentUserHasAuditorRole) {
    return (
      <div className="space-y-6">
        <AuditWorkflowHeader currentStep={1} orgId={orgId} allowedSteps={[1, 2, 3, 4, 5, 6]} exitHref="../.." />
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-8 text-center">
          <p className="text-lg font-medium text-amber-800">
            You must have the <strong>Auditor</strong> additional role to create an audit.
          </p>
          <p className="mt-2 text-sm text-amber-700">
            Ask your organization admin to assign you the Auditor role in Teams &amp; Roles (additional roles), then try again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AuditWorkflowHeader currentStep={1} orgId={orgId} allowedSteps={[1, 2, 3, 4, 5, 6]} lockedSteps={lockedSteps} stepQuery={stepQuery || undefined} exitHref="../.." />
      {!canEditStep1 && currentUserRole != null && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {planStatus === "closed"
            ? "View only — this audit is complete; no edits allowed."
            : "View only — only the Lead Auditor can edit this step."}
        </div>
      )}
      <div className="rounded-lg border border-gray-200 bg-white  shadow-sm">
        <div className={cn(!canEditStep1 && "pointer-events-none select-none opacity-90")}>
        {/* Organization Context Section */}
        <div className="p-8">
          {/* Header */}
          <p className="mb-4 text-xs font-medium uppercase tracking-wide text-green-600">
            TO BE COMPLETED BY THE AUDIT PROGRAM LEADER/LEAD AUDITOR
          </p>
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-1 rounded-full bg-green-500" />
              <h2 className="text-xl font-bold text-gray-900">ORGANIZATION CONTEXT</h2>
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-green-700">
                STRATEGIC LEVEL
              </span>
            </div>
            <Link
              href="#"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
            >
              Learn More
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>
          {/* Organization Details */}
          {isLoading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label className="block text-xs font-medium uppercase tracking-wide text-gray-500">
                  ORGANIZATION NAME
                </Label>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-700">
                  {orgInfo?.name || "—"}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="block text-xs font-medium uppercase tracking-wide text-gray-500">
                  ORGANIZATION UIN
                </Label>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-700">
                  {formatUIN(orgInfo?.registrationId)}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="block text-xs font-medium uppercase tracking-wide text-gray-500">
                  NAICS INDUSTRY CODE
                </Label>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-700">
                  {orgInfo?.industry || "—"}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="block text-xs font-medium uppercase tracking-wide text-gray-500">
                  SUB-INDUSTRY
                </Label>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-700">
                  {orgInfo?.subIndustry || orgInfo?.industry || "—"}
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Period Covered Section */}
        <div className="p-8">
          <h2 className="mb-6 text-xl font-bold text-gray-900">PERIOD COVERED</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-gray-500">
                START PERIOD (MM-DD-YYYY)
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startPeriod && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startPeriod ? format(startPeriod, "MM-dd-yyyy") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startPeriod}
                    onSelect={setStartPeriod}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-gray-500">
                END PERIOD (MM-DD-YYYY)
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endPeriod && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endPeriod ? format(endPeriod, "MM-dd-yyyy") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endPeriod}
                    onSelect={setEndPeriod}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-gray-500">
                SYSTEM CREATION DATE
              </Label>
              <div className="flex items-center rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                Set automatically when the program is saved (not editable)
              </div>
            </div>
          </div>
          <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-sm italic text-gray-700">
              This document was automatically generated by a computer system for VApps Enterprise compliance tracking. Manual alterations outside the system environment invalidate the digital signature and traceability chain.
            </p>
          </div>
        </div>

        {/* Context, Scope, Type & Criteria */}
        <div className="p-8">
          <h2 className="mb-6 text-xl font-bold text-gray-900">
            CONTEXT, SCOPE, TYPE & CRITERIA
          </h2>
          {/* SCOPE OF AUDIT PROGRAM + ORGANIZATIONAL SITES - Half / Half */}
          <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Left half: Scope of Audit Program */}
            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
                SCOPE OF AUDIT PROGRAM (SELECT ONE)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { id: "management", label: "Management Systems" },
                  { id: "esg", label: "ESG Sustainability" },
                ].map((opt) => (
                  <Label
                    key={opt.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors",
                      auditScope === opt.id
                        ? "border-green-500 bg-green-50/50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    )}
                  >
                    <Checkbox
                      checked={auditScope === opt.id}
                      onCheckedChange={(checked) =>
                        setAuditScope(checked ? opt.id : null)
                      }
                      className="shrink-0 border-green-500 data-[state=checked]:border-green-600 data-[state=checked]:bg-green-600"
                    />
                    <span className="font-medium text-gray-900">{opt.label}</span>
                  </Label>
                ))}
              </div>
            </div>
            {/* Right half: Organizational Sites / Units (current org only) */}
            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
                ORGANIZATIONAL SITES / UNITS (SELECT ONE)
              </h3>
              {sites.length === 0 ? (
                <p className="text-sm text-gray-500">No sites for this organization. Add sites in Settings.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {sites.map((site) => (
                    <Button
                      key={site.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => selectSite(site.id)}
                      className={cn(
                        "min-w-[100px] rounded-md border py-4 transition-colors",
                        selectedSiteIds.includes(site.id)
                          ? "border-green-600 bg-green-600 text-white hover:bg-green-700 hover:text-white"
                          : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                      )}
                    >
                      {site.code || site.name}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* Types of Audits */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
              TYPES OF AUDITS (SELECT ONE)
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                {
                  id: "fpa",
                  label: "First-Party (FPA)",
                  sub: "Audits conducted by, or on behalf of, the organization itself for management review and other internal purposes.",
                },
                {
                  id: "spa",
                  label: "Second-Party (SPA)",
                  sub: "Audits conducted by parties having an interest in the organization, such as customers, or by other persons on their behalf.",
                },
                {
                  id: "tpa",
                  label: "Third-Party (TPA)",
                  sub: "Audits conducted by independent auditing organizations, such as those providing certification of conformity or regulatory bodies.",
                },
              ].map((opt) => (
                <Label
                  key={opt.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors",
                    auditType === opt.id
                      ? "border-green-500 bg-green-50/50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  )}
                >
                  <Checkbox
                    checked={auditType === opt.id}
                    onCheckedChange={(checked) =>
                      setAuditType(checked ? opt.id : null)
                    }
                    className="mt-0.5 shrink-0 border-green-500 data-[state=checked]:border-green-600 data-[state=checked]:bg-green-600"
                  />
                  <div>
                    <div className="font-medium text-gray-900">{opt.label}</div>
                    <div className="mt-1 text-sm text-gray-500">{opt.sub}</div>
                  </div>
                </Label>
              ))}
            </div>
          </div>
        </div>

        {/* Audit Program Owner & Delegation: Select site first, then process (for that site), then responsible owner (from process), then lead auditor (user with Auditor role). */}
        <div className="rounded-lg border border-gray-200 bg-green-50/50 p-8 shadow-sm mx-8 my-8">
          <div className="mb-6 flex items-center gap-2">
            <h2 className="text-xl font-bold text-green-700">Audit Program Owner & Delegation</h2>
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white">
              <Info className="h-3 w-3" />
            </div>
          </div>
          <p className="mb-4 text-sm text-gray-600">
            Select a site above first. Process list shows only processes for the selected site(s) that you are <strong>not</strong> assigned to (you cannot audit your own process). Responsible owner is determined by the selected process. You are the Lead Auditor for audits you create.
          </p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-gray-500">
                PROCESS / DEPARTMENT
              </Label>
              <Select
                value={processId ?? ""}
                onValueChange={(v) => { setProcessId(v || null); setProgramOwnerUserId(null); }}
                disabled={selectedSiteIds.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={selectedSiteIds.length === 0 ? "Select a site first" : "Select process"} />
                </SelectTrigger>
                <SelectContent>
                  {processesForSelectedSites.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}{p.siteName ? ` (${p.siteName})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">Only processes you are not assigned to are shown (no self-audit).</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-gray-500">
                RESPONSIBLE OWNER (AUDITEE)
              </Label>
              <Select value={programOwnerUserId ?? ""} onValueChange={(v) => setProgramOwnerUserId(v || null)} disabled={!processId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select responsible person" />
                </SelectTrigger>
                <SelectContent>
                  {responsibleOwnerCandidates.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}{m.processName ? ` — ${m.processName}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">Determined by selected site and process (person responsible for that process).</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-green-700 font-medium">
            Lead Auditor: You (the audit creator is automatically assigned as Lead Auditor).
          </p>
          <p className="mt-4 text-sm italic text-gray-600">
            Note: Audit program management may be delegated as per Section 5.3 of ISO 19011:2026.
          </p>
        </div>
        {/* Objectives Info Box */}
        <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 mx-8 my-8">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white">
            <Info className="h-4 w-4" />
          </div>
          <p className="text-sm text-gray-700">
            <span className="font-medium">Define Audit Objectives</span> Aligned With ISO And ESG Requirements.{" "}
            <em>Verify Management System Conformity</em> And Evaluate Effectiveness, Performance, And ESG Practices.{" "}
            <span className="font-medium">Support Risk-Based Decision-Making</span> And Continual Improvement.
          </p>
        </div>
        {/* Program Purpose & Objectives */}
        <div className="p-8">
          <h2 className="mb-6 text-xl font-bold text-gray-900">
            PROGRAM PURPOSE & OBJECTIVES (SELECT ONE)
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              {
                id: "conformity",
                title: "Management system conformity with standards",
                sub: "ISO 9001, 14001, 45001",
              },
              {
                id: "effectiveness",
                title: "Evaluation of system effectiveness",
                sub: "Process performance and outcomes",
              },
              {
                id: "esg",
                title: "Assessment of ESG practices & disclosures",
                sub: "GRI, IFRS S1/S2 Alignment",
              },
              {
                id: "risk",
                title: "Risk-based decision making support",
                sub: "Identifying vulnerabilities in system",
              },
            ].map((opt) => (
              <Label
                key={opt.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors",
                  programPurpose === opt.id
                    ? "border-green-500 bg-green-50/50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                )}
              >
                <Checkbox
                  checked={programPurpose === opt.id}
                  onCheckedChange={(checked) =>
                    setProgramPurpose(checked ? opt.id : null)
                  }
                  className="mt-0.5 border-green-500 data-[state=checked]:border-green-600 data-[state=checked]:bg-green-600"
                />
                <div>
                  <div className="font-medium text-gray-900">{opt.title}</div>
                  <div className="text-sm text-gray-500">{opt.sub}</div>
                </div>
              </Label>
            ))}
          </div>
        </div>

        {/* Audit Program Criteria */}
        <div className="p-8">
          <h2 className="mb-6 text-xl font-bold text-gray-900">
            AUDIT PROGRAM CRITERIA (SELECT ONE)
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { id: "iso", label: "ISO standards" },
              { id: "esg", label: "ESG frameworks" },
              { id: "legal", label: "Legal & regulatory" },
            ].map((opt) => (
              <Label
                key={opt.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors",
                  auditCriteria === opt.id
                    ? "border-green-500 bg-green-50/50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                )}
              >
                <Checkbox
                  checked={auditCriteria === opt.id}
                  onCheckedChange={(checked) =>
                    setAuditCriteria(checked ? opt.id : null)
                  }
                  className="border-green-500 data-[state=checked]:border-green-600 data-[state=checked]:bg-green-600"
                />
                <span className="font-medium text-gray-900">{opt.label}</span>
              </Label>
            ))}
          </div>
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white">
              <Info className="h-4 w-4" />
            </div>
            <p className="text-sm text-gray-700">
              Specifies That Audit Programs Should Define Criteria And Scope In Program Establishment.
            </p>
          </div>
        </div>
        {/* Audit Program Risks & Opportunities */}
        <div className="p-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              AUDIT PROGRAM RISKS & OPPORTUNITIES
            </h2>
            <Button onClick={addRisk} size="sm" className="bg-green-600 hover:bg-green-700">
              + ADD RISK
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">ROP#</TableHead>
                  <TableHead className="font-semibold">Category</TableHead>
                  <TableHead className="font-semibold">Description</TableHead>
                  <TableHead className="font-semibold">Impact (1-5)</TableHead>
                  <TableHead className="font-semibold">Frequency</TableHead>
                  <TableHead className="font-semibold">Priority</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {risks.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.rop}</TableCell>
                    <TableCell>{r.category}</TableCell>
                    <TableCell>{r.description}</TableCell>
                    <TableCell>
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        r.impactClass === "orange" && "bg-orange-100 text-orange-700",
                        r.impactClass === "green" && "bg-green-100 text-green-700",
                        r.impactClass === "gray" && "bg-gray-100 text-gray-700"
                      )}>
                        {r.impact}
                      </span>
                    </TableCell>
                    <TableCell>{r.frequency}</TableCell>
                    <TableCell>
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        r.priorityClass === "red" && "bg-red-100 text-red-700",
                        r.priorityClass === "green" && "bg-green-100 text-green-700",
                        r.priorityClass === "gray" && "bg-gray-100 text-gray-700"
                      )}>
                        {r.priority}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-600 hover:bg-gray-100 hover:text-gray-900" onClick={() => editRisk(r)} aria-label="Edit risk">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => removeRisk(r.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white">
              <Info className="h-4 w-4" />
            </div>
            <p className="text-sm text-gray-700">
              Risk Assessment Results Influence Audit Frequency, Depth, And Scheduling/Program.
            </p>
          </div>
        </div>
        {/* Audit Program Structure & Schedule */}
        <div className="p-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              AUDIT PROGRAM STRUCTURE & SCHEDULE
            </h2>
            <Button onClick={addScheduleRow} size="sm" className="bg-green-600 hover:bg-green-700">
              + ADD ROW
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">Audit#</TableHead>
                  <TableHead className="font-semibold">Audit Type</TableHead>
                  <TableHead className="font-semibold">System / ESG Focus</TableHead>
                  <TableHead className="font-semibold">Frequency</TableHead>
                  <TableHead className="font-semibold">Target Months</TableHead>
                  <TableHead className="font-semibold">Lead Auditor</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scheduleRows.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{row.audit}</TableCell>
                    <TableCell>{row.type}</TableCell>
                    <TableCell>{row.focus}</TableCell>
                    <TableCell>{row.frequency}</TableCell>
                    <TableCell>{row.months}</TableCell>
                    <TableCell>{row.lead}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-600 hover:bg-gray-100 hover:text-gray-900" onClick={() => editScheduleRow(i)} aria-label="Edit schedule row">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => removeScheduleRow(i)} aria-label="Remove schedule row">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        {/* Monitoring & Measurement (KPIs) */}
        <div className="p-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              MONITORING & MEASUREMENT (KPIS)
            </h2>
            <Button onClick={addKpi} size="sm" className="bg-green-600 hover:bg-green-700">
              + ADD KPI
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">KPI#</TableHead>
                  <TableHead className="font-semibold">Description</TableHead>
                  <TableHead className="font-semibold">Impact</TableHead>
                  <TableHead className="font-semibold">Score</TableHead>
                  <TableHead className="font-semibold">Priority</TableHead>
                  <TableHead className="font-semibold">Comments</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kpis.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.kpi}</TableCell>
                    <TableCell>{k.description}</TableCell>
                    <TableCell>{k.impact}</TableCell>
                    <TableCell>{k.score}</TableCell>
                    <TableCell>{k.priority}</TableCell>
                    <TableCell>{k.comments || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-600 hover:bg-gray-100 hover:text-gray-900" onClick={() => editKpi(k)} aria-label="Edit KPI">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => removeKpi(k.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        {/* KPI Summary Cards - empty until populated from database */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mx-8 my-8">
          {["AUDIT COMPLETION RATE", "FINDING RESOLUTION TIME", "STAKEHOLDER SATISFACTION"].map((label) => (
            <div key={label} className="rounded-lg border border-gray-200 bg-gray-50 p-6">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
              <div className="mt-2 text-gray-500">—</div>
            </div>
          ))}
        </div>
        {/* Program Review & Improvement */}
        <div className="p-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">PROGRAM REVIEW & IMPROVEMENT</h2>
            <Button onClick={addReview} size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700">
              <Plus className="h-4 w-4" />
              ADD REVIEW
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">PRI#</TableHead>
                  <TableHead className="font-semibold">REVIEW TYPE</TableHead>
                  <TableHead className="font-semibold">PROGRAM LEADER COMMENTS</TableHead>
                  <TableHead className="font-semibold">PRIORITY</TableHead>
                  <TableHead className="font-semibold">ACTION FOR IMPROVEMENT</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviewRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.pri}</TableCell>
                    <TableCell>{r.type}</TableCell>
                    <TableCell>{r.comments}</TableCell>
                    <TableCell>
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        r.priorityClass === "red" && "bg-red-100 text-red-700",
                        r.priorityClass === "gray" && "bg-gray-100 text-gray-700"
                      )}>
                        {r.priority}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button type="button" variant="ghost" className="text-left font-medium text-green-600 hover:underline h-auto p-0">
                        {r.action || "—"}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-600 hover:bg-gray-100 hover:text-gray-900" onClick={() => editReview(r)} aria-label="Edit review">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => removeReview(r.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        {/* Audit Details (populated from database after save) */}
        <div className="rounded-lg bg-slate-800 p-6 text-white shadow-sm mx-8 my-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">AUDIT PLAN DATE</div>
                <div className="mt-1 text-xl font-bold text-green-400">{startPeriod ? format(startPeriod, "MM-dd-yyyy") : "—"}</div>
                <div className="text-xs text-slate-400">SYSTEM GENERATED</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">AUDIT ACTUAL DATE</div>
                <div className="mt-1 text-xl font-bold text-green-400">—</div>
                <div className="text-xs text-slate-400">SYSTEM GENERATED (LOG)</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">LEAD AUDITOR</div>
                <div className="mt-1 text-xl font-bold">{currentUserId ? (members.find((m) => m.id === currentUserId)?.name ?? "—") : "—"}</div>
                <div className="text-xs text-slate-400">You (audit creator)</div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500">
                <Check className="h-5 w-5 text-white" />
              </div>
              <div className="text-xs text-slate-400">{programId ? `ID: ${programId}` : "—"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Save & Continue / Save */}
      <div className="flex justify-end gap-3">
        <Button
          size="lg"
          variant="outline"
          className="gap-2 border-gray-300 text-gray-700 hover:bg-gray-50"
          disabled={isSaving || !currentUserId || !startPeriod || !endPeriod || !processId || !programOwnerUserId || selectedSiteIds.length === 0}
          onClick={async () => {
            if (!currentUserId || !startPeriod || !endPeriod || !processId || !programOwnerUserId || selectedSiteIds.length === 0) return;
            setIsSaving(true);
            try {
              const payload = {
                startPeriod: startPeriod?.toISOString?.()?.slice(0, 10),
                endPeriod: endPeriod?.toISOString?.()?.slice(0, 10),
                programPurpose,
                auditScope,
                auditType,
                auditCriteria,
                processId,
                programOwnerUserId,
                leadAuditorUserId: currentUserId,
                siteIds: selectedSiteIds,
                risks: risks.map((r) => ({ rop: r.rop, category: r.category, description: r.description, impact: r.impact, impactClass: r.impactClass, frequency: r.frequency, priority: r.priority, priorityClass: r.priorityClass })),
                scheduleRows: scheduleRows.map((row) => ({ audit: row.audit, type: row.type, focus: row.focus, frequency: row.frequency, months: row.months, lead: row.lead })),
                kpis: kpis.map((k) => ({ kpi: k.kpi, description: k.description, impact: k.impact, score: k.score, priority: k.priority, comments: k.comments })),
                reviewRows: reviewRows.map((r) => ({ pri: r.pri, type: r.type, comments: r.comments, priority: r.priority, priorityClass: r.priorityClass, action: r.action })),
              };
              if (programId) {
                await apiClient.updateAuditProgram(orgId, programId, payload);
                router.push(`/dashboard/${orgId}/audit`);
              } else {
                const res = await apiClient.createAuditProgram(orgId, payload);
                router.push(`/dashboard/${orgId}/audit`);
              }
            } catch (e: any) {
              console.error(e);
              toast.error(e?.message ?? "Failed to save audit program");
            } finally {
              setIsSaving(false);
            }
          }}
        >
          {isSaving ? "Saving…" : "Save"}
        </Button>
        <Button
          size="lg"
          className="gap-2 bg-green-600 hover:bg-green-700"
          disabled={isSaving || !currentUserId || !startPeriod || !endPeriod || !processId || !programOwnerUserId || selectedSiteIds.length === 0}
          onClick={async () => {
            if (!currentUserId || !startPeriod || !endPeriod || !processId || !programOwnerUserId || selectedSiteIds.length === 0) return;
            setIsSaving(true);
            try {
              const payload = {
                startPeriod: startPeriod?.toISOString?.()?.slice(0, 10),
                endPeriod: endPeriod?.toISOString?.()?.slice(0, 10),
                programPurpose,
                auditScope,
                auditType,
                auditCriteria,
                processId,
                programOwnerUserId,
                leadAuditorUserId: currentUserId,
                siteIds: selectedSiteIds,
                risks: risks.map((r) => ({ rop: r.rop, category: r.category, description: r.description, impact: r.impact, impactClass: r.impactClass, frequency: r.frequency, priority: r.priority, priorityClass: r.priorityClass })),
                scheduleRows: scheduleRows.map((row) => ({ audit: row.audit, type: row.type, focus: row.focus, frequency: row.frequency, months: row.months, lead: row.lead })),
                kpis: kpis.map((k) => ({ kpi: k.kpi, description: k.description, impact: k.impact, score: k.score, priority: k.priority, comments: k.comments })),
                reviewRows: reviewRows.map((r) => ({ pri: r.pri, type: r.type, comments: r.comments, priority: r.priority, priorityClass: r.priorityClass, action: r.action })),
              };
              if (programId) {
                await apiClient.updateAuditProgram(orgId, programId, payload);
                router.push(`/dashboard/${orgId}/audit/create/2?programId=${programId}`);
              } else {
                const res = await apiClient.createAuditProgram(orgId, payload);
                const id = res.programId;
                router.push(`/dashboard/${orgId}/audit/create/2?programId=${id}`);
              }
            } catch (e: any) {
              console.error(e);
              toast.error(e?.message ?? "Failed to save audit program");
            } finally {
              setIsSaving(false);
            }
          }}
        >
          {isSaving ? "Saving…" : "Continue"}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Add Risk Dialog */}
      <Dialog open={riskDialogOpen} onOpenChange={(open) => { setRiskDialogOpen(open); if (!open) setEditingRiskId(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRiskId ? "Edit Risk" : "Add Risk"}</DialogTitle>
            <DialogDescription>{editingRiskId ? "Update the risk or opportunity." : "Add a new risk or opportunity to the audit program."}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="risk-rop">ROP#</Label>
                <Input id="risk-rop" value={riskForm.rop} onChange={(e) => setRiskForm((f) => ({ ...f, rop: e.target.value }))} placeholder="e.g. R-001" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="risk-category">Category</Label>
                <Input id="risk-category" value={riskForm.category} onChange={(e) => setRiskForm((f) => ({ ...f, category: e.target.value }))} placeholder="e.g. Resource Availability" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="risk-description">Description</Label>
              <Textarea id="risk-description" value={riskForm.description} onChange={(e) => setRiskForm((f) => ({ ...f, description: e.target.value }))} placeholder="Enter description" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Impact (1-5)</Label>
                <Select value={riskForm.impact} onValueChange={(v) => setRiskForm((f) => ({ ...f, impact: v, impactClass: v.includes("05") ? "green" : v.includes("04") ? "orange" : "gray" }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select impact" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="01 (Low)">01 (Low)</SelectItem>
                    <SelectItem value="02 (Low)">02 (Low)</SelectItem>
                    <SelectItem value="03 (Medium)">03 (Medium)</SelectItem>
                    <SelectItem value="04 (High)">04 (High)</SelectItem>
                    <SelectItem value="05 (V.High)">05 (V.High)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="risk-frequency">Frequency</Label>
                <Input id="risk-frequency" value={riskForm.frequency} onChange={(e) => setRiskForm((f) => ({ ...f, frequency: e.target.value }))} placeholder="e.g. Annual, Ongoing" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={riskForm.priority} onValueChange={(v) => setRiskForm((f) => ({ ...f, priority: v, priorityClass: v === "Critical" ? "red" : v === "Strategic" ? "green" : "gray" }))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Critical">Critical</SelectItem>
                  <SelectItem value="Strategic">Strategic</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRiskDialogOpen(false)}>Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={submitRisk}>{editingRiskId ? "Save changes" : "Add Risk"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add KPI Dialog */}
      <Dialog open={kpiDialogOpen} onOpenChange={(open) => { setKpiDialogOpen(open); if (!open) setEditingKpiId(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingKpiId ? "Edit KPI" : "Add KPI"}</DialogTitle>
            <DialogDescription>{editingKpiId ? "Update the KPI." : "Add a new KPI for monitoring and measurement."}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="kpi-num">KPI#</Label>
                <Input id="kpi-num" value={kpiForm.kpi} onChange={(e) => setKpiForm((f) => ({ ...f, kpi: e.target.value }))} placeholder="e.g. 001" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kpi-impact">Impact</Label>
                <Select value={kpiForm.impact} onValueChange={(v) => setKpiForm((f) => ({ ...f, impact: v }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select impact" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="kpi-description">Description</Label>
              <Textarea id="kpi-description" value={kpiForm.description} onChange={(e) => setKpiForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. % audit completed vs planned" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="kpi-score">Score</Label>
                <Input id="kpi-score" value={kpiForm.score} onChange={(e) => setKpiForm((f) => ({ ...f, score: e.target.value }))} placeholder="e.g. 1-5" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kpi-priority">Priority</Label>
                <Input id="kpi-priority" value={kpiForm.priority} onChange={(e) => setKpiForm((f) => ({ ...f, priority: e.target.value }))} placeholder="e.g. 1, 2, 3" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="kpi-comments">Comments</Label>
              <Textarea id="kpi-comments" value={kpiForm.comments} onChange={(e) => setKpiForm((f) => ({ ...f, comments: e.target.value }))} placeholder="Optional comments" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKpiDialogOpen(false)}>Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={submitKpi}>{editingKpiId ? "Save changes" : "Add KPI"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Schedule Row Dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={(open) => { setScheduleDialogOpen(open); if (!open) setScheduleEditIndex(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{scheduleEditIndex !== null ? "Edit Schedule Row" : "Add Schedule Row"}</DialogTitle>
            <DialogDescription>{scheduleEditIndex !== null ? "Update the audit program structure and schedule row." : "Add a new row to the audit program structure and schedule."}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="schedule-audit">Audit#</Label>
                <Input id="schedule-audit" value={scheduleEditForm.audit} onChange={(e) => setScheduleEditForm((f) => ({ ...f, audit: e.target.value }))} placeholder="e.g. 1" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule-type">Audit Type</Label>
                <Input id="schedule-type" value={scheduleEditForm.type} onChange={(e) => setScheduleEditForm((f) => ({ ...f, type: e.target.value }))} placeholder="e.g. Internal" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-focus">System / ESG Focus</Label>
              <Input id="schedule-focus" value={scheduleEditForm.focus} onChange={(e) => setScheduleEditForm((f) => ({ ...f, focus: e.target.value }))} placeholder="e.g. QMS, EMS" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="schedule-frequency">Frequency</Label>
                <Input id="schedule-frequency" value={scheduleEditForm.frequency} onChange={(e) => setScheduleEditForm((f) => ({ ...f, frequency: e.target.value }))} placeholder="e.g. Annual" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule-months">Target Months</Label>
                <Input id="schedule-months" value={scheduleEditForm.months} onChange={(e) => setScheduleEditForm((f) => ({ ...f, months: e.target.value }))} placeholder="e.g. Q1, Q2" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-lead">Lead Auditor</Label>
              <Input id="schedule-lead" value={scheduleEditForm.lead} onChange={(e) => setScheduleEditForm((f) => ({ ...f, lead: e.target.value }))} placeholder="Lead auditor name" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={submitScheduleEdit}>{scheduleEditIndex !== null ? "Save changes" : "Add Row"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={(open) => { setReviewDialogOpen(open); if (!open) setEditingReviewId(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingReviewId ? "Edit Review" : "Add Review"}</DialogTitle>
            <DialogDescription>{editingReviewId ? "Update the program review or improvement item." : "Add a program review or improvement item."}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="review-pri">PRI#</Label>
                <Input id="review-pri" value={reviewForm.pri} onChange={(e) => setReviewForm((f) => ({ ...f, pri: e.target.value }))} placeholder="e.g. PRI-01" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="review-type">Review Type</Label>
                <Select value={reviewForm.type} onValueChange={(v) => setReviewForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Scheduled Review">Scheduled Review</SelectItem>
                    <SelectItem value="Feedback">Feedback</SelectItem>
                    <SelectItem value="Business Risk Changes">Business Risk Changes</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="review-comments">Program Leader Comments</Label>
              <Textarea id="review-comments" value={reviewForm.comments} onChange={(e) => setReviewForm((f) => ({ ...f, comments: e.target.value }))} placeholder="Enter comments" rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={reviewForm.priority} onValueChange={(v) => setReviewForm((f) => ({ ...f, priority: v, priorityClass: v === "High" ? "red" : "gray" }))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="review-action">Action for Improvement</Label>
              <Input id="review-action" value={reviewForm.action} onChange={(e) => setReviewForm((f) => ({ ...f, action: e.target.value }))} placeholder="e.g. Update site list for S2 expansion" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={submitReview}>{editingReviewId ? "Save changes" : "Add Review"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </div>
    </div>
  );
}
