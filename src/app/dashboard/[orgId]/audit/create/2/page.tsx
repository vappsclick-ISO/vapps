"use client";

import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { useState, useEffect, useLayoutEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import AuditWorkflowHeader from "@/components/audit/AuditWorkflowHeader";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
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
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Info,
  ExternalLink,
  Search,
  AlertTriangle,
  Calendar as CalendarIcon,
  Clock,
  ShieldCheck,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  User,
  FileText,
  Building2,
  Video,
  RefreshCw,
  MapPin,
  Check,
  Lock,
  Plus,
  Trash2,
  Users2,
  FileCheck,
} from "lucide-react";

type Priority = "HIGH" | "MEDIUM" | "LOW";

interface AmrcRow {
  id: string;
  reviewCategory: string;
  comments: string;
  priority: Priority;
  action: string;
}

// No static AMRC rows; start with one empty row, user adds more
function createEmptyAmrcRow(): AmrcRow {
  return { id: `amrc-${Date.now()}`, reviewCategory: "", comments: "", priority: "MEDIUM", action: "" };
}

const AUDIT_TYPES = [
  {
    id: "FPA",
    title: "FIRST-PARTY AUDIT (INTERNAL - FPA)",
    description:
      "Audits conducted by the organization itself for management review and other internal purposes, providing information on the performance of the system.",
    badge: null,
    badgeVariant: null,
  },
  {
    id: "SPA",
    title: "SECOND-PARTY AUDIT (SUPPLIER - SPA)",
    description:
      "Audits conducted by parties having an interest in the organization, such as customers or partners. (Auto-selected if SPA chosen in Step 1.7.3).",
    badge: "CONDITION REQUIRED",
    badgeVariant: "yellow",
  },
  {
    id: "TPA",
    title: "THIRD-PARTY AUDIT (TPA)",
    description: "Independent certification body or regulatory audit.",
    badge: null,
    badgeVariant: null,
  },
  {
    id: "SCA",
    title: "SELF-CERTIFICATION AUDIT (SCA)",
    description:
      "Audits outside formal Third-Party Certification schemes for self-declaration.",
    badge: null,
    badgeVariant: null,
  },
  {
    id: "TPR",
    title: "THIRD-PARTY RECORDS (TPR)",
    description:
      "Review of third-party certification records and audit results to ensure compliance maintenance. Record retention requirements apply.",
    badge: "SUGGESTED FOR TPA",
    badgeVariant: "blue",
  },
] as const;

/** Audit criteria options are now loaded from org checklists (Settings > Audit Checklist). */

const CORE_AUDITOR_COMPETENCIES = [
  "Knowledge of audit principles & methods",
  "Understanding of management system standards",
  "Ability to apply risk-based thinking",
  "Proficiency in communication & interviews",
  "Sector-specific technical knowledge",
  "Ethical & professional behavior",
] as const;

const LEAD_AUDITOR_SELF_EVAL_ITEMS = [
  "Ability to manage audit team and processes",
  "Strategic thinking in audit program context",
  "Decision-making on audit findings",
  "Effective reporting to top management",
  "Planning and resource management",
  "Self-evaluation verified & finalized",
] as const;

interface AuditorResource {
  id: string;
  auditorSearch: string;
  /** When set, this resource is assigned to this org member (must have Auditor additional role). UIN = this id. */
  auditorUserId: string;
  auditorUin: string;
  /** Role for the selected auditor. System-generated, always "Auditor". */
  roleAssignment: string;
  technicalExpert: string;
  observer: string;
  trainee: string;
}

function createEmptyAuditorResource(): AuditorResource {
  return {
    id: `auditor-${Date.now()}`,
    auditorSearch: "",
    auditorUserId: "",
    auditorUin: "",
    roleAssignment: "Auditor",
    technicalExpert: "",
    observer: "",
    trainee: "",
  };
}

// Map Step 1 program purpose/criteria/type to Step 2 options
const PROGRAM_PURPOSE_TO_OBJECTIVE: Record<string, string> = {
  conformity: "Verify management system conformity (ISO clauses)",
  effectiveness: "Evaluate system effectiveness & performance",
  esg: "Assess ESG practices (E / S / G factors)",
  risk: "Support risk-based decision-making",
};
const PROGRAM_CRITERIA_TO_AUDIT_CRITERIA: Record<string, string> = {
  iso: "ISO 9001 QUALITY",
  esg: "ESG & SUSTAINABILITY (GRI / IFRS S1/S2)",
  legal: "ISO 27001 INFORMATION SECURITY",
};
const PROGRAM_AUDIT_TYPE_TO_PLAN: Record<string, string> = {
  fpa: "FPA",
  spa: "SPA",
  tpa: "TPA",
};

function getQueryFromWindow(): { auditPlanId: string | null; programId: string | null } {
  if (typeof window === "undefined") return { auditPlanId: null, programId: null };
  const p = new URLSearchParams(window.location.search);
  return { auditPlanId: p.get("auditPlanId"), programId: p.get("programId") };
}

export default function CreateAuditStep2Page() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const orgId = params?.orgId as string;
  const [urlQuery, setUrlQuery] = useState<{ auditPlanId: string | null; programId: string | null }>(() =>
    getQueryFromWindow()
  );
  const programIdFromUrl = searchParams.get("programId") ?? urlQuery.programId;
  const auditPlanIdFromUrl = searchParams.get("auditPlanId") ?? urlQuery.auditPlanId;
  const currentUserId = (session?.user as { id?: string })?.id ?? null;
  const [isSubmittingPlan, setIsSubmittingPlan] = useState(false);

  useLayoutEffect(() => {
    const q = getQueryFromWindow();
    if (q.auditPlanId || q.programId) setUrlQuery(q);
  }, []);
  useEffect(() => {
    const q = getQueryFromWindow();
    if (q.auditPlanId || q.programId) setUrlQuery(q);
  }, [searchParams]);

  const planQuery = useQuery({
    queryKey: ["auditPlan", orgId, auditPlanIdFromUrl],
    queryFn: () => apiClient.getAuditPlan(orgId, auditPlanIdFromUrl!).then((r) => r.plan),
    enabled: !!orgId && !!auditPlanIdFromUrl,
    staleTime: 0, // always refetch when opening edit so Step 2 fields are fresh
  });

  // Force refetch plan when opening edit so step2Data (amrcRows, Manual Entry) is never stale
  useEffect(() => {
    if (orgId && auditPlanIdFromUrl) {
      queryClient.invalidateQueries({ queryKey: ["auditPlan", orgId, auditPlanIdFromUrl] });
    }
  }, [orgId, auditPlanIdFromUrl, queryClient]);

  const [isLoading, setIsLoading] = useState(true);
  const [program, setProgram] = useState<{
    id: string;
    name?: string;
    processId?: string;
    processName?: string;
    programPurpose?: string;
    auditScope?: string;
    auditType?: string;
    auditCriteria?: string;
    siteIds?: string[];
    sites?: { id: string; name: string; code?: string }[];
  } | null>(null);
  type ProgramListItem = {
    id: string;
    name?: string;
    startPeriod?: string | null;
    endPeriod?: string | null;
    processName?: string | null;
    sites?: { id: string; name: string; code?: string }[];
    auditType?: string | null;
  };
  const [programsList, setProgramsList] = useState<ProgramListItem[]>([]);
  const [programSearch, setProgramSearch] = useState("");
  const [sites, setSites] = useState<{ id: string; name: string; code?: string }[]>([]);
  const [processes, setProcesses] = useState<{ id: string; name: string; siteId?: string; siteName?: string }[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string; email?: string; additionalRoles?: string[]; processId?: string }[]>([]);

  const [identificationOpen, setIdentificationOpen] = useState(true);
  const [objectivesOpen, setObjectivesOpen] = useState(true);
  const [auditTypeOpen, setAuditTypeOpen] = useState(true);
  const [scopeOpen, setScopeOpen] = useState(true);
  const [calendarOpen, setCalendarOpen] = useState(true);
  const [criteriaOpen, setCriteriaOpen] = useState(true);
  const [auditorRoleOpen, setAuditorRoleOpen] = useState(true);
  const [methodsOpen, setMethodsOpen] = useState(true);
  const [amrcRows, setAmrcRows] = useState<AmrcRow[]>(() => [createEmptyAmrcRow()]);
  const [selectedCriteria, setSelectedCriteria] = useState<string | null>(null);
  const [selectedChecklistId, setSelectedChecklistId] = useState<string | null>(null);
  const [auditChecklists, setAuditChecklists] = useState<{ id: string; name: string; questionCount: number }[]>([]);
  const [rescheduleAuditPlan, setRescheduleAuditPlan] = useState<"yes" | "no">("yes");
  const [datePrepared, setDatePrepared] = useState<Date | undefined>(() => new Date());
  const [plannedDate, setPlannedDate] = useState<Date | undefined>(undefined);
  const [tpccRegisteredProcess, setTpccRegisteredProcess] = useState("");
  const [tpccAuditReference, setTpccAuditReference] = useState("");
  const [leadAuditorComments, setLeadAuditorComments] = useState("");

  const addMethodologyRow = () => {
    setAmrcRows((prev) => [...prev, createEmptyAmrcRow()]);
  };

  const updateAmrcRow = (id: string, field: keyof AmrcRow, value: string | Priority) => {
    setAmrcRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };
  const removeMethodologyRow = (id: string) => {
    setAmrcRows((prev) => (prev.length > 1 ? prev.filter((row) => row.id !== id) : prev));
  };

  const [auditPlanTitle, setAuditPlanTitle] = useState("");
  const [auditNumber, setAuditNumber] = useState("");
  const [parentProgramName, setParentProgramName] = useState("");
  const [selectedPlanOption, setSelectedPlanOption] = useState<"A" | "B" | "C" | null>(null);

  // When Option C is selected, redirect to Step 1 (create new audit program there first)
  useEffect(() => {
    if (selectedPlanOption === "C" && orgId) {
      const step1Url = programIdFromUrl
        ? `/dashboard/${orgId}/audit/create/1?programId=${programIdFromUrl}`
        : `/dashboard/${orgId}/audit/create/1`;
      router.push(step1Url);
    }
  }, [selectedPlanOption, orgId, programIdFromUrl, router]);
  const [selectedAuditType, setSelectedAuditType] = useState<string>("FPA");
  const [methodology, setMethodology] = useState<"on-site" | "remote" | "hybrid">("on-site");
  const [physicalLocationAddress, setPhysicalLocationAddress] = useState("");
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const [objectivesOther, setObjectivesOther] = useState("");
  const [objectivesCheckboxes, setObjectivesCheckboxes] = useState<Record<string, boolean>>({});

  const toggleSite = (siteId: string) => {
    setSelectedSiteIds((prev) =>
      prev.includes(siteId) ? prev.filter((id) => id !== siteId) : [...prev, siteId]
    );
  };

  const processesForSelectedSites = useMemo(
    () =>
      selectedSiteIds.length === 0
        ? []
        : processes.filter((p) => p.siteId && selectedSiteIds.includes(p.siteId)),
    [processes, selectedSiteIds]
  );

  /** Program to use for Generate Audit Plan: from URL (when coming from step 1) or from selected program in dropdown (when opening step 2 without programId). */
  const effectiveProgramId = programIdFromUrl ?? program?.id ?? null;

  const displaySite =
    selectedSiteIds.length > 0
      ? sites
          .filter((s) => selectedSiteIds.includes(s.id))
          .map((s) => s.code || s.name)
          .join(", ") || "—"
      : "—";

  const currentUserName = useMemo(
    () => members.find((m) => m.id === currentUserId)?.name ?? (session?.user as { name?: string })?.name ?? "—",
    [members, currentUserId, session]
  );

  /** Only org members who have the Auditor additional role — eligible for assignment to perform the audit. */
  const auditorsOnly = useMemo(
    () => members.filter((m) => (m.additionalRoles ?? []).includes("Auditor")),
    [members]
  );

  const applyProgramToForm = (p: {
    id: string;
    name?: string;
    processId?: string;
    processName?: string;
    programPurpose?: string;
    auditType?: string;
    auditCriteria?: string;
    auditScope?: string;
    siteIds?: string[];
  }) => {
    setParentProgramName(p.name || `Audit Program ${p.id.slice(0, 8)}`);
    setSelectedSiteIds(p.siteIds ?? []);
    setSelectedProcessId(p.processId ?? null);
    const purposeKey = (p.programPurpose ?? "").toLowerCase();
    setObjectivesCheckboxes((prev) => {
      const next = { ...prev };
      const label = PROGRAM_PURPOSE_TO_OBJECTIVE[purposeKey];
      if (label) next[label] = true;
      return next;
    });
    const typeKey = (p.auditType ?? "").toLowerCase();
    const typeMapped = PROGRAM_AUDIT_TYPE_TO_PLAN[typeKey];
    if (typeMapped) setSelectedAuditType(typeMapped);
    const critKey = (p.auditCriteria ?? "").toLowerCase();
    const critMapped = PROGRAM_CRITERIA_TO_AUDIT_CRITERIA[critKey];
    if (critMapped) setSelectedCriteria(critMapped);
    else if (p.auditCriteria && AUDIT_CRITERIA.includes(p.auditCriteria as any)) setSelectedCriteria(p.auditCriteria);
    if (p.auditScope) setObjectivesOther((prev) => prev || p.auditScope!);
  };

  const formatProgramDisplay = (pg: ProgramListItem) => {
    const audit = pg.name || `Program ${pg.id?.slice(0, 8) ?? ""}`;
    const yearRaw = pg.startPeriod ?? pg.endPeriod;
    const year = yearRaw ? String(yearRaw).slice(0, 4) : "";
    const site = pg.sites?.length
      ? (pg.sites[0].code || pg.sites[0].name || "")
      : "";
    const process = pg.processName ?? "";
    const auditType = pg.auditType ?? "";
    const parts = [audit, year, site, process, auditType].filter(Boolean);
    if (parts.length <= 1) return audit;
    return parts.join(" / ");
  };

  const filteredProgramsForSearch = useMemo(() => {
    if (!programSearch.trim()) return programsList.slice(0, 10);
    const q = programSearch.trim().toLowerCase();
    return programsList.filter((pg) => {
      const label = formatProgramDisplay(pg);
      const name = pg.name ?? "";
      return name.toLowerCase().includes(q) || label.toLowerCase().includes(q);
    }).slice(0, 10);
  }, [programsList, programSearch]);

  const selectProgramById = async (id: string) => {
    try {
      const res = await apiClient.getAuditProgram(orgId, id);
      if (res.program) {
        setProgram(res.program);
        setSelectedPlanOption("A");
        applyProgramToForm(res.program);
        setProgramSearch("");
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (!orgId) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const [sitesRes, processesRes, membersRes, checklistsRes] = await Promise.all([
          apiClient.getSites(orgId),
          apiClient.getProcesses(orgId),
          apiClient.getMembers(orgId),
          apiClient.getAuditChecklists(orgId).catch(() => ({ checklists: [] })),
        ]);
        if (cancelled) return;
        setAuditChecklists(checklistsRes.checklists ?? []);
        const siteList = sitesRes.sites ?? [];
        setSites(siteList.map((s: any) => ({ id: s.id, name: s.name ?? s.siteName ?? s.id, code: s.code })));
        setProcesses(processesRes.processes ?? []);
        const active = (membersRes.teamMembers ?? []).filter((m: any) => m.status === "Active");
        setMembers(active.map((m: any) => ({
          id: m.id,
          name: m.name || m.email || "—",
          email: m.email ?? "",
          additionalRoles: m.additionalRoles ?? [],
          processId: m.processId ?? undefined,
        })));

        const programsRes = await apiClient.getAuditPrograms(orgId);
        const list = programsRes.programs ?? [];
        setProgramsList(list.map((pg: any) => ({
          id: pg.id,
          name: pg.name ?? null,
          startPeriod: pg.startPeriod ?? pg.start_period ?? null,
          endPeriod: pg.endPeriod ?? pg.end_period ?? null,
          processName: pg.processName ?? pg.process_name ?? null,
          sites: pg.sites ?? [],
          auditType: pg.auditType ?? pg.audit_type ?? null,
        })));

        let programLoaded = false;
        if (programIdFromUrl && !cancelled) {
          try {
            const progRes = await apiClient.getAuditProgram(orgId, programIdFromUrl);
            if (!cancelled && progRes.program) {
              const p = progRes.program;
              setProgram(p);
              setSelectedPlanOption("A");
              applyProgramToForm(p);
              programLoaded = true;
            }
          } catch (_) {
            if (cancelled) return;
          }
        }

        if (auditPlanIdFromUrl && !cancelled) {
          setSelectedPlanOption("A");
        }
        if (!auditPlanIdFromUrl && !programIdFromUrl) {
          setSelectedPlanOption(null);
        }
      } catch (e) {
        if (!cancelled) setProgram(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [orgId, programIdFromUrl, auditPlanIdFromUrl]);

  // When editing: apply plan + program data to form (single source of truth for edit mode)
  useEffect(() => {
    const plan = planQuery.data;
    if (!plan || !orgId) return;
    let cancelled = false;
    const programName = (plan as { programName?: string }).programName ?? "";

    // Apply plan fields immediately so all Step 2 fields show without waiting for program fetch
    const title = (plan as { title?: string; name?: string }).title ?? (plan as { title?: string; name?: string }).name ?? "";
    const auditNum = (plan as { auditNumber?: string; audit_number?: string }).auditNumber ?? (plan as { auditNumber?: string; audit_number?: string }).audit_number ?? "";
    const criteriaVal = (plan as { criteria?: string }).criteria ?? null;
    const planned = (plan as { plannedDate?: string; planned_date?: string }).plannedDate ?? (plan as { plannedDate?: string; planned_date?: string }).planned_date;
    const prepared = (plan as { datePrepared?: string; date_prepared?: string }).datePrepared ?? (plan as { datePrepared?: string; date_prepared?: string }).date_prepared;
    const assignedIds = (plan as { assignedAuditorIds?: string[] }).assignedAuditorIds ?? [];

    setSelectedPlanOption("A");
    setParentProgramName(programName);
    setAuditPlanTitle(title);
    setAuditNumber(auditNum);
    setSelectedCriteria(criteriaVal);
    setPlannedDate(planned ? new Date(String(planned).slice(0, 10)) : undefined);
    setDatePrepared(prepared ? new Date(String(prepared).slice(0, 10)) : undefined);

    let step2: Record<string, unknown> | null = null;
    const rawStep2 = (plan as { step2Data?: Record<string, unknown> | string }).step2Data;
    if (typeof rawStep2 === "string") {
      try {
        step2 = JSON.parse(rawStep2) as Record<string, unknown>;
      } catch {
        step2 = null;
      }
    } else if (rawStep2 && typeof rawStep2 === "object") {
      step2 = rawStep2 as Record<string, unknown>;
    }
    const membersList = members.map((m) => ({ id: m.id, name: m.name || m.email || "—" }));
    const step2AuditorResources = step2 && typeof step2 === "object"
      ? (step2.auditorResources ?? (step2 as { auditor_resources?: unknown[] }).auditor_resources)
      : undefined;
    const step2AmrcRows = step2 && typeof step2 === "object"
      ? (step2.amrcRows ?? (step2 as { amrc_rows?: unknown[] }).amrc_rows)
      : undefined;

    if (step2 && typeof step2 === "object") {
      if (typeof step2.tpccRegisteredProcess === "string") setTpccRegisteredProcess(step2.tpccRegisteredProcess);
      if (typeof step2.tpccAuditReference === "string") setTpccAuditReference(step2.tpccAuditReference);
      if (typeof step2.leadAuditorComments === "string") setLeadAuditorComments(step2.leadAuditorComments);
      const reschedule = step2.rescheduleAuditPlan ?? (step2 as { reschedule_audit_plan?: string }).reschedule_audit_plan;
      if (reschedule === "yes" || reschedule === "no") setRescheduleAuditPlan(reschedule);
      if (typeof step2.selectedAuditType === "string") setSelectedAuditType(step2.selectedAuditType);
      if (step2.methodology === "on-site" || step2.methodology === "remote" || step2.methodology === "hybrid") setMethodology(step2.methodology);
      if (typeof step2.physicalLocationAddress === "string") setPhysicalLocationAddress(step2.physicalLocationAddress);
      if (Array.isArray(step2.selectedSiteIds)) setSelectedSiteIds(step2.selectedSiteIds);
      if (step2.selectedProcessId != null) setSelectedProcessId(String(step2.selectedProcessId));
      if (typeof step2.objectivesOther === "string") setObjectivesOther(step2.objectivesOther);
      if (step2.objectivesCheckboxes && typeof step2.objectivesCheckboxes === "object") setObjectivesCheckboxes(step2.objectivesCheckboxes as Record<string, boolean>);
      if (typeof step2.parentProgramName === "string") setParentProgramName(step2.parentProgramName);
      if (Array.isArray(step2AmrcRows)) {
        setAmrcRows(
          step2AmrcRows.length > 0
            ? step2AmrcRows.map((r: any, i: number) => ({
                id: r.id ?? `amrc-${Date.now()}-${i}`,
                reviewCategory: r.reviewCategory ?? r.review_category ?? "",
                comments: r.comments ?? "",
                priority: (r.priority as Priority) ?? "MEDIUM",
                action: r.action ?? "",
              }))
            : [createEmptyAmrcRow()]
        );
      }
      if (Array.isArray(step2AuditorResources)) {
        setAuditorResources(
          step2AuditorResources.length > 0
            ? step2AuditorResources.map((r: any, i: number) => {
                const uid = r.auditorUserId ?? r.auditor_user_id;
                const name = uid ? (membersList.find((mm) => mm.id === uid)?.name ?? "") : "";
                return {
                  id: r.id ?? `auditor-${auditPlanIdFromUrl}-${i}-${Date.now()}`,
                  auditorSearch: name,
                  auditorUserId: uid ?? "",
                  auditorUin: r.auditorUin ?? r.auditor_uin ?? uid ?? "",
                  roleAssignment: r.roleAssignment ?? r.role_assignment ?? "Auditor",
                  technicalExpert: r.technicalExpert ?? r.technical_expert ?? "",
                  observer: r.observer ?? "",
                  trainee: r.trainee ?? "",
                };
              })
            : [createEmptyAuditorResource()]
        );
      }
    }

    const usedStep2AuditorResources = Array.isArray(step2AuditorResources);
    if (!usedStep2AuditorResources) {
      const ids = assignedIds;
      if (ids.length > 0) {
        setAuditorResources(
          ids.map((userId: string, i: number) => {
            const name = membersList.find((mm) => mm.id === userId)?.name ?? "";
            return {
              id: `auditor-${auditPlanIdFromUrl}-${i}-${Date.now()}`,
              auditorSearch: name,
              auditorUserId: userId,
              auditorUin: userId,
              roleAssignment: "Auditor",
              technicalExpert: "",
              observer: "",
              trainee: "",
            };
          })
        );
      } else {
        setAuditorResources([createEmptyAuditorResource()]);
      }
    }

    // Then load program to fill scope/objectives; then re-apply step2 so saved Step 2 data wins
    (async () => {
      if (plan.auditProgramId) {
        try {
          const progRes = await apiClient.getAuditProgram(orgId, plan.auditProgramId);
          if (cancelled) return;
          if (progRes.program) {
            const p = progRes.program;
            setProgram(p);
            applyProgramToForm(p);
            setParentProgramName(p.name || programName);
            if (step2 && typeof step2 === "object") {
              if (typeof step2.parentProgramName === "string") setParentProgramName(step2.parentProgramName);
              if (typeof step2.selectedAuditType === "string") setSelectedAuditType(step2.selectedAuditType);
              if (step2.methodology === "on-site" || step2.methodology === "remote" || step2.methodology === "hybrid") setMethodology(step2.methodology);
              if (Array.isArray(step2.selectedSiteIds)) setSelectedSiteIds(step2.selectedSiteIds);
              if (step2.selectedProcessId != null) setSelectedProcessId(String(step2.selectedProcessId));
              if (typeof step2.objectivesOther === "string") setObjectivesOther(step2.objectivesOther);
              if (step2.objectivesCheckboxes && typeof step2.objectivesCheckboxes === "object") setObjectivesCheckboxes(step2.objectivesCheckboxes as Record<string, boolean>);
              if (typeof step2.physicalLocationAddress === "string") setPhysicalLocationAddress(step2.physicalLocationAddress);
              const rescheduleAgain = step2.rescheduleAuditPlan ?? (step2 as { reschedule_audit_plan?: string }).reschedule_audit_plan;
              if (rescheduleAgain === "yes" || rescheduleAgain === "no") setRescheduleAuditPlan(rescheduleAgain);
              if (Array.isArray(step2AmrcRows)) {
                setAmrcRows(
                  step2AmrcRows.length > 0
                    ? step2AmrcRows.map((r: any, i: number) => ({
                        id: r.id ?? `amrc-${Date.now()}-${i}`,
                        reviewCategory: r.reviewCategory ?? r.review_category ?? "",
                        comments: r.comments ?? "",
                        priority: (r.priority as Priority) ?? "MEDIUM",
                        action: r.action ?? "",
                      }))
                    : [createEmptyAmrcRow()]
                );
              }
              if (Array.isArray(step2AuditorResources)) {
                const membersList2 = members.map((m: { id: string; name?: string; email?: string }) => ({ id: m.id, name: m.name || m.email || "—" }));
                setAuditorResources(
                  step2AuditorResources.length > 0
                    ? step2AuditorResources.map((r: any, i: number) => {
                        const uid = r.auditorUserId ?? r.auditor_user_id;
                        const name = uid ? (membersList2.find((mm) => mm.id === uid)?.name ?? "") : "";
                        return {
                          id: r.id ?? `auditor-${auditPlanIdFromUrl}-${i}-${Date.now()}`,
                          auditorSearch: name,
                          auditorUserId: uid ?? "",
                          auditorUin: r.auditorUin ?? r.auditor_uin ?? uid ?? "",
                          roleAssignment: r.roleAssignment ?? r.role_assignment ?? "Auditor",
                          technicalExpert: r.technicalExpert ?? r.technical_expert ?? "",
                          observer: r.observer ?? "",
                          trainee: r.trainee ?? "",
                        };
                      })
                    : [createEmptyAuditorResource()]
                );
              }
            }
          }
        } catch (_) {
          if (cancelled) return;
        }
      }
    })();
    return () => { cancelled = true; };
  }, [orgId, auditPlanIdFromUrl, planQuery.data, members]);

  const [coreCompetence, setCoreCompetence] = useState<Record<string, boolean>>({});
  const toggleCoreCompetence = (key: string) => {
    setCoreCompetence((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const [leadAuditorSelfEval, setLeadAuditorSelfEval] = useState<Record<string, boolean>>(
    LEAD_AUDITOR_SELF_EVAL_ITEMS.reduce((acc, item) => ({ ...acc, [item]: true }), {} as Record<string, boolean>)
  );
  const toggleLeadAuditorSelfEval = (key: string) => {
    setLeadAuditorSelfEval((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const [auditorResources, setAuditorResources] = useState<AuditorResource[]>(() => [createEmptyAuditorResource()]);
  const addAuditorResource = () => {
    setAuditorResources((prev) => [...prev, createEmptyAuditorResource()]);
  };
  const updateAuditorResource = (id: string, field: keyof AuditorResource, value: string) => {
    setAuditorResources((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };
  const removeAuditorResource = (id: string) => {
    setAuditorResources((prev) => prev.filter((r) => r.id !== id));
  };

  const selectAuditorForResource = (resourceId: string, user: { id: string; name: string }) => {
    setAuditorResources((prev) =>
      prev.map((r) =>
        r.id === resourceId
          ? { ...r, auditorUserId: user.id, auditorUin: user.id, auditorSearch: "" }
          : r
      )
    );
  };

  const clearAuditorForResource = (resourceId: string) => {
    setAuditorResources((prev) =>
      prev.map((r) =>
        r.id === resourceId
          ? { ...r, auditorUserId: "", auditorUin: "", auditorSearch: "" }
          : r
      )
    );
  };

  const submitAuditPlan = useCallback(async (asDraft: boolean = false) => {
    if (!orgId || !effectiveProgramId) return;
    setIsSubmittingPlan(true);
    try {
      const assignedAuditorIds = auditorResources
        .map((r) => r.auditorUserId)
        .filter(Boolean);
      const step2Data = {
        tpccRegisteredProcess: tpccRegisteredProcess || undefined,
        tpccAuditReference: tpccAuditReference || undefined,
        leadAuditorComments: leadAuditorComments || undefined,
        rescheduleAuditPlan,
        selectedAuditType: selectedAuditType || undefined,
        methodology: methodology || undefined,
        physicalLocationAddress: physicalLocationAddress || undefined,
        selectedSiteIds: selectedSiteIds ?? [],
        selectedProcessId: selectedProcessId ?? undefined,
        objectivesOther: objectivesOther || undefined,
        objectivesCheckboxes: objectivesCheckboxes ?? undefined,
        parentProgramName: parentProgramName || undefined,
        amrcRows: amrcRows.map((r) => ({
          id: r.id,
          reviewCategory: r.reviewCategory,
          comments: r.comments,
          priority: r.priority,
          action: r.action,
        })),
        auditorResources: auditorResources.map((r) => ({
          id: r.id,
          auditorUserId: r.auditorUserId,
          auditorUin: r.auditorUin,
          roleAssignment: r.roleAssignment,
          technicalExpert: r.technicalExpert || undefined,
          observer: r.observer || undefined,
          trainee: r.trainee || undefined,
        })),
      };

      if (auditPlanIdFromUrl) {
        await apiClient.updateAuditPlan(orgId, auditPlanIdFromUrl, {
          title: auditPlanTitle || undefined,
          auditNumber: auditNumber || undefined,
          criteria: selectedCriteria || undefined,
          plannedDate: plannedDate?.toISOString?.()?.slice(0, 10),
          datePrepared: datePrepared?.toISOString?.()?.slice(0, 10),
          assignedAuditorIds,
          status: asDraft ? "draft" : "plan_submitted_to_auditee",
          step2Data,
        });
      } else {
        const createRes = await apiClient.createAuditPlan(orgId, {
          auditProgramId: effectiveProgramId,
          title: auditPlanTitle || undefined,
          auditNumber: auditNumber || undefined,
          criteria: selectedCriteria || undefined,
          plannedDate: plannedDate?.toISOString?.()?.slice(0, 10),
          datePrepared: datePrepared?.toISOString?.()?.slice(0, 10),
          assignedAuditorIds,
        });
        const newPlanId = (createRes as { planId?: string }).planId;
        if (newPlanId) {
          await apiClient.updateAuditPlan(orgId, newPlanId, { step2Data });
          queryClient.invalidateQueries({ queryKey: ["auditPlan", orgId, newPlanId] });
        }
      }
      queryClient.invalidateQueries({ queryKey: ["auditPlans", orgId] });
      router.push(`/dashboard/${orgId}/audit`);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmittingPlan(false);
    }
  }, [
    orgId,
    effectiveProgramId,
    auditPlanIdFromUrl,
    auditorResources,
    auditPlanTitle,
    auditNumber,
    selectedCriteria,
    selectedChecklistId,
    plannedDate,
    datePrepared,
    tpccRegisteredProcess,
    tpccAuditReference,
    leadAuditorComments,
    rescheduleAuditPlan,
    amrcRows,
    selectedAuditType,
    methodology,
    physicalLocationAddress,
    selectedSiteIds,
    selectedProcessId,
    objectivesOther,
    objectivesCheckboxes,
    parentProgramName,
    queryClient,
    router,
  ]);

  /** Filter auditors by search query for dropdown (only users with Auditor role). */
  const getFilteredAuditorsForSearch = (query: string, excludeUserIds: string[]) => {
    const q = query.trim().toLowerCase();
    if (!q) return auditorsOnly.filter((a) => !excludeUserIds.includes(a.id)).slice(0, 10);
    return auditorsOnly
      .filter(
        (a) =>
          !excludeUserIds.includes(a.id) &&
          ((a.name ?? "").toLowerCase().includes(q) || (a.email ?? "").toLowerCase().includes(q))
      )
      .slice(0, 10);
  };

  const stepQuery = useMemo(() => {
    const p = new URLSearchParams();
    if (auditPlanIdFromUrl) p.set("auditPlanId", auditPlanIdFromUrl);
    if (programIdFromUrl) p.set("programId", programIdFromUrl);
    const c = searchParams.get("criteria");
    if (c) p.set("criteria", c);
    return p.toString();
  }, [auditPlanIdFromUrl, programIdFromUrl, searchParams]);

  const plan = planQuery.data;
  const currentUserRole = plan?.currentUserRole ?? null;
  const planStatus = plan?.status ?? null;
  const canEditStep2 =
    planStatus !== "closed" &&
    (!auditPlanIdFromUrl || currentUserRole === "lead_auditor");

  const lockedSteps = useMemo(() => {
    if (!planStatus || !currentUserRole) return [];
    const locked: number[] = [];
    if (currentUserRole === "lead_auditor" && !["pending_closure", "closed"].includes(planStatus)) locked.push(6);
    if (currentUserRole === "assigned_auditor" && !["ca_submitted_to_auditor", "pending_closure", "closed"].includes(planStatus)) locked.push(5);
    return locked;
  }, [planStatus, currentUserRole]);

  return (
    <div className="space-y-6">
      <AuditWorkflowHeader currentStep={2} orgId={orgId} allowedSteps={[1, 2, 3, 4, 5, 6]} lockedSteps={lockedSteps} stepQuery={stepQuery || undefined} exitHref="../.." />
      {!canEditStep2 && currentUserRole != null && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {planStatus === "closed"
            ? "View only — this audit is complete; no edits allowed."
            : "View only — only the Lead Auditor can edit this step."}
        </div>
      )}
<div className="rounded-lg bg-white px-5 py-8">
        <div className={cn(!canEditStep2 && "pointer-events-none select-none opacity-90")}>
      {/* Step 2 header */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm my-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                STEP 2 OF 6: AUDIT PLAN
              </h1>
              <span className="inline-flex items-center rounded-full bg-green-600 px-3 py-0.5 text-xs font-medium uppercase tracking-wide text-white">
                Operational Level
              </span>
            </div>
            <p className="max-w-2xl text-sm text-gray-500">
              A detailed plan for a specific audit within the audit program.
              Defines how, where, and by whom the audit will be conducted.
            </p>
          </div>
          <Link
            href="#"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
          >
            Learn More
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* ISO 19011:2026 Alignment Note */}
      <div className="relative overflow-hidden rounded-lg border border-blue-200 bg-blue-50/80 px-5 py-4 mb-6">
        <div className="flex gap-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white">
            <Info className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold uppercase tracking-wide text-gray-800">
              ISO 19011:2026 Alignment Note
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-blue-700">
              &ldquo;This audit program, aligned with ISO 19011:2026, provides a
              structured, risk-based framework for establishing, implementing,
              monitoring, reviewing, and improving audits of management systems
              and ESG Sustainability expectations, ensuring they are effective,
              consistent, and objective.&rdquo;
            </p>
          </div>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20">
            <ShieldCheck className="h-16 w-16 text-blue-400" strokeWidth={1.5} />
          </div>
        </div>
      </div>

      {/* Audit Plan Entry Selection */}
      <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-3">
        Audit Plan Entry Selection
      </h2>

      {isLoading || (!!auditPlanIdFromUrl && planQuery.isFetching && !planQuery.data) ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center text-gray-500">
          {auditPlanIdFromUrl && !planQuery.data ? "Loading audit plan…" : "Loading…"}
        </div>
      ) : (
      <div className="space-y-6 mb-6">
        {/* Option A: Continue With Existing Audit Program — select from Step 1 link or search existing programs */}
        <div
          onClick={() => setSelectedPlanOption("A")}
          className={cn(
            "rounded-lg border-2 bg-white p-6 shadow-sm transition-all cursor-pointer hover:shadow-md",
            selectedPlanOption === "A"
              ? "border-green-600 bg-green-50/30"
              : "border-gray-200 hover:border-gray-300"
          )}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-base font-bold text-gray-900">
                OPTION A: CONTINUE WITH EXISTING AUDIT PROGRAM
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                System-link this audit plan to an established program. Use the search below to find a program, or continue from Step 1 with a saved program.
              </p>
            </div>
            {selectedPlanOption === "A" && (
              <div className="ml-4 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-600">
                <Check className="h-4 w-4 text-white" />
              </div>
            )}
          </div>
          {selectedPlanOption === "A" && (
            <div className="mt-4 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  type="search"
                  placeholder="Search audit program by name..."
                  className="h-10 rounded-lg border-gray-300 pl-9"
                  value={programSearch}
                  onChange={(e) => setProgramSearch(e.target.value)}
                />
              </div>
              {programSearch.trim() !== "" && filteredProgramsForSearch.length > 0 && (
                <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
                  <p className="px-3 py-2 text-xs font-medium uppercase text-gray-500 bg-gray-50">Select a program</p>
                  <ul className="max-h-48 overflow-y-auto">
                    {filteredProgramsForSearch.map((pg) => (
                      <li key={pg.id}>
                        <button
                          type="button"
                          className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 border-t border-gray-100 flex items-center justify-between"
                          onClick={() => selectProgramById(pg.id)}
                        >
                          <span className="font-medium text-gray-900">{formatProgramDisplay(pg)}</span>
                          <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {programSearch.trim() !== "" && programsList.length > 0 && filteredProgramsForSearch.length === 0 && (
                <p className="text-sm text-gray-500">No programs match &quot;{programSearch}&quot;.</p>
              )}
              {program && (
                <div className="rounded-lg border border-green-200 bg-green-50/50 px-4 py-3">
                  <p className="text-sm font-medium text-green-800">Linked program: {formatProgramDisplay(program as ProgramListItem)}</p>
                  <p className="text-xs text-green-700 mt-0.5">Objectives, type, criteria, and scope are pre-filled from this program.</p>
                </div>
              )}
              {program && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100"
                    onClick={(e) => { e.stopPropagation(); const key = PROGRAM_PURPOSE_TO_OBJECTIVE[program?.programPurpose ?? ""]; if (key) setObjectivesCheckboxes((prev) => ({ ...prev, [key]: true })); }}
                  >
                    AUTO-POPULATE: AUDIT OBJECTIVES
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100"
                    onClick={(e) => { e.stopPropagation(); const t = PROGRAM_AUDIT_TYPE_TO_PLAN[program?.auditType ?? ""]; if (t) setSelectedAuditType(t); }}
                  >
                    AUTO-POPULATE: AUDIT TYPE
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100"
                    onClick={(e) => { e.stopPropagation(); const c = PROGRAM_CRITERIA_TO_AUDIT_CRITERIA[program?.auditCriteria ?? ""]; if (c) setSelectedCriteria(c); }}
                  >
                    AUTO-POPULATE: AUDIT CRITERIA
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Option B: New Audit Plan — instant plan without program link (commented out for now, use later) */}
        {/* <div
          onClick={() => setSelectedPlanOption("B")}
          className={cn(
            "rounded-lg border-2 bg-white p-6 shadow-sm cursor-pointer transition-all",
            "hover:shadow-md",
            selectedPlanOption === "B"
              ? "border-green-600 bg-green-50/30"
              : "border-gray-200 hover:border-gray-300"
          )}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-base font-bold text-gray-900">
                OPTION B: NEW AUDIT PLAN
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                START AN INSTANT AUDIT PLAN
              </p>
            </div>
            {selectedPlanOption === "B" && (
              <div className="ml-4 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-600">
                <Check className="h-4 w-4 text-white" />
              </div>
            )}
          </div>
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50/80 p-4">
            <div className="flex gap-3">
              <AlertTriangle className="h-6 w-6 shrink-0 text-amber-600" />
              <div className="min-w-0">
                <h4 className="text-sm font-bold uppercase tracking-wide text-amber-800">
                  Critical System Warning
                </h4>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-gray-700">
                  <li>Auditee acceptance of the audit plan is mandatory.</li>
                  <li>
                    The auditee may accept the invitation with conditions or
                    reject it with a valid reason.
                  </li>
                  <li>
                    These audits may increase risk by bypassing critical
                    processes in the audit program&apos;s initial management
                    step.
                  </li>
                  <li>
                    Therefore, they are not recommended as a routine activity.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div> */}

        {/* Option B: Schedule New Audit Program (formerly Option C) */}
        <div
          onClick={() => setSelectedPlanOption("C")}
          className={cn(
            "rounded-lg border-2 bg-white p-6 shadow-sm cursor-pointer transition-all",
            "hover:shadow-md",
            selectedPlanOption === "C"
              ? "border-green-600 bg-green-50/30"
              : "border-gray-200 hover:border-gray-300"
          )}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-base font-bold text-gray-900">
                OPTION B: SCHEDULE NEW AUDIT PROGRAM
              </h3>
            </div>
            {selectedPlanOption === "C" && (
              <div className="ml-4 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-600">
                <Check className="h-4 w-4 text-white" />
              </div>
            )}
          </div>
          <div className="mt-4 rounded-lg border border-gray-300 bg-gray-100/80 p-4">
            <div className="flex gap-3">
              <Clock className="h-5 w-5 shrink-0 text-gray-500" />
              <div className="min-w-0">
                <h4 className="text-sm font-bold uppercase tracking-wide text-gray-700">
                  Draft Status Notice
                </h4>
                <p className="mt-1.5 text-sm italic text-gray-600">
                  &ldquo;This proposal is currently in draft form and is subject
                  to final approval by the lead auditor. Until such approval is
                  granted, this document remains provisional and should be
                  considered incomplete.&rdquo;
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* AUDIT PLAN IDENTIFICATION */}
      <Collapsible
        open={identificationOpen}
        onOpenChange={setIdentificationOpen}
        className="rounded-lg border border-gray-200 bg-white shadow-sm mb-6"
      >
        <CollapsibleTrigger className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-gray-50/80 transition-colors rounded-lg">
          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-900">
            Audit Plan Identification
          </h3>
          {identificationOpen ? (
            <ChevronUp className="h-5 w-5 text-gray-600" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-600" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-gray-200 px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wide text-gray-700">
                  Audit Plan Title*
                </Label>
                <Input
                  placeholder="e.g., Quarterly 2026 QMS & ESG Audit Plan"
                  className="h-10 rounded-lg border-gray-300"
                  value={auditPlanTitle}
                  onChange={(e) => setAuditPlanTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wide text-gray-700">
                  Audit #*
                </Label>
                <Input
                  placeholder="e.g. 001"
                  className="h-10 rounded-lg border-gray-300"
                  value={auditNumber}
                  onChange={(e) => setAuditNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wide text-gray-700">
                  Parent Program*
                </Label>
                <Input
                  placeholder="Program name or link from Option A"
                  className="h-10 rounded-lg border-gray-300 bg-gray-50"
                  value={parentProgramName}
                  onChange={(e) => setParentProgramName(e.target.value)}
                  readOnly={selectedPlanOption === "A" && !!program}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wide text-gray-700">
                  Prepared By* (Lead Auditor)
                </Label>
                <div className="flex h-10 items-center rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700">
                  {currentUserName}
                </div>
                <p className="text-xs text-gray-500">System: audit creator is the lead auditor.</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wide text-gray-700">
                  Date Prepared*
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-10 w-full justify-start rounded-lg border-gray-300 text-left font-normal",
                        !datePrepared && "text-gray-500"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {datePrepared ? format(datePrepared, "MM-dd-yyyy") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={datePrepared}
                      onSelect={setDatePrepared}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* AUDIT PLAN OBJECTIVES */}
      <Collapsible
        open={objectivesOpen}
        onOpenChange={setObjectivesOpen}
        className="rounded-lg border border-gray-200 bg-white shadow-sm mb-6"
      >
        <CollapsibleTrigger className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-gray-50/80 transition-colors rounded-lg">
          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-900">
            Audit Plan Objectives
          </h3>
          {objectivesOpen ? (
            <ChevronUp className="h-5 w-5 text-gray-600" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-600" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-gray-200 px-6 py-5 space-y-6">
            {/* System Generated - Program Purpose & Objectives (from Step 1) */}
            <div className="rounded-lg border border-green-300 bg-green-50/80 p-4">
              <h4 className="text-sm font-bold uppercase tracking-wide text-green-800">
                System Generated - Program Purpose & Objectives
              </h4>
              <div className="mt-3 flex gap-3">
                <Info className="h-5 w-5 shrink-0 text-green-700 mt-0.5" />
                <p className="text-sm text-gray-700">
                  Audit objectives define the purpose of each audit cycle. They
                  may include checking documentation and conformity, evaluating
                  effectiveness and efficiency, verifying corrective actions,
                  reviewing clause adequacy, or investigating risks and changes
                  that impact product or system performance.
                </p>
              </div>
              <p className="mt-2 text-xs text-green-700">
                Selected from Step 1 — PROGRAM PURPOSE & OBJECTIVES (SELECT ONE).
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  "Verify management system conformity (ISO clauses)",
                  "Evaluate system effectiveness & performance",
                  "Assess ESG practices (E / S / G factors)",
                  "Support risk-based decision-making",
                ].map((label) => {
                  const isSelectedFromStep1 = program?.programPurpose != null && PROGRAM_PURPOSE_TO_OBJECTIVE[program.programPurpose] === label;
                  return (
                    <div
                      key={label}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors",
                        isSelectedFromStep1 ? "border-green-500 bg-green-50/50" : "border-gray-200 bg-gray-50/50 opacity-75"
                      )}
                    >
                      {isSelectedFromStep1 ? (
                        <Check className="h-5 w-5 shrink-0 text-green-600" />
                      ) : (
                        <div className="h-5 w-5 shrink-0 rounded border border-gray-300 bg-white" />
                      )}
                      <span className={cn("text-sm", isSelectedFromStep1 ? "text-gray-900 font-medium" : "text-gray-500")}>{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Other - Please Elaborate */}
            <div className="space-y-2">
              <h4 className="text-sm font-bold uppercase tracking-wide text-gray-900">
                Other (Please Elaborate A New System Perspective)
              </h4>
              <Textarea
                placeholder="Enter supplemental audit objectives based on organizational context..."
                className="min-h-24 rounded-lg border-gray-300"
                rows={4}
                value={objectivesOther}
                onChange={(e) => setObjectivesOther(e.target.value)}
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* AUDIT TYPE & THIRD-PARTY CERTIFICATION (TPCC) - same tab */}
      <Collapsible
        open={auditTypeOpen}
        onOpenChange={setAuditTypeOpen}
        className="rounded-lg border border-gray-200 bg-white shadow-sm mb-6"
      >
        <CollapsibleTrigger className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-gray-50/80 transition-colors rounded-lg">
          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-900">
            Audit Type
          </h3>
          {auditTypeOpen ? (
            <ChevronUp className="h-5 w-5 text-gray-600" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-600" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-gray-200 px-6 py-5 space-y-6">
            {/* Audit Type content */}
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 flex gap-3">
                <Info className="h-5 w-5 shrink-0 text-slate-600 mt-0.5" />
                <p className="text-sm text-gray-700 italic">
                  Audits assess systems, processes, products, or integrated
                  combinations, including ESG, for compliance and effectiveness.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {AUDIT_TYPES.map((type) => (
                  <Button
                    key={type.id}
                    type="button"
                    variant="ghost"
                    onClick={() => setSelectedAuditType(type.id)}
                    className={cn(
                      "h-auto flex items-start gap-3 rounded-lg border-2 p-4 text-left transition-colors hover:bg-gray-50/80 whitespace-normal",
                      selectedAuditType === type.id
                        ? "border-green-500 bg-green-50/30"
                        : "border-gray-200 bg-white"
                    )}
                  >
                    <Checkbox
                      checked={selectedAuditType === type.id}
                      onCheckedChange={() => setSelectedAuditType(type.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-0.5 border-2"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold uppercase tracking-wide text-gray-900">
                          {type.title}
                        </span>
                        {type.badge && (
                          <span
                            className={
                              type.badgeVariant === "yellow"
                                ? "inline-flex rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium uppercase text-amber-900"
                                : "text-xs font-medium uppercase text-blue-600"
                            }
                          >
                            {type.badge}
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-sm text-gray-600">
                        {type.description}
                      </p>
                    </div>
                  </Button>
                ))}
              </div>
            </div>

            {/* Third-Party Certification Collaboration (TPCC) */}
            <div className="pt-4 border-t border-gray-200 space-y-4">
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wide text-gray-900">
                  Third-Party Certification Collaboration (TPCC)
                </h4>
                <p className="mt-1 text-sm text-gray-500">
                  Full digital audit environment for collaboration with
                  external registrars.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-700">
                    <User className="h-4 w-4 text-gray-500" />
                    Search Registered Outsourced Process
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      type="search"
                      placeholder="Name or Email of Registrar/Auditor"
                      className="h-10 rounded-lg border-gray-300 pl-9"
                      value={tpccRegisteredProcess}
                      onChange={(e) => setTpccRegisteredProcess(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-700">
                    <FileText className="h-4 w-4 text-gray-500" />
                    Search Third-Party Audit Reference
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      type="search"
                      placeholder="Audit Number / Certificate Reference"
                      className="h-10 rounded-lg border-gray-300 pl-9"
                      value={tpccAuditReference}
                      onChange={(e) => setTpccAuditReference(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-red-300 bg-red-50/80 p-4">
                <div className="flex gap-3">
                  <ShieldCheck className="h-6 w-6 shrink-0 text-red-600" />
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold uppercase tracking-wide text-red-800">
                      TPCC Critical Restriction
                    </h4>
                    <p className="mt-1.5 text-sm text-gray-700">
                      &ldquo;External resources and third-party auditors have
                      restricted system access to Step-3 (Findings) and Step-5
                      (Verification) modules unless explicit guest permissions
                      are granted.&rdquo;
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* AUDIT SCOPE & BOUNDARIES */}
      <Collapsible
        open={scopeOpen}
        onOpenChange={setScopeOpen}
        className="rounded-lg border border-gray-200 bg-white shadow-sm mb-6"
      >
        <CollapsibleTrigger className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-gray-50/80 transition-colors rounded-lg">
          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-900">
            Audit Scope & Boundaries
          </h3>
          {scopeOpen ? (
            <ChevronUp className="h-5 w-5 text-gray-600" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-600" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-gray-200 px-6 py-5 space-y-5">
            {/* Select Audit Methodology */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wide text-gray-700 mb-3">
                Select Audit Methodology
              </h4>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { id: "on-site" as const, label: "ON-SITE", icon: Building2 },
                  { id: "remote" as const, label: "REMOTE", icon: Video },
                  { id: "hybrid" as const, label: "HYBRID", icon: RefreshCw },
                ].map(({ id, label, icon: Icon }) => (
                  <Button
                    key={id}
                    type="button"
                    variant="ghost"
                    onClick={() => setMethodology(id)}
                    className={cn(
                      "h-auto relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 p-5 transition-colors",
                      methodology === id
                        ? "border-green-500 bg-green-50/30"
                        : "border-gray-200 bg-white hover:bg-gray-50/80"
                    )}
                  >
                    {methodology === id && (
                      <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-green-500" />
                    )}
                    <Icon className="h-8 w-8 text-gray-600" />
                    <span className="text-sm font-bold uppercase tracking-wide text-gray-900">
                      {label}
                    </span>
                  </Button>
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50/80 px-4 py-3 flex gap-3">
                <Info className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
                <p className="text-sm text-gray-700 italic">
                  ISO Guidance: Scope should define the extent and boundaries of
                  the audit, such as physical and virtual locations,
                  organizational units, activities and processes, and the time
                  period covered.
                </p>
              </div>
            </div>

            {/* Site Selection & Location Details - two columns */}
            <div className="grid gap-6 sm:grid-cols-2">
           {/* comment for now  site selection */}
              {/* <div>
                <h4 className="text-xs font-bold uppercase tracking-wide text-gray-700 mb-3">
                  Site Selection
                </h4>
                {sites.length === 0 ? (
                  <p className="text-sm text-gray-500">No sites for this organization. Add sites in Settings.</p>
                ) : (
                  <div className="space-y-2">
                    {sites.map((site) => (
                      <Label
                        key={site.id}
                        className={cn(
                          "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                          selectedSiteIds.includes(site.id) ? "border-green-500 bg-green-50/50" : "border-gray-200 bg-white hover:bg-gray-50/80"
                        )}
                      >
                        <Checkbox
                          checked={selectedSiteIds.includes(site.id)}
                          onCheckedChange={() => toggleSite(site.id)}
                          className="mt-0.5"
                        />
                        <div>
                          <span className="text-sm font-semibold text-gray-900">
                            {site.code || site.name}
                          </span>
                          <p className="mt-0.5 text-xs text-gray-500">{site.name}</p>
                        </div>
                      </Label>
                    ))}
                  </div>
                )}
              </div> */}
           {/* comment for now  site selection */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wide text-gray-700 mb-3">
                  Location Details
                </h4>
                {methodology === "on-site" ? (
                  <div className="flex min-h-[200px] w-full flex-col items-center justify-center rounded-lg border border-gray-200 bg-gray-50/50 p-6">
                    <Building2 className="h-16 w-16 text-gray-300" />
                    <p className="mt-3 text-sm font-medium uppercase tracking-wide text-gray-600">
                      Physical Location
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Not used for on-site audits
                    </p>
                  </div>
                ) : (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex min-h-[200px] w-full cursor-pointer flex-col items-center justify-center rounded-lg border border-gray-200 bg-gray-50/50 p-6 text-left transition-colors hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:ring-offset-1"
                      >
                        <Building2 className="h-16 w-16 text-gray-300" />
                        <p className="mt-3 text-sm font-medium uppercase tracking-wide text-gray-600">
                          Physical Location
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {physicalLocationAddress ? physicalLocationAddress : "Click to add location (map)"}
                        </p>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[min(90vw,420px)] p-0" align="start">
                      <div className="p-4 space-y-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium uppercase tracking-wide text-gray-700 flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-green-600" />
                            Add location
                          </Label>
                          <Input
                            placeholder="Enter address or place name"
                            className="rounded-lg border-gray-300"
                            value={physicalLocationAddress}
                            onChange={(e) => setPhysicalLocationAddress(e.target.value)}
                          />
                        </div>
                        <div className="rounded-lg border border-gray-200 overflow-hidden bg-gray-100 min-h-[220px]">
                          <iframe
                            title="Location map"
                            src={`https://www.google.com/maps?q=${encodeURIComponent(physicalLocationAddress || " ")}+&output=embed`}
                            className="w-full h-[220px] border-0"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <p className="text-xs text-gray-500">
                          Enter an address above to view it on the map. Location will be marked for remote and hybrid audits.
                        </p>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
              {methodology !== "on-site" && (
                <div className="mt-4 space-y-2">
                  <span className="block text-xs font-medium uppercase text-gray-500">
                    Chosen location
                  </span>
                  {physicalLocationAddress ? (
                    <div className="rounded-lg border border-gray-200 overflow-hidden bg-gray-100 min-h-[200px]">
                      <iframe
                        title="Chosen location map"
                        src={`https://www.google.com/maps?q=${encodeURIComponent(physicalLocationAddress)}&output=embed`}
                        className="w-full h-[200px] border-0"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                      <p className="px-3 py-2 text-sm text-gray-600 bg-gray-50 border-t border-gray-200">
                        {physicalLocationAddress}
                      </p>
                    </div>
                  ) : (
                    <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/50">
                      <p className="text-sm text-gray-500">No location selected. Click the card above to add a location.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Process / Area to be audited */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wide text-gray-700 mb-3">
                Process / Area to be Audited
              </h4>
              <div className="flex flex-wrap items-end gap-6">
                <div className="space-y-1">
                  <span className="block text-xs font-medium uppercase text-gray-500">
                    Audit Mode (System Generated)
                  </span>
                  <div className="inline-flex items-center gap-2 w-full rounded-lg border border-gray-200 bg-gray-100 px-4 py-2.5">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium uppercase text-gray-800">
                      {methodology === "on-site"
                        ? "ON-SITE"
                        : methodology === "remote"
                          ? "REMOTE"
                          : "HYBRID"}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="block text-xs font-medium uppercase text-gray-500">
                    Site (System Generated)
                  </span>
                  <div className="inline-flex items-center gap-2 w-full rounded-lg border border-gray-200 bg-gray-100 px-4 py-2.5">
                    <MapPin className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-gray-800">
                      {displaySite}
                    </span>
                  </div>
                </div>
                <div className="min-w-[220px] flex-1 space-y-1">
                  <span className="block text-xs font-medium uppercase text-gray-500">
                    Process (System Generated)
                  </span>
                  <div className="inline-flex items-center gap-2 w-full min-h-10 rounded-lg border border-gray-200 bg-gray-100 px-4 py-2.5">
                    <span className="text-sm font-medium text-gray-800">
                      {program?.processName ?? "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* AUDIT PLAN CALENDAR */}
      <Collapsible
        open={calendarOpen}
        onOpenChange={setCalendarOpen}
        className="rounded-lg border border-gray-200 bg-white shadow-sm mb-6"
      >
        <CollapsibleTrigger className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-gray-50/80 transition-colors rounded-lg">
          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-900">
            Audit Plan Calendar
          </h3>
          {calendarOpen ? (
            <ChevronUp className="h-5 w-5 text-gray-600" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-600" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-gray-200">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-200 bg-gray-50/80">
                    <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wide text-gray-700">
                      Field
                    </TableHead>
                    <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wide text-gray-700">
                      Requirement / Input
                    </TableHead>
                    <TableHead className="px-6 py-3 text-xs font-bold uppercase tracking-wide text-gray-700">
                      Condition & Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="px-6 py-4 font-medium uppercase tracking-wide text-gray-800">
                      Planned Date
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "h-10 w-full max-w-xs justify-start rounded-lg border-gray-300 text-left font-normal",
                              !plannedDate && "text-gray-500"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {plannedDate ? format(plannedDate, "MM-dd-yyyy") : "Select date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={plannedDate}
                            onSelect={setPlannedDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <span className="inline-flex rounded bg-red-100 px-2 py-0.5 text-xs font-medium uppercase text-red-800">
                        Required
                      </span>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="px-6 py-4 font-medium uppercase tracking-wide text-gray-800">
                      Actual Date
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="h-10 flex items-center rounded-lg border border-gray-200 bg-gray-100 px-3 text-sm text-gray-500 w-full max-w-xs">
                        — (system generated when audit is conducted)
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-xs text-gray-600">
                      System Generated (Log)
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="px-6 py-4 font-medium uppercase tracking-wide text-gray-800">
                      Reschedule Audit Plan
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="flex gap-4">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setRescheduleAuditPlan("yes")}
                          className={cn(
                            "h-auto p-0 text-sm font-medium uppercase",
                            rescheduleAuditPlan === "yes"
                              ? "font-bold text-gray-900 underline"
                              : "text-gray-500 hover:text-gray-700"
                          )}
                        >
                          Yes
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setRescheduleAuditPlan("no")}
                          className={cn(
                            "h-auto p-0 text-sm font-medium uppercase",
                            rescheduleAuditPlan === "no"
                              ? "font-bold text-gray-900 underline"
                              : "text-gray-500 hover:text-gray-700"
                          )}
                        >
                          No
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-xs text-gray-600">
                      Conditional Field
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="px-6 py-4 font-medium uppercase tracking-wide text-gray-800">
                      Lead Auditor Comments
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <Textarea
                        placeholder="Enter detailed comments regarding scheduling, justification..."
                        className="min-h-20 w-full max-w-xl rounded-lg border-gray-300"
                        rows={3}
                        value={leadAuditorComments}
                        onChange={(e) => setLeadAuditorComments(e.target.value)}
                      />
                    </TableCell>
                    <TableCell className="px-6 py-4 text-xs text-gray-600">
                      Conditional Log
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center gap-2 rounded-b-lg border-t border-green-200 bg-green-50 px-6 py-3">
              <Lock className="h-5 w-5 shrink-0 text-green-700" />
              <p className="text-sm font-medium uppercase text-green-800">
                Permission Note: Only the lead auditor can create or reschedule
                audits.
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* AUDIT PLAN CRITERIA (SELECT ONE) */}
      <Collapsible
        open={criteriaOpen}
        onOpenChange={setCriteriaOpen}
        className="rounded-lg border border-gray-200 bg-white shadow-sm mb-6"
      >
        <CollapsibleTrigger className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-gray-50/80 transition-colors rounded-lg">
          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-900">
            Audit Plan Criteria (Select One)
          </h3>
          {criteriaOpen ? (
            <ChevronUp className="h-5 w-5 text-gray-600" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-600" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-gray-200 px-6 py-5 space-y-4">
            {auditChecklists.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-4">
                <p className="text-sm text-amber-800">
                  <span className="font-semibold">No audit checklists yet.</span> Create checklists and add questions in{" "}
                  <Link href={`/dashboard/${orgId}/settings/audit-checklist`} className="underline font-medium text-amber-900 hover:text-amber-700">
                    Settings → Audit Checklist
                  </Link>
                  . Criteria selection drives the checklist questions in Step 3.
                </p>
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {auditChecklists.map((c) => (
                    <Label
                      key={c.id}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors",
                        selectedChecklistId === c.id
                          ? "border-green-500 bg-green-50/30"
                          : "border-gray-200 bg-white hover:bg-gray-50/80"
                      )}
                    >
                      <Checkbox
                        checked={selectedChecklistId === c.id}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedChecklistId(c.id);
                            setSelectedCriteria(c.name);
                          } else {
                            setSelectedChecklistId(null);
                            setSelectedCriteria(null);
                          }
                        }}
                        className="border-2 border-green-600 data-[state=checked]:border-green-600"
                      />
                      <span className="text-sm font-medium uppercase tracking-wide text-gray-800">
                        {c.name}
                      </span>
                      {c.questionCount > 0 && (
                        <span className="text-xs text-gray-500 ml-auto">({c.questionCount})</span>
                      )}
                    </Label>
                  ))}
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50/80 px-4 py-3 flex gap-3">
                  <RefreshCw className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
                  <p className="text-sm text-blue-700">
                    <span className="font-semibold uppercase">Automation Note:</span>{" "}
                    Criteria selection influences audit checklist generation and
                    evidence requirements in Step 3.
                  </p>
                </div>
              </>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* AUDIT METHODS & RISK CONSIDERATIONS */}
      <Collapsible
        open={methodsOpen}
        onOpenChange={setMethodsOpen}
        className="rounded-lg border border-gray-200 bg-white shadow-sm mb-6"
      >
        <CollapsibleTrigger className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-gray-50/80 transition-colors rounded-lg">
          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-900">
            Audit Methods & Risk Considerations
          </h3>
          {methodsOpen ? (
            <ChevronUp className="h-5 w-5 text-gray-600" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-600" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-gray-200">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-200 bg-gray-50/80">
                    <TableHead className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-700">
                      AMRC#
                    </TableHead>
                    <TableHead className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-700">
                      Review Category
                    </TableHead>
                    <TableHead className="min-w-[200px] px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-700">
                      Auditor Comments & Scope Notes
                    </TableHead>
                    <TableHead className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-700">
                      Priority
                    </TableHead>
                    <TableHead className="min-w-[140px] px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-700">
                      Action (If Any)
                    </TableHead>
                    <TableHead className="w-12 px-4 py-3 text-center text-gray-700">
                      <span className="sr-only">Delete</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {amrcRows.map((row, index) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap px-4 py-3 font-medium text-gray-800">
                        {String(index + 1).padStart(2, "0")}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-3">
                        <Input
                          value={row.reviewCategory}
                          onChange={(e) =>
                            updateAmrcRow(row.id, "reviewCategory", e.target.value)
                          }
                          placeholder="Review category"
                          className="h-9 min-w-[180px] rounded-lg border-gray-300 text-sm"
                        />
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Input
                          value={row.comments}
                          onChange={(e) =>
                            updateAmrcRow(row.id, "comments", e.target.value)
                          }
                          placeholder="Auditor perspective..."
                          className="h-9 w-full rounded-lg border-gray-300 text-sm"
                        />
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Select
                          value={row.priority}
                          onValueChange={(value) =>
                            updateAmrcRow(row.id, "priority", value as Priority)
                          }
                        >
                          <SelectTrigger
                            size="sm"
                            className="h-8 min-w-[90px] rounded-full border-gray-300 bg-gray-200/80 px-3 text-xs font-medium uppercase text-gray-700"
                          >
                            <SelectValue placeholder="Priority" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="HIGH">High</SelectItem>
                            <SelectItem value="MEDIUM">Medium</SelectItem>
                            <SelectItem value="LOW">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Input
                          value={row.action}
                          onChange={(e) =>
                            updateAmrcRow(row.id, "action", e.target.value)
                          }
                          placeholder="Next step..."
                          className="h-9 w-full rounded-lg border-gray-300 text-sm"
                        />
                      </TableCell>
                      <TableCell className="px-4 py-3 text-center">
                        {amrcRows.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => removeMethodologyRow(row.id)}
                            aria-label="Delete methodology row"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-center border-t border-gray-200 px-6 py-4">
              <Button
                type="button"
                onClick={addMethodologyRow}
                className="bg-green-600 text-white hover:bg-green-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Methodology Row
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* AUDITOR ROLE & COMPETENCE */}
      <Collapsible
        open={auditorRoleOpen}
        onOpenChange={setAuditorRoleOpen}
        className="rounded-lg border border-gray-200 bg-white shadow-sm mb-6"
      >
        <CollapsibleTrigger className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-gray-50/80 transition-colors rounded-lg">
          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-900">
            Auditor Role & Competence
          </h3>
          {auditorRoleOpen ? (
            <ChevronUp className="h-5 w-5 text-gray-600" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-600" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-gray-200 px-6 py-5 space-y-6">
            {/* Two panels: Core Auditor Competence | Lead Auditor Self-Evaluation */}
            <div className="grid gap-6 sm:grid-cols-2">
              {/* Core Auditor Competence */}
              <div className="relative rounded-lg border border-gray-200 bg-white p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-wide text-gray-900 border-b-2 border-green-600 pb-1 w-fit">
                      Core Auditor Competence
                    </h4>
                    <p className="mt-1 text-xs text-gray-500">
                      ISO 19011 Annex A Alignment
                    </p>
                  </div>
                  <Users2 className="h-8 w-8 text-gray-300 shrink-0" />
                </div>
                <div className="mt-4 space-y-2">
                  {CORE_AUDITOR_COMPETENCIES.map((item) => (
                    <Label
                      key={item}
                      className="flex items-center gap-3 rounded border border-gray-100 bg-gray-50/50 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <Checkbox
                        checked={!!coreCompetence[item]}
                        onCheckedChange={() => toggleCoreCompetence(item)}
                      />
                      <span className="text-xs font-medium uppercase tracking-wide text-gray-800">
                        {item}
                      </span>
                    </Label>
                  ))}
                </div>
              </div>

              {/* Lead Auditor Self-Evaluation */}
              <div className="relative overflow-hidden rounded-lg border border-green-800/30 bg-green-900/20 p-5">
                <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-10">
                  <ShieldCheck className="h-24 w-24 text-green-600" strokeWidth={1.5} />
                </div>
                <h4 className="text-sm font-bold uppercase tracking-wide text-green-900 border-b-2 border-green-600 pb-1 w-fit">
                  Lead Auditor Self-Evaluation
                </h4>
                <p className="mt-1 text-xs text-green-800/80">
                  Leadership & Management Clauses
                </p>
                <div className="mt-4 space-y-2 relative">
                  {LEAD_AUDITOR_SELF_EVAL_ITEMS.map((item) => (
                    <Label
                      key={item}
                      className="flex items-center gap-3 rounded border border-green-200/50 bg-white/60 px-3 py-2 cursor-pointer hover:bg-white/80 transition-colors"
                    >
                      <Checkbox
                        checked={!!leadAuditorSelfEval[item]}
                        onCheckedChange={() => toggleLeadAuditorSelfEval(item)}
                        className="border-green-600 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                      />
                      <span className="text-xs font-medium uppercase tracking-wide text-gray-800">
                        {item}
                      </span>
                    </Label>
                  ))}
                </div>
              </div>
            </div>

            {/* Auditor Assignment — search/select only users with Auditor role; UIN = user id (auto); Role = Auditor | Trainee */}
            <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-5 space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-wide text-gray-900">
                    Auditor Assignment
                  </h4>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Search and select auditors from your organization. Only users with the &quot;Auditor&quot; role appear. UIN auto-fills when an auditor is selected. Use Manual Entry for Technical Expert, Observer, and Trainee names.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={addAuditorResource}
                  className="bg-green-600 text-white hover:bg-green-700 shrink-0"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Auditor Resource
                </Button>
              </div>

              {auditorResources.map((resource, index) => {
                const selectedAuditor = resource.auditorUserId
                  ? members.find((m) => m.id === resource.auditorUserId)
                  : null;
                const assignedElsewhere = auditorResources
                  .filter((r) => r.id !== resource.id)
                  .map((r) => r.auditorUserId)
                  .filter(Boolean);
                const auditProcessId = program?.processId ?? null;
                const userIdsInAuditProcess = auditProcessId
                  ? auditorsOnly.filter((m) => m.processId === auditProcessId).map((m) => m.id)
                  : [];
                const excludeIds = [
                  ...assignedElsewhere,
                  ...(currentUserId ? [currentUserId] : []),
                  ...userIdsInAuditProcess,
                ];
                const dropdownAuditors = getFilteredAuditorsForSearch(resource.auditorSearch, excludeIds);
                return (
                  <div
                    key={resource.id}
                    className="rounded-lg border border-gray-200 bg-white p-4 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                        Auditor Resource {index + 1}
                      </span>
                      {auditorResources.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                          onClick={() => removeAuditorResource(resource.id)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-1">
                        <Label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-700">
                          <Search className="h-4 w-4 text-gray-500" />
                          Auditor Search
                        </Label>
                        {selectedAuditor ? (
                          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                            <User className="h-4 w-4 text-gray-500" />
                            <span className="text-sm font-medium text-gray-900">{selectedAuditor.name}</span>
                            <span className="text-xs text-gray-500">{selectedAuditor.email}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="ml-auto text-xs text-blue-600 hover:text-blue-700"
                              onClick={() => clearAuditorForResource(resource.id)}
                            >
                              Change
                            </Button>
                          </div>
                        ) : (
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <Input
                              placeholder="Name / Email"
                              className="h-10 rounded-lg border-gray-300 pl-9"
                              value={resource.auditorSearch}
                              onChange={(e) =>
                                updateAuditorResource(resource.id, "auditorSearch", e.target.value)
                              }
                            />
                            {resource.auditorSearch.trim() !== "" && (
                              <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-48 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                                {dropdownAuditors.length === 0 ? (
                                  <p className="px-3 py-2 text-sm text-gray-500">No auditors match or all are already assigned.</p>
                                ) : (
                                  dropdownAuditors.map((aud) => (
                                    <button
                                      key={aud.id}
                                      type="button"
                                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                                      onClick={() => selectAuditorForResource(resource.id, aud)}
                                    >
                                      <User className="h-4 w-4 text-gray-400" />
                                      <span className="font-medium">{aud.name}</span>
                                      <span className="text-gray-500">{aud.email}</span>
                                    </button>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-700">
                          <ShieldCheck className="h-4 w-4 text-gray-500" />
                          Auditor UIN
                        </Label>
                        <Input
                          placeholder="Auto-filled when auditor selected"
                          className="h-10 rounded-lg border-gray-300 bg-gray-50"
                          value={resource.auditorUin}
                          readOnly
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-700">
                          <User className="h-4 w-4 text-gray-500" />
                          Role Assignment
                        </Label>
                        <Input
                          className="h-10 rounded-lg border-gray-300 bg-gray-50"
                          value="Auditor"
                          readOnly
                        />
                      </div>
                    </div>

                    <div className="pt-3 border-t border-gray-100">
                      <h5 className="text-xs font-bold uppercase tracking-wide text-green-700 mb-3">
                        Manual Entry
                      </h5>
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-1">
                          <Label className="block text-xs font-medium uppercase tracking-wide text-gray-700">
                            Technical Expert Name
                          </Label>
                          <Input
                            placeholder="Name"
                            className="h-10 rounded-lg border-gray-300"
                            value={resource.technicalExpert}
                            onChange={(e) =>
                              updateAuditorResource(resource.id, "technicalExpert", e.target.value)
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="block text-xs font-medium uppercase tracking-wide text-gray-700">
                            Observer Name
                          </Label>
                          <Input
                            placeholder="Name"
                            className="h-10 rounded-lg border-gray-300"
                            value={resource.observer}
                            onChange={(e) =>
                              updateAuditorResource(resource.id, "observer", e.target.value)
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="block text-xs font-medium uppercase tracking-wide text-gray-700">
                            Trainee Name
                          </Label>
                          <Input
                            placeholder="Name"
                            className="h-10 rounded-lg border-gray-300"
                            value={resource.trainee}
                            onChange={(e) =>
                              updateAuditorResource(resource.id, "trainee", e.target.value)
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Audit Plan Summary & Actions - dark card */}
      <div className="rounded-xl border border-green-500/30 bg-gray-900 shadow-lg shadow-green-500/5 overflow-hidden">
        <div className="border-t border-green-400/40" aria-hidden />
        <div className="px-6 py-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-green-400">
                Audit Plan Date
              </p>
              <p className="mt-1 text-xl font-bold text-white">{datePrepared ? format(datePrepared, "MM-dd-yyyy") : "—"}</p>
              <p className="mt-0.5 text-xs text-gray-400">Date Prepared</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-green-400">
                Planned Date
              </p>
              <p className="mt-1 text-xl font-bold text-white">{plannedDate ? format(plannedDate, "MM-dd-yyyy") : "—"}</p>
              <p className="mt-0.5 text-xs text-gray-400">User-selected</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-green-400">
                Lead Auditor
              </p>
              <p className="mt-1 text-xl font-bold text-white">{currentUserName}</p>
              <p className="mt-0.5 text-xs text-gray-400">Audit creator</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center justify-center rounded-lg border border-gray-600 bg-gray-800/80 px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white">
                  <Check className="h-4 w-4 text-green-600" />
                </div>
                <p className="mt-2 text-xs text-gray-300">{effectiveProgramId ? `Program: ${effectiveProgramId.slice(0, 8)}…` : "—"}</p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button
              type="button"
              variant="outline"
              className="border-green-500 bg-transparent text-green-500 hover:bg-green-500/10 hover:text-green-400"
              disabled={!effectiveProgramId || isSubmittingPlan}
              onClick={() => submitAuditPlan(true)}
            >
              <FileText className="h-4 w-4 mr-2" />
              {isSubmittingPlan ? "Saving…" : "Save Audit Plan (Draft)"}
            </Button>
            <Button
              type="button"
              className="bg-green-600 text-white hover:bg-green-700"
              disabled={!effectiveProgramId || isSubmittingPlan}
              onClick={() => submitAuditPlan(false)}
            >
              <FileCheck className="h-4 w-4 mr-2" />
              {isSubmittingPlan ? "Submitting…" : "Generate Audit Plan"}
            </Button>
          </div>
        </div>
      </div>

      </div>
      {/* Step navigation */}

      {/* <div className="flex items-center justify-between px-6 py-4 mt-6">
        <Button variant="outline" className="text-gray-700 border-gray-300" asChild>
          <Link
            href={programIdFromUrl ? `/dashboard/${orgId}/audit/create/1?programId=${programIdFromUrl}` : `/dashboard/${orgId}/audit/create/1`}
            className="inline-flex items-center gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous Step
          </Link>
        </Button>
        <Button className="bg-green-600 text-white hover:bg-green-700" asChild>
          <Link
            href={(() => {
              const params = new URLSearchParams();
              if (programIdFromUrl) params.set("programId", programIdFromUrl);
              if (selectedChecklistId) params.set("checklistId", selectedChecklistId);
              if (selectedCriteria) params.set("criteria", selectedCriteria);
              const q = params.toString();
              return `/dashboard/${orgId}/audit/create/3${q ? `?${q}` : ""}`;
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
