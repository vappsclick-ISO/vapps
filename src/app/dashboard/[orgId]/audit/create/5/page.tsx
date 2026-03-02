"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useRef, useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import {
  CheckCircle,
  ChevronRight,
  ClipboardCheck,
  Paperclip,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import AuditWorkflowHeader from "@/components/audit/AuditWorkflowHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";

export default function CreateAuditStep5Page() {
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
  const [leadAuditorDisplay, setLeadAuditorDisplay] = useState("—");
  const [verificationStartedAt, setVerificationStartedAt] = useState(() => format(new Date(), "dd-MMM-yyyy HH:mm"));

  const [verificationOutcome, setVerificationOutcome] = useState<
    "effective" | "ineffective"
  >("effective");
  const [auditorComments, setAuditorComments] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState<{ name: string; key: string }[]>([]);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [proceedingToStep6, setProceedingToStep6] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!orgId || !auditPlanId) {
      setIsLoading(false);
      setVerificationStartedAt(format(new Date(), "dd-MMM-yyyy HH:mm"));
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
          setVerificationStartedAt(format(new Date(), "dd-MMM-yyyy HH:mm"));
        }
        const membersRes = await apiClient.getMembers(orgId);
        if (!cancelled && membersRes.teamMembers?.length && plan.leadAuditorUserId) {
          const lead = membersRes.teamMembers.find((m: { id: string }) => m.id === plan.leadAuditorUserId);
          setLeadAuditorDisplay(lead ? `${lead.name || lead.email || "—"} (Lead Auditor)` : "—");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orgId, auditPlanId]);

  const handleEvidenceChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !orgId) return;
    const planId = auditPlanId || "draft";
    setUploadingEvidence(true);
    try {
      const uploaded: { name: string; key: string }[] = [];
      for (let i = 0; i < files.length; i++) {
        const res = await apiClient.uploadAuditDocument(files[i], orgId, planId, 5);
        uploaded.push({ name: res.name, key: res.key });
      }
      setEvidenceFiles((prev) => [...prev, ...uploaded]);
    } catch (err) {
      console.error(err);
    } finally {
      setUploadingEvidence(false);
      e.target.value = "";
    }
  };

  const canEditStep5 =
    currentUserRole === "assigned_auditor" &&
    !["pending_closure", "closed"].includes(planStatus ?? "");

  const lockedSteps = useMemo(() => {
    if (!planStatus || !currentUserRole) return [];
    const locked: number[] = [];
    if (currentUserRole === "lead_auditor" && !["pending_closure", "closed"].includes(planStatus)) locked.push(6);
    if (currentUserRole === "assigned_auditor" && !["ca_submitted_to_auditor", "pending_closure", "closed"].includes(planStatus)) locked.push(5);
    return locked;
  }, [planStatus, currentUserRole]);

  const auditTrailText = `Verification Started\n${leadAuditorDisplay} • ${verificationStartedAt}\n\nAwaiting Final Verification\n---`;

  const handleCopyAuditTrail = async () => {
    try {
      await navigator.clipboard.writeText(auditTrailText);
      toast.success("Audit trail copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <div className="space-y-6">
      <AuditWorkflowHeader currentStep={5} orgId={orgId} allowedSteps={[1, 2, 3, 4, 5, 6]} lockedSteps={lockedSteps} stepQuery={stepQuery || undefined} exitHref="../.." />
      {!canEditStep5 && currentUserRole != null && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {planStatus === "closed"
            ? "View only — this audit is complete; no edits allowed."
            : "View only — only the assigned Auditor can edit this step."}
        </div>
      )}
      <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <div className={cn(!canEditStep5 && "pointer-events-none select-none opacity-90")}>
        {/* Main title with thick green vertical bar to the left */}
        <div className="flex items-center">
          <div className="h-9 w-1.5 shrink-0 rounded-full bg-green-500" />
          <h1 className="pl-3 text-xl font-bold uppercase tracking-wide text-gray-900">
            EFFECTIVENESS VERIFICATION
          </h1>
        </div>

        {/* Verification Outcome */}
        <div className="mt-8 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-900">
            VERIFICATION OUTCOME
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setVerificationOutcome("effective")}
              className={cn(
                "h-auto flex flex-col items-center justify-center gap-3 rounded-lg p-6 text-center transition-colors",
                verificationOutcome === "effective"
                  ? "border-2 border-green-500 bg-green-50 text-green-700 hover:bg-green-100"
                  : "border border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50"
              )}
            >
              <CheckCircle
                className={cn(
                  "h-14 w-14",
                  verificationOutcome === "effective" ? "text-green-600" : "text-gray-400"
                )}
              />
              <span className="text-sm font-bold uppercase tracking-wide">
                EFFECTIVE
              </span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setVerificationOutcome("ineffective")}
              className={cn(
                "h-auto flex flex-col items-center justify-center gap-3 rounded-lg p-6 text-center transition-colors",
                verificationOutcome === "ineffective"
                  ? "border-2 border-green-500 bg-green-50 text-green-700 hover:bg-green-100"
                  : "border border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50"
              )}
            >
              <XCircle
                className={cn(
                  "h-14 w-14",
                  verificationOutcome === "ineffective" ? "text-green-600" : "text-gray-500"
                )}
              />
              <span className="text-sm font-bold uppercase tracking-wide">
                INEFFECTIVE
              </span>
            </Button>
          </div>
          <div className="flex gap-4 rounded-lg border border-green-200 bg-green-50 px-5 py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-green-300 bg-green-100 text-green-600">
              <RefreshCw className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-green-800">
                SYSTEM LOGIC
              </p>
              <p className="mt-1 italic leading-relaxed text-green-900/90">
                Step 4 (Corrective Action) Marking as{" "}
                <span className="font-bold not-italic text-green-700">
                  Ineffective
                </span>{" "}
                will automatically route the workflow back to and flag the
                Auditee for a revised root cause analysis and corrective
                action.
              </p>
            </div>
          </div>
        </div>

        {/* Auditor's Verification Comments */}
        <div className="mt-8 space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-900">
            AUDITOR&apos;S VERIFICATION COMMENTS
          </h2>
          <Textarea
            placeholder="Detail the audit evidence used for verification (e.g., site visit on 04-Feb, review of..."
            className="min-h-28 rounded-lg border-gray-200 bg-white"
            rows={4}
            value={auditorComments}
            onChange={(e) => setAuditorComments(e.target.value)}
          />
        </div>

        {/* Revised Risk Severity & Attach Evidence - horizontal */}
        <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:gap-8">
          <div className="min-w-0 flex-1 space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-900">
              REVISED RISK SEVERITY
            </h2>
            <div className="rounded-lg border border-gray-200 bg-gray-100 px-4 py-3 text-base text-gray-800">
              Low (Level 2)
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-900">
              ATTACH EVIDENCE
            </h2>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleEvidenceChange}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 border-gray-200 bg-white py-6 text-gray-700 hover:bg-gray-50 sm:w-auto"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="h-4 w-4 text-gray-600" />
              ATTACH EVIDENCE
            </Button>
            {evidenceFiles.length > 0 && (
              <p className="text-xs text-gray-600">
                {evidenceFiles.length} file(s) selected
              </p>
            )}
          </div>
        </div>

        {/* Verification Audit Trail */}
        <div className="mt-8 space-y-4 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-900">
              VERIFICATION AUDIT TRAIL
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleCopyAuditTrail}
              className="h-8 w-8 shrink-0 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title="Copy audit trail"
              aria-label="Copy audit trail"
            >
              <ClipboardCheck className="h-5 w-5" />
            </Button>
          </div>
          <div className="space-y-0">
            {/* First entry: solid green vertical bar alongside */}
            <div className="border-l-4 border-green-500 pl-4 pb-1">
              <p className="font-semibold text-gray-900">
                Verification Started
              </p>
              <p className="text-sm text-gray-500">
                {isLoading ? "…" : `${leadAuditorDisplay} • ${verificationStartedAt}`}
              </p>
            </div>
            {/* Second entry: dashed light gray vertical bar, pending */}
            <div className="mt-3 border-l-4 border-dashed border-gray-300 pl-4">
              <p className="font-medium text-gray-500">
                Awaiting Final Verification
              </p>
              <p className="text-sm text-gray-400">---</p>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Step navigation */}
      <div className="flex flex-wrap items-center justify-end gap-4 px-2 py-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="border-gray-300 text-gray-700 hover:bg-gray-50"
            disabled={saving || !auditPlanId || !canEditStep5}
            onClick={async () => {
              if (!orgId || !auditPlanId) return;
              setSaving(true);
              try {
                await apiClient.updateAuditPlan(orgId, auditPlanId, {
                  step5Data: {
                    verificationOutcome,
                    auditorComments,
                    evidenceFiles,
                    verificationStartedAt,
                  },
                });
                toast.success("Saved as draft.");
                router.push(`/dashboard/${orgId}/audit`);
              } catch (e) {
                console.error(e);
                toast.error("Failed to save.");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button
            className="bg-green-600 text-white hover:bg-green-700"
            disabled={proceedingToStep6 || !auditPlanId || !canEditStep5}
            onClick={async () => {
              if (!orgId || !auditPlanId) return;
              setProceedingToStep6(true);
              try {
                await apiClient.updateAuditPlan(orgId, auditPlanId, {
                  step5Data: {
                    verificationOutcome,
                    auditorComments,
                    evidenceFiles,
                    verificationStartedAt,
                  },
                });
                await apiClient.updateAuditPlanStatus(orgId, auditPlanId, "pending_closure");
                toast.success("Submitted to Lead Auditor.");
                router.push(`/dashboard/${orgId}/audit/create/6${stepQuery}`);
              } catch (e) {
                console.error(e);
                toast.error("Failed to submit.");
              } finally {
                setProceedingToStep6(false);
              }
            }}
          >
            {proceedingToStep6 ? "Submitting…" : "Submit to Lead Auditor"}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
