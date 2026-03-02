"use client";

import dynamic from "next/dynamic";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { useRef, useState, useEffect, useMemo } from "react";
import { AlertTriangle, Calendar as CalendarIcon, ExternalLink, Info, Paperclip, Save, Send, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import AuditWorkflowHeader from "@/components/audit/AuditWorkflowHeader";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api-client";

import "froala-editor/css/froala_editor.pkgd.min.css";
import "froala-editor/css/froala_style.min.css";

const FroalaEditor = dynamic(() => import("react-froala-wysiwyg"), { ssr: false });

export default function CreateAuditStep4Page() {
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
  const [auditeeDisplay, setAuditeeDisplay] = useState({ name: "—", uin: "—" });
  const [processDisplay, setProcessDisplay] = useState({ name: "—", ref: "—" });
  const [leadAuditorDisplay, setLeadAuditorDisplay] = useState("—");
  const [submissionDate, setSubmissionDate] = useState(format(new Date(), "dd-MM-yyyy"));
  const [submittingToAuditor, setSubmittingToAuditor] = useState(false);
  const [savingStep4, setSavingStep4] = useState(false);

  const [containmentDescription, setContainmentDescription] = useState("");
  const [responsiblePerson, setResponsiblePerson] = useState("");
  const [targetCompletionDate, setTargetCompletionDate] = useState<Date | undefined>(undefined);
  const [rootCauseNarrative, setRootCauseNarrative] = useState("");
  const [similarProcessesImpacted, setSimilarProcessesImpacted] = useState<"yes" | "no" | null>(null);
  const [similarProcessesList, setSimilarProcessesList] = useState("");
  const [rootCauseResult, setRootCauseResult] = useState("");
  const [systemicCorrectiveAction, setSystemicCorrectiveAction] = useState("");
  const [rootCauseAnalysis, setRootCauseAnalysis] = useState("");
  const [correctiveActionPlan, setCorrectiveActionPlan] = useState("");
  const [implementationYesNo, setImplementationYesNo] = useState<"yes" | "no" | null>(null);
  const [implementationDetails, setImplementationDetails] = useState("");
  const [auditeeComments, setAuditeeComments] = useState("");
  const [auditeeName, setAuditeeName] = useState("");
  const [auditeePosition, setAuditeePosition] = useState("");
  const [dateOfReview, setDateOfReview] = useState<Date>(() => new Date());
  const [confirmReviewed, setConfirmReviewed] = useState(false);
  const [riskRatingPostAction, setRiskRatingPostAction] = useState<"high" | "medium" | "low" | null>(null);
  const [riskJustificationPost, setRiskJustificationPost] = useState("");

  const [filesS2, setFilesS2] = useState<{ name: string; key: string }[]>([]);
  const [filesS3, setFilesS3] = useState<{ name: string; key: string }[]>([]);
  const [filesS6, setFilesS6] = useState<{ name: string; key: string }[]>([]);
  const [filesS7, setFilesS7] = useState<{ name: string; key: string }[]>([]);
  const [files41, setFiles41] = useState<{ name: string; key: string }[]>([]);
  const [files42, setFiles42] = useState<{ name: string; key: string }[]>([]);
  const [files43, setFiles43] = useState<{ name: string; key: string }[]>([]);
  const [files45, setFiles45] = useState<{ name: string; key: string }[]>([]);
  const [files46, setFiles46] = useState<{ name: string; key: string }[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!orgId || !auditPlanId) {
      setIsLoading(false);
      setSubmissionDate(format(new Date(), "dd-MM-yyyy"));
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
          setSubmissionDate(plan.datePrepared ? format(new Date(plan.datePrepared), "dd-MM-yyyy") : format(new Date(), "dd-MM-yyyy"));
          setCurrentUserRole(plan.currentUserRole ?? null);
          setPlanStatus(plan.status ?? null);
        }
        const membersRes = await apiClient.getMembers(orgId);
        if (!cancelled && membersRes.teamMembers?.length) {
          const auditee = membersRes.teamMembers.find((m: { id: string }) => m.id === plan.auditeeUserId);
          const auditeeNameVal = auditee ? (auditee.name || auditee.email || "—") : "—";
          setAuditeeDisplay({
            name: auditeeNameVal,
            uin: auditee?.email ?? "—",
          });
          setAuditeeName(auditeeNameVal);
          const lead = membersRes.teamMembers.find((m: { id: string }) => m.id === plan.leadAuditorUserId);
          setLeadAuditorDisplay(lead ? (lead.name || lead.email || "—") : "—");
        }

        if (!cancelled && plan.auditProgramId) {
          const progRes = await apiClient.getAuditProgram(orgId, plan.auditProgramId);
          if (!cancelled && progRes.program) {
            setProcessDisplay({
              name: progRes.program.processName || plan.programName || "—",
              ref: plan.auditNumber || auditPlanId.slice(0, 8) + "...",
            });
          }
        }

        if (!cancelled && plan.step4Data && typeof plan.step4Data === "object") {
          const d = plan.step4Data as Record<string, unknown>;
          if (typeof d.containmentDescription === "string") setContainmentDescription(d.containmentDescription);
          if (typeof d.responsiblePerson === "string") setResponsiblePerson(d.responsiblePerson);
          if (d.targetCompletionDate != null) setTargetCompletionDate(new Date(d.targetCompletionDate as string));
          if (typeof d.rootCauseNarrative === "string") setRootCauseNarrative(d.rootCauseNarrative);
          if (d.similarProcessesImpacted === "yes" || d.similarProcessesImpacted === "no") setSimilarProcessesImpacted(d.similarProcessesImpacted);
          if (typeof d.similarProcessesList === "string") setSimilarProcessesList(d.similarProcessesList);
          if (typeof d.rootCauseResult === "string") setRootCauseResult(d.rootCauseResult);
          if (typeof d.systemicCorrectiveAction === "string") setSystemicCorrectiveAction(d.systemicCorrectiveAction);
          if (typeof d.rootCauseAnalysis === "string") setRootCauseAnalysis(d.rootCauseAnalysis);
          if (typeof d.correctiveActionPlan === "string") setCorrectiveActionPlan(d.correctiveActionPlan);
          if (d.implementationYesNo === "yes" || d.implementationYesNo === "no") setImplementationYesNo(d.implementationYesNo);
          if (typeof d.implementationDetails === "string") setImplementationDetails(d.implementationDetails);
          if (typeof d.auditeeComments === "string") setAuditeeComments(d.auditeeComments);
          if (typeof d.auditeeName === "string") setAuditeeName(d.auditeeName);
          if (typeof d.auditeePosition === "string") setAuditeePosition(d.auditeePosition);
          if (d.dateOfReview != null) setDateOfReview(new Date(d.dateOfReview as string));
          if (typeof d.confirmReviewed === "boolean") setConfirmReviewed(d.confirmReviewed);
          if (d.riskRatingPostAction === "high" || d.riskRatingPostAction === "medium" || d.riskRatingPostAction === "low") setRiskRatingPostAction(d.riskRatingPostAction);
          if (typeof d.riskJustificationPost === "string") setRiskJustificationPost(d.riskJustificationPost);
          const fileList = (x: unknown): { name: string; key: string }[] => (Array.isArray(x) ? x.filter((i): i is { name: string; key: string } => i != null && typeof (i as any).name === "string" && typeof (i as any).key === "string") : []);
          if (Array.isArray(d.filesS2)) setFilesS2(fileList(d.filesS2));
          if (Array.isArray(d.filesS3)) setFilesS3(fileList(d.filesS3));
          if (Array.isArray(d.filesS6)) setFilesS6(fileList(d.filesS6));
          if (Array.isArray(d.filesS7)) setFilesS7(fileList(d.filesS7));
          if (Array.isArray(d.files41)) setFiles41(fileList(d.files41));
          if (Array.isArray(d.files42)) setFiles42(fileList(d.files42));
          if (Array.isArray(d.files43)) setFiles43(fileList(d.files43));
          if (Array.isArray(d.files45)) setFiles45(fileList(d.files45));
          if (Array.isArray(d.files46)) setFiles46(fileList(d.files46));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orgId, auditPlanId]);

  const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
  const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png"];

  const setFilesBySection: Record<string, React.Dispatch<React.SetStateAction<{ name: string; key: string }[]>>> = {
    "s2": setFilesS2,
    "s3": setFilesS3,
    "s6": setFilesS6,
    "s7": setFilesS7,
    "41": setFiles41,
    "42": setFiles42,
    "43": setFiles43,
    "45": setFiles45,
    "46": setFiles46,
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, section: string) => {
    const files = e.target.files;
    if (!files?.length || !orgId) return;
    const setFiles = setFilesBySection[section];
    if (!setFiles) return;
    const planId = auditPlanId || "draft";
    setUploadingFile(true);
    try {
      const uploaded: { name: string; key: string }[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!ALLOWED_TYPES.includes(file.type) || file.size > MAX_FILE_SIZE) continue;
        const res = await apiClient.uploadAuditDocument(file, orgId, planId, 4);
        uploaded.push({ name: res.name, key: res.key });
      }
      setFiles((prev) => [...prev, ...uploaded]);
    } catch (err) {
      console.error(err);
    } finally {
      setUploadingFile(false);
      e.target.value = "";
    }
  };

  const buildStep4Payload = () => ({
    containmentDescription,
    responsiblePerson,
    targetCompletionDate: targetCompletionDate ? targetCompletionDate.toISOString() : null,
    rootCauseNarrative,
    similarProcessesImpacted,
    similarProcessesList,
    rootCauseResult,
    systemicCorrectiveAction,
    rootCauseAnalysis,
    correctiveActionPlan,
    implementationYesNo,
    implementationDetails,
    auditeeComments,
    auditeeName,
    auditeePosition,
    dateOfReview: dateOfReview.toISOString(),
    confirmReviewed,
    riskRatingPostAction,
    riskJustificationPost,
    filesS2,
    filesS3,
    filesS6,
    filesS7,
    files41,
    files42,
    files43,
    files45,
    files46,
  });

  const handleSaveStep4 = async () => {
    if (!orgId || !auditPlanId) return;
    setSavingStep4(true);
    try {
      await apiClient.saveAuditPlanStep4(orgId, auditPlanId, buildStep4Payload());
    } catch (e) {
      console.error(e);
    } finally {
      setSavingStep4(false);
    }
  };

  const AttachFileBlock = ({ section, files }: { section: string; files: { name: string; key: string }[] }) => (
    <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-6">
      <input
        ref={(el) => { fileInputRefs.current[section] = el; }}
        type="file"
        accept=".jpg,.jpeg,.png,image/jpeg,image/jpg,image/png"
        multiple
        className="hidden"
        onChange={(e) => handleFileChange(e, section)}
      />
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
          <Paperclip className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-bold uppercase tracking-wide text-gray-900">ATTACH FILE</h3>
        <p className="text-xs text-gray-500">Drag & drop your file here, or click to browse</p>
        {files.length > 0 && <p className="text-xs text-gray-600">{files.length} file(s) attached</p>}
        <Button
          type="button"
          variant="outline"
          disabled={uploadingFile}
          onClick={() => fileInputRefs.current[section]?.click()}
          className="rounded-lg border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          UPLOAD FILE
        </Button>
      </div>
    </div>
  );

  const canEditStep4 =
    planStatus !== "closed" && currentUserRole === "auditee";

  const lockedSteps = useMemo(() => {
    if (!planStatus || !currentUserRole) return [];
    const locked: number[] = [];
    if (currentUserRole === "lead_auditor" && !["pending_closure", "closed"].includes(planStatus)) locked.push(6);
    if (currentUserRole === "assigned_auditor" && !["ca_submitted_to_auditor", "pending_closure", "closed"].includes(planStatus)) locked.push(5);
    return locked;
  }, [planStatus, currentUserRole]);

  return (
    <div className="space-y-6">
      <AuditWorkflowHeader currentStep={4} orgId={orgId} allowedSteps={[1, 2, 3, 4, 5, 6]} lockedSteps={lockedSteps} stepQuery={stepQuery || undefined} exitHref="../.." />
      {!canEditStep4 && currentUserRole != null && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          {planStatus === "closed"
            ? "View only — this audit is complete; no edits allowed."
            : "View only — only the Auditee can edit this step."}
        </div>
      )}
      <div className={canEditStep4 ? "" : "pointer-events-none select-none opacity-90"} style={canEditStep4 ? undefined : { minHeight: "200px" }}>
      <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-red-600">
          TO BE RESPONDED BY THE AUDITEE
        </p>
        <h1 className="mt-2 text-xl font-bold uppercase tracking-wide text-gray-900">
          SYSTEMIC CORRECTIVE ACTION
        </h1>

        {/* Blue info banner */}
        <div className="mt-6 flex items-center gap-4 rounded-lg border border-blue-200 bg-blue-50 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blue-300 bg-blue-100 text-blue-600">
            <Info className="h-5 w-5" />
          </div>
          <p className="min-w-0 flex-1 text-sm text-blue-900">
            Don&apos;t Just Fix The Mistake- Fix The System So The Mistake Can&apos;t Happen Again!
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 rounded-lg border-blue-700 bg-blue-700 text-white hover:bg-blue-800 hover:text-white"
          >
            Learn More
            <ExternalLink className="ml-1.5 h-4 w-4" />
          </Button>
        </div>

        {/* Yellow Systemic Prevention guideline box */}
        <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50/90 px-5 py-4">
          <p className="text-sm font-bold leading-snug text-amber-900">
            SYSTEMIC PREVENTION (SYSTEMIC CORRECTIVE ACTION) MEANS FIXING A PROBLEM AT ITS ROOT CAUSE, NOT JUST PATCHING THE SYMPTOM, SO IT DOESN&apos;T HAPPEN AGAIN ANYWHERE IN THE SYSTEM
          </p>
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-amber-800">It focus on:</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-amber-900/90">
                <li>Removing the real underlying cause of a nonconformity</li>
                <li>Preventing the issue from recurring</li>
                <li>Improving the overall management system</li>
                <li>Aligning actions with long-term system goals</li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Action must be SMART:</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-amber-900/90">
                <li><span className="font-semibold">Specific</span> - Clearly target the exact issue</li>
                <li><span className="font-semibold">Measurable</span> - Evidence shows it&apos;s fixed</li>
                <li><span className="font-semibold">Achievable</span> - Realistic with available resources</li>
                <li><span className="font-semibold">Relevant</span> - Directly linked to audit findings and risks</li>
                <li><span className="font-semibold">Time-bound</span> - Completed within agreed deadlines</li>
              </ul>
            </div>
          </div>
        </div>

        {/* S1 Containment */}
        <h2 className="mt-8 text-lg font-bold uppercase tracking-wide text-gray-900">
          *S1 CONTAINMENT <span className="text-blue-600">(STOP THE &apos;BLEEDING&apos; IMMEDIATELY!)</span>
        </h2>
        <div className="mt-4 flex gap-4 rounded-lg border border-blue-200 bg-blue-50 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blue-300 bg-blue-100 text-blue-600">
            <Info className="h-5 w-5" />
          </div>
          <p className="min-w-0 flex-1 text-sm leading-relaxed text-blue-900">
            Stop The Bleeding Immediately. Implement Containment Actions With Defined Timelines And Responsible Parties To Control The Issue And Prevent Further Impact Until A Permanent Solution Is Implemented. This Approach Is Typical For *Minor Nonconformities. Major Nonconformities Require Systematic Corrective Actions, Timelines, And Responsible Parties.
          </p>
        </div>
        <div className="mt-4 space-y-2">
          <Label className="text-sm font-medium uppercase tracking-wide text-gray-600">
            CONTAINMENT ACTION DESCRIPTION
          </Label>
          <Textarea
            placeholder="Describe the immediate actions taken to contain the nonconformity..."
            className="min-h-24 rounded-lg border-gray-300"
            rows={4}
            value={containmentDescription}
            onChange={(e) => setContainmentDescription(e.target.value)}
          />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-sm font-medium uppercase tracking-wide text-gray-600">
              RESPONSIBLE PERSON
            </Label>
            <Input
              placeholder="Full Name / Job Title"
              className="rounded-lg border-gray-300"
              value={responsiblePerson}
              onChange={(e) => setResponsiblePerson(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium uppercase tracking-wide text-gray-600">
              TARGET COMPLETION DATE
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start rounded-lg border-gray-300 text-left font-normal",
                    !targetCompletionDate && "text-gray-500"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {targetCompletionDate ? format(targetCompletionDate, "dd-MM-yyyy") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={targetCompletionDate}
                  onSelect={setTargetCompletionDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* S2 Evidence of S1 */}
        <h2 className="mt-8 text-lg font-bold uppercase tracking-wide text-gray-900">
          *S2 EVIDENCE OF S1{" "}
          <span className="text-blue-600">(PROVE YOU STOPPED IT!)</span>
        </h2>
        <div className="mt-4 flex gap-4 rounded-lg border border-blue-200 bg-blue-50 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blue-300 bg-blue-100 text-blue-600">
            <Info className="h-5 w-5" />
          </div>
          <p className="min-w-0 flex-1 text-sm leading-relaxed text-gray-700">
            The Underlying Reason For An Issue, Identified Through Analysis To Ensure A Permanent Solution And Prevent Recurrence. Auditors May Use Methods Like 5 Whys, Fishbone Diagram (Ishikawa), Pareto Analysis, Or FMEA.
          </p>
        </div>
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50/80 p-6">
          <input
            ref={(el) => { fileInputRefs.current["s2"] = el; }}
            type="file"
            accept=".jpg,.jpeg,.png,image/jpeg,image/jpg,image/png"
            multiple
            className="hidden"
            onChange={(e) => handleFileChange(e, "s2")}
          />
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
              <Paperclip className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-gray-900">ATTACH FILE</h3>
            <p className="text-xs text-gray-500">ALLOWED: JPG / JPEG / PNG • MAX SIZE: 2 MB</p>
            {filesS2.length > 0 && <p className="text-xs text-gray-600">{filesS2.length} file(s) selected</p>}
            <Button
              type="button"
              variant="outline"
              disabled={uploadingFile}
              onClick={() => fileInputRefs.current["s2"]?.click()}
              className="rounded-lg border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              BROWSE FILES
            </Button>
          </div>
        </div>

        {/* S3 Root Cause Analysis (RCA) */}
        <h2 className="mt-8 text-lg font-bold uppercase tracking-wide text-gray-900">
          S3 ROOT CAUSE ANALYSIS (RCA){" "}
          <span className="text-blue-600">(THE &apos;DEEP DIVE&apos; USING 5-WHY OR FISHBONE!)</span>
        </h2>
        <div className="mt-4 flex gap-4 rounded-lg border border-gray-200 bg-gray-50 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blue-300 bg-blue-100 text-blue-600">
            <Info className="h-5 w-5" />
          </div>
          <p className="min-w-0 flex-1 text-sm leading-relaxed text-gray-700">
            Root Cause Analysis (RCA) Identifies The Underlying Reason For A Problem To Ensure A Permanent Solution And Prevent Recurrence. Methods Like 5 Whys, Fishbone Diagram (Ishikawa), Pareto Analysis, Or FMEA Can Be Used. RCA Is Required For Corrective And Preventive Issues, Optional For Suggestions For Improvement, And Recommended For In-Depth Research Of Major Nonconformities.
          </p>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <FroalaEditor
            tag="textarea"
            model={rootCauseNarrative}
            onModelChange={setRootCauseNarrative}
            config={{
              heightMin: 180,
              placeholderText: "Enter the comprehensive root cause analysis narrative...",
              charCounterCount: true,
              imageUploadURL: orgId && auditPlanId
                ? `/api/files/audit-upload?orgId=${encodeURIComponent(orgId)}&auditPlanId=${encodeURIComponent(auditPlanId)}&step=4`
                : "/api/files/froala/upload",
              imageUploadMethod: "POST",
              imageAllowedTypes: ["jpeg", "jpg", "png", "webp"],
              imageMaxSize: 5 * 1024 * 1024,
            }}
          />
        </div>

        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50/80 p-6">
          <input
            ref={(el) => { fileInputRefs.current["s3"] = el; }}
            type="file"
            accept=".jpg,.jpeg,.png,image/jpeg,image/jpg,image/png"
            multiple
            className="hidden"
            onChange={(e) => handleFileChange(e, "s3")}
          />
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
              <Paperclip className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-gray-900">ATTACH FILE</h3>
            <p className="text-xs text-gray-500">ALLOWED: JPG / JPEG / PNG • MAX SIZE: 2 MB</p>
            {filesS3.length > 0 && <p className="text-xs text-gray-600">{filesS3.length} file(s) selected</p>}
            <Button
              type="button"
              variant="outline"
              disabled={uploadingFile}
              onClick={() => fileInputRefs.current["s3"]?.click()}
              className="rounded-lg border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              BROWSE FILES
            </Button>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-900">SIMILAR PROCESSES IMPACTED (IF ANY):</h3>
          <div className="flex gap-4 rounded-lg border border-gray-200 bg-gray-50 px-5 py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blue-300 bg-blue-100 text-blue-600">
              <Info className="h-5 w-5" />
            </div>
            <p className="min-w-0 flex-1 text-sm leading-relaxed text-gray-700">
              Are There Any Processes That Are Affected? Please Answer Either Yes Or No. If The Answer Is Yes, Please Provide A List Of All The Processes That Are Affected, Making Sure To Include All Relevant Processes In The List.
            </p>
          </div>
          <div className="flex flex-wrap gap-6">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="similarProcesses"
                checked={similarProcessesImpacted === "yes"}
                onChange={() => setSimilarProcessesImpacted("yes")}
                className="h-4 w-4 border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm font-bold text-gray-900">YES</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="similarProcesses"
                checked={similarProcessesImpacted === "no"}
                onChange={() => setSimilarProcessesImpacted("no")}
                className="h-4 w-4 border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm font-bold text-gray-900">NO</span>
            </label>
          </div>
          <Textarea
            placeholder="Include all relevant processes...."
            className="min-h-24 rounded-lg border-gray-300"
            rows={4}
            value={similarProcessesList}
            onChange={(e) => setSimilarProcessesList(e.target.value)}
          />
        </div>

        {/* S4 Root Cause Result */}
        <h2 className="mt-8 text-lg font-bold uppercase tracking-wide text-gray-900">
          S4 ROOT CAUSE RESULT{" "}
          <span className="text-base font-normal normal-case text-blue-600">(CLEAR STATEMENT OF THE &apos;SYSTEMIC FAILURE&apos;!)</span>
        </h2>
        <div className="mt-4 flex gap-4 rounded-lg border border-gray-200 bg-gray-50 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blue-300 bg-blue-100 text-blue-600">
            <Info className="h-5 w-5" />
          </div>
          <p className="min-w-0 flex-1 text-sm leading-relaxed text-gray-700">
            Root Cause Result- Systemic Failure: A Weakness In Process Control And Lack Of Awareness Led To The Nonconformity. Corrective Actions Were Implemented To Close The Control Gap And Improve Awareness. Post-Implementation Results Show Improved Compliance And No Recurrence Of The Issue. If You&apos;d Like It Even Shorter (Executive-Summary Style), I Can Compress It Further.
          </p>
        </div>
        <div className="mt-4">
          <Textarea
            placeholder="Provide the multiline narrative result of the corrective action implementation..."
            className="min-h-32 rounded-lg border-gray-300"
            rows={6}
            value={rootCauseResult}
            onChange={(e) => setRootCauseResult(e.target.value)}
          />
        </div>

        {/* S5 Systemic Corrective Action */}
        <h2 className="mt-8 text-lg font-bold uppercase tracking-wide text-gray-900">
          S5 SYSTEMIC CORRECTIVE ACTION{" "}
          <span className="text-base font-normal normal-case text-blue-600">(CHANGE THE PROCESS, PROCEDURE, CONTROL PLAN, AND FLOWCHART!)</span>
        </h2>
        <div className="mt-4 flex gap-4 rounded-lg border border-gray-200 bg-gray-50 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blue-300 bg-blue-100 text-blue-600">
            <Info className="h-5 w-5" />
          </div>
          <p className="min-w-0 flex-1 text-sm leading-relaxed text-gray-700">
            Systemic Corrective Actions Included Revising The Underlying Process To Address Root Causes. Updated Procedures, Control Plans, And Flowcharts Strengthen Controls, Clarify Responsibilities, And Ensure Consistent Implementation. Defined KPIs, Internal Audits, And Management Reviews Monitor Effectiveness To Prevent Recurrence.
          </p>
        </div>
        <div className="mt-4">
          <Textarea
            placeholder="Provide the multiline narrative result of the corrective action implementation..."
            className="min-h-32 rounded-lg border-gray-300"
            rows={6}
            value={systemicCorrectiveAction}
            onChange={(e) => setSystemicCorrectiveAction(e.target.value)}
          />
        </div>

        {/* S6 Evidence of Implementation S5 */}
        <h2 className="mt-8 text-lg font-bold uppercase tracking-wide text-gray-900">
          S6 EVIDENCE OF IMPLEMENTATION S5{" "}
          <span className="text-blue-600">(PROVE THE PROCESS CHANGED!)</span>
        </h2>
        <div className="mt-4 flex gap-4 rounded-lg border border-gray-200 bg-gray-50 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blue-300 bg-blue-100 text-blue-600">
            <Info className="h-5 w-5" />
          </div>
          <p className="min-w-0 flex-1 text-sm leading-relaxed text-gray-700">
            Implementation Evidence Should Demonstrate Process Changes And Sustained Compliance. Examples Include Revised Documentation, Training Records, Implementation Photos Or System Logs, And Monitoring Results. Physical Changes E.G., High-Resolution &quot;Before&quot; And &quot;After&quot; Photos Of New Signage, Shadow Boards, Or Poka-Yoke Sensors.
          </p>
        </div>
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50/80 p-6">
          <input
            ref={(el) => { fileInputRefs.current["s6"] = el; }}
            type="file"
            accept=".jpg,.jpeg,.png,image/jpeg,image/jpg,image/png"
            multiple
            className="hidden"
            onChange={(e) => handleFileChange(e, "s6")}
          />
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
              <Paperclip className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-gray-900">ATTACH FILE</h3>
            <p className="text-xs text-gray-500">ALLOWED: JPG / JPEG / PNG • MAX SIZE: 2 MB</p>
            {filesS6.length > 0 && <p className="text-xs text-gray-600">{filesS6.length} file(s) selected</p>}
            <Button
              type="button"
              variant="outline"
              disabled={uploadingFile}
              onClick={() => fileInputRefs.current["s6"]?.click()}
              className="rounded-lg border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              BROWSE FILES
            </Button>
          </div>
        </div>

        {/* S7 Verification */}
        <h2 className="mt-8 text-lg font-bold uppercase tracking-wide text-gray-900">
          S7 VERIFICATION ()
        </h2>
        <div className="mt-4 flex gap-4 rounded-lg border border-blue-200 bg-blue-50 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blue-300 bg-blue-100 text-blue-600">
            <Info className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-2 text-sm leading-relaxed text-blue-900">
            <p className="font-medium">
              Objective Evidence That The Corrective Action Actually Eliminated The Root Cause And Remains Effective Over Time.
            </p>
            <p>
              It Requires: Data-Based Proof (E.G., KPI Trends, Defect Rates, Scrap, Customer Complaints), Sustained Performance Over 1-3 Months (Or Defined Production Volume), Confirmation That The Issue Has Not Recurred, Documented Results Or, If Still Within Monitoring Period, A Clear Validation Plan.
            </p>
          </div>
        </div>
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50/80 p-6">
          <input
            ref={(el) => { fileInputRefs.current["s7"] = el; }}
            type="file"
            accept=".jpg,.jpeg,.png,image/jpeg,image/jpg,image/png"
            multiple
            className="hidden"
            onChange={(e) => handleFileChange(e, "s7")}
          />
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
              <Paperclip className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-gray-900">ATTACH FILE</h3>
            <p className="text-xs text-gray-500">ALLOWED: JPG / JPEG / PNG • MAX SIZE: 2 MB</p>
            {filesS7.length > 0 && <p className="text-xs text-gray-600">{filesS7.length} file(s) selected</p>}
            <Button
              type="button"
              variant="outline"
              disabled={uploadingFile}
              onClick={() => fileInputRefs.current["s7"]?.click()}
              className="rounded-lg border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              BROWSE FILES
            </Button>
          </div>
        </div>

        {/* Risk Severity (Review) */}
        <div className="mt-8 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-900">RISK SEVERITY (REVIEW):</h3>
          <div className="flex gap-4 rounded-lg border border-blue-200 bg-blue-50 px-5 py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blue-300 bg-blue-100 text-blue-600">
              <Info className="h-5 w-5" />
            </div>
            <p className="min-w-0 flex-1 text-sm leading-relaxed text-blue-900">
              Following Corrective Actions And Root Cause Analysis, The Auditee Should Review Risk Severity To Reflect The Potential Impact And Likelihood Of Nonconformity, Guiding Prioritization, Escalation, And Follow-Up.
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            {(["high", "medium", "low"] as const).map((level) => (
              <label
                key={level}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border-2 px-6 py-2.5 text-sm font-bold uppercase tracking-wide transition-colors",
                  riskRatingPostAction === level
                    ? level === "high"
                      ? "border-red-500 bg-red-50 text-red-700"
                      : level === "medium"
                        ? "border-green-500 bg-green-50 text-green-700"
                        : "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                )}
              >
                <input
                  type="radio"
                  name="riskSeverityReview"
                  checked={riskRatingPostAction === level}
                  onChange={() => setRiskRatingPostAction(level)}
                  className="sr-only"
                />
                {level}
              </label>
            ))}
          </div>
        </div>

        {/* Auditee Comments (Mandatory) */}
        <div className="mt-8 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-900">AUDITEE COMMENTS (MANDATORY)</h3>
          <Textarea
            placeholder="Final auditee observations regarding the CA effectiveness and risk mitigation..."
            className="min-h-32 rounded-lg border-gray-300"
            rows={6}
            value={auditeeComments}
            onChange={(e) => setAuditeeComments(e.target.value)}
          />
        </div>

        {/* Risk Evaluation Guideline */}
        <div className="relative mt-8 overflow-hidden rounded-xl bg-slate-800 px-6 py-6 text-white shadow-lg">
          <h2 className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-green-400">
            <ShieldCheck className="h-5 w-5" />
            RISK EVALUATION GUIDELINE
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div>
              <p className="font-bold text-red-400">HIGH SEVERITY</p>
              <p className="mt-1 text-sm text-slate-300">Direct impact on product safety, regulatory compliance, or system-wide failure. Requires immediate containment.</p>
            </div>
            <div>
              <p className="font-bold text-amber-400">MEDIUM SEVERITY</p>
              <p className="mt-1 text-sm text-slate-300">Partial failure of core process. May impact customer satisfaction or operational efficiency if not addressed.</p>
            </div>
            <div>
              <p className="font-bold text-blue-400">LOW SEVERITY</p>
              <p className="mt-1 text-sm text-slate-300">Isolated administrative error or minor process deviation. Negligible impact on quality or safety.</p>
            </div>
          </div>
        </div>

        {/* Audit Details and Actions */}
        <div className="relative mt-6 overflow-hidden rounded-xl border-t-4 border-green-500/50 bg-slate-800 px-6 py-6 text-white shadow-lg">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-green-400">AUDITEE NAME & UIN</p>
                <p className="mt-1 font-bold text-white">{isLoading ? "…" : auditeeDisplay.name}</p>
                <p className="text-sm text-slate-300">{isLoading ? "…" : auditeeDisplay.uin}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-green-400">PROCESS</p>
                <p className="mt-1 font-bold text-white">{isLoading ? "…" : processDisplay.name}</p>
                <p className="text-sm text-slate-300">{isLoading ? "…" : processDisplay.ref}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-green-400">DATE</p>
                <p className="mt-1 font-bold text-white">{submissionDate}</p>
                <p className="text-sm text-slate-300">AUTOMATED LOG</p>
              </div>
            </div>
            <div className="rounded-lg border border-dashed border-slate-500 bg-slate-700/50 px-4 py-3 text-right sm:shrink-0">
              <p className="text-xs font-bold uppercase tracking-wide text-white">VALIDATION NOTE</p>
              <p className="mt-1 text-xs text-slate-400">This document is valid without a signature</p>
            </div>
          </div>
          <div className="mt-6 border-t border-slate-600 pt-6">
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Button
                type="button"
                variant="outline"
                disabled={savingStep4 || !auditPlanId}
                onClick={handleSaveStep4}
                className="inline-flex items-center gap-2 rounded-lg border-2 border-green-500 bg-transparent px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-slate-700 hover:text-white"
              >
                <Save className="h-4 w-4" />
                {savingStep4 ? "Saving…" : "SAVE"}
              </Button>
              <Button
                type="button"
                disabled={submittingToAuditor || !auditPlanId}
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-green-500"
              onClick={async () => {
                if (!orgId || !auditPlanId) return;
                setSubmittingToAuditor(true);
                try {
                  await apiClient.updateAuditPlanStatus(orgId, auditPlanId, "ca_submitted_to_auditor");
                  router.push(`/dashboard/${orgId}/audit/create/5${stepQuery}`);
                } catch (e) {
                  console.error(e);
                } finally {
                  setSubmittingToAuditor(false);
                }
              }}
              >
                <Send className="h-4 w-4" />
                {submittingToAuditor ? "Submitting…" : "SUBMIT TO AUDITOR"}
              </Button>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
