"use client";

import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  FileCheck,
  MessageSquare,
  Square,
} from "lucide-react";
import AuditWorkflowHeader from "@/components/audit/AuditWorkflowHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

export default function CreateAuditStep6Page() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const orgId = params?.orgId as string;
  const programId = searchParams.get("programId") ?? "";
  const criteria = searchParams.get("criteria") ?? "";
  const auditPlanId = searchParams.get("auditPlanId") ?? "";
  const stepQuery = (() => {
    const p = new URLSearchParams();
    if (programId) p.set("programId", programId);
    if (criteria) p.set("criteria", criteria);
    if (auditPlanId) p.set("auditPlanId", auditPlanId);
    const q = p.toString();
    return q ? `?${q}` : "";
  })();

  const [isLoading, setIsLoading] = useState(!!auditPlanId);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [planStatus, setPlanStatus] = useState<string | null>(null);
  const [auditIdDisplay, setAuditIdDisplay] = useState("—");
  const [leadAuditorDisplay, setLeadAuditorDisplay] = useState({ name: "—", role: "—" });
  const [dateApproved, setDateApproved] = useState(() => format(new Date(), "dd-MMM-yyyy"));
  const [timeApproved, setTimeApproved] = useState(() => format(new Date(), "HH:mm"));
  const [stats, setStats] = useState({ total: 0, majorNcs: 0, minorNcs: 0 });
  const [closing, setClosing] = useState(false);

  const [finalDecision, setFinalDecision] = useState<
    "effective" | "ineffective"
  >("effective");
  const [managementComments, setManagementComments] = useState("");

  useEffect(() => {
    if (!orgId || !auditPlanId) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const planRes = await apiClient.getAuditPlan(orgId, auditPlanId);
        if (cancelled || !planRes.plan) {
          if (!cancelled) setIsLoading(false);
          return;
        }
        const plan = planRes.plan;
        if (!cancelled) {
          setCurrentUserRole(plan.currentUserRole ?? null);
          setPlanStatus(plan.status ?? null);
          setAuditIdDisplay(plan.auditNumber || plan.id?.slice(0, 8) || "—");
        }
        const membersRes = await apiClient.getMembers(orgId);
        if (!cancelled && membersRes.teamMembers?.length && plan.leadAuditorUserId) {
          const lead = membersRes.teamMembers.find((m: { id: string }) => m.id === plan.leadAuditorUserId);
          const member = lead as { name?: string; email?: string; systemRole?: string } | undefined;
          setLeadAuditorDisplay({
            name: member ? (member.name || member.email || "—") : "—",
            role: member?.systemRole || "Lead Auditor",
          });
        }
        const findingsRes = await apiClient.getAuditPlanFindings(orgId, auditPlanId);
        if (!cancelled && findingsRes.findings?.length) {
          const f = findingsRes.findings;
          setStats({
            total: f.length,
            majorNcs: f.filter((x: { status: string }) => x.status === "major_nc").length,
            minorNcs: f.filter((x: { status: string }) => x.status === "minor_nc").length,
          });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orgId, auditPlanId]);

  const canEditStep6 =
    planStatus !== "closed" && currentUserRole === "lead_auditor";

  const lockedSteps = useMemo(() => {
    if (!planStatus || !currentUserRole) return [];
    const locked: number[] = [];
    if (currentUserRole === "lead_auditor" && !["pending_closure", "closed"].includes(planStatus)) locked.push(6);
    if (currentUserRole === "assigned_auditor" && !["ca_submitted_to_auditor", "pending_closure", "closed"].includes(planStatus)) locked.push(5);
    return locked;
  }, [planStatus, currentUserRole]);

  return (
    <div className="space-y-6">
      <AuditWorkflowHeader currentStep={6} orgId={orgId} allowedSteps={[1, 2, 3, 4, 5, 6]} lockedSteps={lockedSteps} stepQuery={stepQuery || undefined} exitHref="../.." />
      {!canEditStep6 && currentUserRole != null && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {planStatus === "closed"
            ? "View only — this audit is complete; no edits allowed."
            : "View only — only the Lead Auditor can edit this step."}
        </div>
      )}
      <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <div className={cn(!canEditStep6 && "pointer-events-none select-none opacity-90")}>
        {/* Header - Audit Final Closure */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-green-200 bg-green-50 text-green-600">
            <FileCheck className="h-8 w-8" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">
            Audit Final Closure
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Audit ID:{" "}
            <span className="font-semibold text-green-600">{isLoading ? "…" : auditIdDisplay}</span>
            {" • "}
            ISO 19011:2026 Compliant
          </p>
        </div>

        {/* Management Final Decision & Management Comments - two columns */}
        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Left: Management Final Decision */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-900">
              MANAGEMENT FINAL DECISION
            </h2>
            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFinalDecision("effective")}
                className={cn(
                  "h-auto w-full flex items-start justify-start gap-4 rounded-lg border-2 p-4 text-left transition-colors whitespace-normal",
                  finalDecision === "effective"
                    ? "border-green-500 bg-green-50 hover:bg-green-100"
                    : "border-gray-200 bg-white hover:border-gray-300"
                )}
              >
                {finalDecision === "effective" ? (
                  <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                ) : (
                  <Square className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
                )}
                <div>
                  <p className="font-bold text-gray-900">
                    Effective - Close Audit
                  </p>
                  <p className="mt-0.5 text-sm text-gray-500">
                    Confirming all findings are addressed and system is stable.
                  </p>
                </div>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFinalDecision("ineffective")}
                className={cn(
                  "h-auto w-full flex items-start justify-start gap-4 rounded-lg border-2 p-4 text-left transition-colors whitespace-normal",
                  finalDecision === "ineffective"
                    ? "border-green-500 bg-green-50 hover:bg-green-100"
                    : "border-gray-200 bg-white hover:border-gray-300"
                )}
              >
                {finalDecision === "ineffective" ? (
                  <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                ) : (
                  <Square className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
                )}
                <div>
                  <p className="font-bold text-gray-900">
                    Ineffective - Re-open Audit
                  </p>
                  <p className="mt-0.5 text-sm text-gray-500">
                    Audit does not meet criteria for closure. Further action
                    required.
                  </p>
                </div>
              </Button>
            </div>
          </div>

          {/* Right: Management Comments */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 shrink-0 text-green-500" />
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-900">
                MANAGEMENT COMMENTS
              </h2>
            </div>
            <Textarea
              placeholder="Executive summary of the audit cycle and final approval notes..."
              className="min-h-44 rounded-lg border-gray-200 bg-white italic text-gray-500 placeholder:text-gray-400"
              rows={8}
              value={managementComments}
              onChange={(e) => setManagementComments(e.target.value)}
            />
          </div>
        </div>

        {/* Authentication & Seal */}
        <div className="mt-10 space-y-4 bg-accent rounded-xl p-6">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 shrink-0 text-green-600" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-900">
              AUTHENTICATION & SEAL
            </h2>
          </div>
          <p className="text-sm leading-relaxed text-gray-600">
            By closing this audit, the management confirms that the audit
            process was conducted in accordance with the established program
            and ISO 19011:2026 guidelines.
          </p>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
            <div className="flex flex-1 gap-8">
              <div className="bg-white rounded-lg p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                  APPROVED BY (LEAD AUDITOR)
                </p>
                <p className="mt-1 font-bold text-gray-900">{isLoading ? "…" : leadAuditorDisplay.name}</p>
                <p className="text-sm text-gray-600">
                  {isLoading ? "…" : leadAuditorDisplay.role}
                </p>
              </div>
              <div className="bg-white rounded-lg p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                  DATE APPROVED
                </p>
                <p className="mt-1 font-bold text-gray-900">{dateApproved}</p>
                <p className="text-sm text-gray-600">{timeApproved}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center justify-center">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-green-200 bg-green-50/50 p-1">
                <span
                  className="block max-w-[80px] text-center text-[9px] font-medium uppercase leading-tight text-gray-400"
                  style={{ transform: "rotate(-45deg)" }}
                >
                  VAPPS OFFICIAL SEAL
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Statistics - 3 cards (from findings) */}
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-6 py-5 md:flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
              TOTAL FINDINGS
            </p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{isLoading ? "…" : stats.total}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-6 py-5 md:flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
              MAJOR NCS CLOSED
            </p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{isLoading ? "…" : stats.majorNcs}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-6 py-5 md:flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
              MINOR NCS CLOSED
            </p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{isLoading ? "…" : stats.minorNcs}</p>
          </div>
        </div>
      </div>
      </div>

      {/* Step navigation */}
      <div className="flex items-center justify-between px-6 py-4">
        {/* <Button
          variant="outline"
          className="border-gray-300 text-gray-600 hover:bg-gray-50"
          asChild
        >
          <Link
            href={`/dashboard/${orgId}/audit/create/5${stepQuery}`}
            className="inline-flex items-center gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous Step
          </Link>
        </Button> */}
        <Button
          className="bg-green-600 text-white hover:bg-green-700 ml-auto"
          disabled={closing || !auditPlanId || !canEditStep6}
          onClick={async () => {
            if (!orgId || !auditPlanId) return;
            setClosing(true);
            try {
              if (finalDecision === "effective") {
                await apiClient.updateAuditPlanStatus(orgId, auditPlanId, "closed");
                toast.success("Audit complete. Status: Closed.");
              }
              router.push(`/dashboard/${orgId}/audit`);
            } catch (e) {
              console.error(e);
              toast.error("Failed to close audit.");
            } finally {
              setClosing(false);
            }
          }}
        >
          {closing ? "Closing…" : finalDecision === "effective" ? "Finalize Audit & Close" : "Return to Audit List"}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
