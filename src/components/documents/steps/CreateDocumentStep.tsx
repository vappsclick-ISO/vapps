"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Calendar,
  CircleAlert,
  Lock,
  Paperclip,
  RefreshCw,
  Save,
  Search,
  Send,
  Unlock,
} from "lucide-react";

const TRANSFER_SITE_OPTIONS = ["S1", "S2", "S3", "S4", "S5", "S6"] as const;
const TRANSFER_PROCESS_OPTIONS = ["P1", "P2", "P3", "P4", "P5", "P6"] as const;

function managementStandardLabel(value: string): string {
  switch (value) {
    case "iso-9001":
      return "ISO 9001";
    case "iso-14001":
      return "ISO 14001";
    case "iso-45001":
      return "ISO 45001";
    case "integrated":
      return "Integrated Management System";
    default:
      return "ISO 9001";
  }
}

function classificationTypeLabel(c: "P" | "F" | "EXT"): string {
  if (c === "P") return "P — Maintained Doc";
  if (c === "F") return "F — Retained Record";
  return "EXT — External Doc";
}

function limitToWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ");
}

function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

type CreateDocumentStepProps = {
  title: string;
  setTitle: (value: string) => void;
  docType: string;
  setDocType: (value: string) => void;
  site: string;
  setSite: (value: string) => void;
  processName: string;
  setProcessName: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  onNext: () => void;
};

export default function CreateDocumentStep({
  title,
  setTitle,
  docType,
  setDocType,
  site,
  setSite,
  processName,
  setProcessName,
  description,
  setDescription,
  onNext,
}: CreateDocumentStepProps) {
  const [loginUserName, setLoginUserName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [organizationIdentification, setOrganizationIdentification] = useState("");
  const [industryType, setIndustryType] = useState("");
  const [otherIndustry, setOtherIndustry] = useState("");
  const [siteId, setSiteId] = useState("");
  const [location, setLocation] = useState("");
  const [processId, setProcessId] = useState("");
  const [processOwner, setProcessOwner] = useState("");
  const [previousRefNumber, setPreviousRefNumber] = useState("");
  const [priorityLevel, setPriorityLevel] = useState<"high" | "low">("high");
  const [documentClassification, setDocumentClassification] = useState<"P" | "F" | "EXT">("P");
  const [actionType, setActionType] = useState<"create" | "revise" | "obsolete">("create");
  const [reviseSubAction, setReviseSubAction] = useState<"update" | "transfer">("update");
  const [searchCurrentDocumentRef, setSearchCurrentDocumentRef] = useState("");
  const [revisionComment, setRevisionComment] = useState("");
  const [documentEditorContent, setDocumentEditorContent] = useState("");
  const [externalDocumentFileName, setExternalDocumentFileName] = useState("");
  const [managementStandard, setManagementStandard] = useState("");
  const [clause, setClause] = useState("");
  const [subClause, setSubClause] = useState("");
  const [restriction, setRestriction] = useState<"unlocked" | "locked">("unlocked");
  const [accessScope, setAccessScope] = useState("department-only");
  const [reasons, setReasons] = useState<string[]>([]);
  const [reasonComment, setReasonComment] = useState("");
  const [affectsOtherDocs, setAffectsOtherDocs] = useState<"yes" | "no">("no");
  const [riskLevel, setRiskLevel] = useState<"high" | "medium" | "low">("low");
  const [riskComments, setRiskComments] = useState("");
  const [trainingRequired, setTrainingRequired] = useState<"yes" | "no">("no");
  const [trainingDetails, setTrainingDetails] = useState("");
  const [planDate, setPlanDate] = useState("");
  const [actualDate, setActualDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [transferSearchRef, setTransferSearchRef] = useState("");
  const [transferTargetSite, setTransferTargetSite] = useState("S1");
  const [transferTargetProcess, setTransferTargetProcess] = useState("P1");
  const [transferStandardChange, setTransferStandardChange] = useState("");
  const [transferDocumentClass, setTransferDocumentClass] = useState<"P" | "F" | "EXT">("P");
  const [transferInitiatorRequest, setTransferInitiatorRequest] = useState("");
  const [originatorConsent, setOriginatorConsent] = useState<"accepted" | "declined" | null>(null);

  const reasonOptions = [
    "4M Change",
    "External Audit Findings",
    "ISO Standard Requirements",
    "New Equipment Purchased",
    "Process Efficiency",
    "Customer Requirement",
    "Internal Audit Findings",
    "Organizational Requirements",
    "New Service Acquired",
    "Other",
  ];

  const toggleReason = (reason: string) => {
    setReasons((prev) =>
      prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason]
    );
  };

  const isReviseUpdate = actionType === "revise" && reviseSubAction === "update";
  const isReviseTransfer = actionType === "revise" && reviseSubAction === "transfer";

  const currentSiteDisplay = site.trim() || "S1";
  const currentProcessDisplay = processId.trim() || "P1";

  const previewDocRef = (() => {
    if (isReviseUpdate && searchCurrentDocumentRef.trim()) {
      return `${searchCurrentDocumentRef.trim()} → v2`;
    }
    if (isReviseTransfer) {
      const y = new Date().getFullYear();
      const cls = transferDocumentClass;
      const docSeg = cls === "EXT" ? "EXT" : docType;
      return `Doc/${y}/${transferTargetSite}/${transferTargetProcess}/${cls}/${docSeg}/v1`;
    }
    return `Doc/${new Date().getFullYear()}/${site || "S1"}/${processId || "P1"}/${documentClassification}/${docType}/v1`;
  })();

  const flowTitle =
    actionType === "create" ? "Create" : actionType === "revise" ? "Revise" : "Obsolete";

  return (
    <>
      <Card className="py-4">
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-3xl font-semibold text-[#0A0A0A]">{flowTitle}</h3>
            <p className="text-sm text-[#6A7282]">Start Procedure(P) or Form(F)!</p>
          </div>

          <div className="space-y-1 pt-2">
            <h4 className="text-xl font-semibold text-[#0A0A0A]">1. Identity Information</h4>
            <p className="text-sm text-[#6A7282]">Auto-generated and basic organizational data</p>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <h5 className="text-lg font-semibold text-[#0A0A0A]">User Information</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="login-user-name">Name (Login User)</Label>
                  <Input
                    id="login-user-name"
                    value={loginUserName}
                    onChange={(e) => setLoginUserName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="organization-name">Organization Name</Label>
                  <Input
                    id="organization-name"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    placeholder="Organization name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="organization-identification">Organization Identification</Label>
                  <Input
                    id="organization-identification"
                    value={organizationIdentification}
                    onChange={(e) => setOrganizationIdentification(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="industry-type">Industry Type (NAICS Code)</Label>
                  <Input
                    id="industry-type"
                    value={industryType}
                    onChange={(e) => setIndustryType(e.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="other-industry">Other Industry (if applicable)</Label>
                  <Input
                    id="other-industry"
                    value={otherIndustry}
                    onChange={(e) => setOtherIndustry(e.target.value)}
                    placeholder="Specify if other..."
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-[#E5E7EB]" />

            <div className="space-y-3">
              <h5 className="text-lg font-semibold text-[#0A0A0A]">Site Information</h5>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="doc-site">Site / Unit *</Label>
                  <Input
                    id="doc-site"
                    value={site}
                    onChange={(e) => setSite(e.target.value)}
                    placeholder="e.g., S1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="site-id">Site ID</Label>
                  <Input
                    id="site-id"
                    value={siteId}
                    onChange={(e) => setSiteId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location (factory / office)</Label>
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g., Main Factory"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-[#E5E7EB]" />

            <div className="space-y-3">
              <h5 className="text-lg font-semibold text-[#0A0A0A]">Process Area</h5>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="doc-process">Process / Area *</Label>
                  <Input
                    id="doc-process"
                    value={processName}
                    onChange={(e) => setProcessName(e.target.value)}
                    placeholder="e.g., Quality Control"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="process-id">Process ID</Label>
                  <Input
                    id="process-id"
                    value={processId}
                    onChange={(e) => setProcessId(e.target.value)}
                    placeholder="e.g., P1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="process-owner">Process Owner *</Label>
                  <Input
                    id="process-owner"
                    value={processOwner}
                    onChange={(e) => setProcessOwner(e.target.value)}
                    placeholder="e.g., Quality Manager"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-[#E5E7EB]" />

            {!isReviseUpdate && !isReviseTransfer ? (
              <>
                <div className="space-y-3">
                  <h5 className="text-lg font-semibold text-[#0A0A0A]">Previous Document Reference</h5>
                  <div className="space-y-2">
                    <Label htmlFor="previous-ref">Old Reference Number (if any)</Label>
                    <Input
                      id="previous-ref"
                      value={previousRefNumber}
                      onChange={(e) => setPreviousRefNumber(e.target.value)}
                      placeholder="e.g., Doc/2024/S1/P2/P/D1/v1"
                    />
                    <p className="text-xs text-[#6A7282]">
                      Enter previous document reference if this is a revision
                    </p>
                  </div>
                </div>

                <div className="border-t border-[#E5E7EB]" />
              </>
            ) : null}


            <div className="space-y-3">
              <h5 className="text-lg font-semibold text-[#0A0A0A]">Document Details</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Document Type</Label>
                  <Select value={docType} onValueChange={setDocType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="P">Type P (Maintained Document)</SelectItem>
                      <SelectItem value="F">Type F (Retained Record)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="doc-description">Description</Label>
                  <Textarea
                    id="doc-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Write document scope..."
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Second card under Step 1: Change Request */}
      <Card className="py-4">
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <h4 className="text-xl font-semibold text-[#0A0A0A]">2. Change Request</h4>
            <p className="text-sm text-[#6A7282]">Document priority level</p>
          </div>

          <RadioGroup
            value={priorityLevel}
            onValueChange={(v) => setPriorityLevel(v as "high" | "low")}
            className="space-y-3"
          >
            <Label
              htmlFor="priority-high"
              className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer font-normal ${
                priorityLevel === "high"
                  ? "border-[#22B323] bg-[#EAF6EC]"
                  : "border-[#E5E7EB]"
              }`}
            >
              <RadioGroupItem value="high" id="priority-high" className="mt-1" />
              <div>
                <p className="font-semibold text-[#0A0A0A]">High (Strategic Documents)</p>
                <p className="text-sm text-[#6A7282]">
                  Policy, Manual, Procedure, SOP, Governance documents
                </p>
              </div>
            </Label>

            <Label
              htmlFor="priority-low"
              className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer font-normal ${
                priorityLevel === "low"
                  ? "border-[#22B323] bg-[#EAF6EC]"
                  : "border-[#E5E7EB]"
              }`}
            >
              <RadioGroupItem value="low" id="priority-low" className="mt-1" />
              <div>
                <p className="font-semibold text-[#0A0A0A]">Low (Operational Records)</p>
                <p className="text-sm text-[#6A7282]">Forms, Checklists, Logs, Templates</p>
              </div>
            </Label>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Third card under Step 1: Document Type */}
      <Card className="py-4">
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <h4 className="text-xl font-semibold text-[#0A0A0A]">3. Document Type</h4>
            <p className="text-sm text-[#6A7282]">Select document classification</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { value: "P" as const, title: "P", subtitle: "Maintained Doc" },
              { value: "F" as const, title: "F", subtitle: "Retained Record" },
              { value: "EXT" as const, title: "EXT", subtitle: "External Doc" },
            ].map((item) => {
              const isActive = documentClassification === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    setDocumentClassification(item.value);
                    if (item.value === "P" || item.value === "F") {
                      setDocType(item.value);
                    }
                    if (item.value !== "EXT") {
                      setExternalDocumentFileName("");
                    }
                  }}
                  className={`rounded-lg border p-4 text-center transition-colors ${isActive
                      ? "border-[#22B323] bg-[#EAF6EC]"
                      : "border-[#E5E7EB] bg-white hover:bg-[#F9FAFB]"
                    }`}
                >
                  <p
                    className={`font-semibold ${isActive ? "text-[#22B323]" : "text-[#6A7282]"
                      }`}
                  >
                    {item.title}
                  </p>
                  <p
                    className={`text-sm mt-1 ${isActive ? "text-[#22B323]" : "text-[#6A7282]"
                      }`}
                  >
                    {item.subtitle}
                  </p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Fourth card under Step 1: Action Selection */}
      <Card className="py-4">
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <h4 className="text-xl font-semibold text-[#0A0A0A]">4. Action Selection</h4>
            <p className="text-sm text-[#6A7282]">Select one action only (mutually exclusive)</p>
          </div>

          <div className="space-y-2">
            <Label>Action Type*</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { value: "create" as const, label: "Create" },
                { value: "revise" as const, label: "Revise" },
                { value: "obsolete" as const, label: "Obsolete" },
              ].map((item) => {
                const isActive = actionType === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setActionType(item.value)}
                    className={`rounded-lg border p-3 text-center font-medium transition-colors ${isActive
                        ? "border-[#22B323] bg-[#EAF6EC] text-[#22B323]"
                        : "border-[#E5E7EB] bg-white text-[#6A7282] hover:bg-[#F9FAFB]"
                      }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {actionType === "revise" ? (
            <div className="space-y-2">
              <Label>Revise Sub-Action</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { value: "update" as const, label: "Revise -> Update" },
                  { value: "transfer" as const, label: "Revise -> Transfer" },
                ].map((item) => {
                  const isActive = reviseSubAction === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        setReviseSubAction(item.value);
                        if (item.value === "transfer") {
                          const s = site.trim();
                          const p = processId.trim();
                          if (/^S[1-6]$/.test(s)) setTransferTargetSite(s);
                          if (/^P[1-6]$/.test(p)) setTransferTargetProcess(p);
                          setTransferDocumentClass(documentClassification);
                          if (documentClassification === "P" || documentClassification === "F") {
                            setDocType(documentClassification);
                          }
                        }
                      }}
                      className={`rounded-lg border p-3 text-center font-medium transition-colors ${isActive
                          ? "border-[#22B323] bg-[#EAF6EC] text-[#22B323]"
                          : "border-[#E5E7EB] bg-white text-[#6A7282] hover:bg-[#F9FAFB]"
                        }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Revise → Update only: Revision Details (matches design 1.9) */}
      {isReviseUpdate ? (
        <Card className="py-4">
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <h4 className="text-xl font-semibold text-[#0A0A0A]">1.9 Revision Details</h4>
              <p className="text-sm text-[#6A7282]">
                Revision/Update — version increments (v1 → v2), previous version archived
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="search-current-doc">Search Current Document (Required)</Label>
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6A7282]"
                />
                <Input
                  id="search-current-doc"
                  value={searchCurrentDocumentRef}
                  onChange={(e) => setSearchCurrentDocumentRef(e.target.value)}
                  className="pl-9"
                  placeholder="e.g. Doc/2025/S1/P1/P/D1/v1"
                />
              </div>
              <p className="text-xs text-[#6A7282]">
                Enter the existing document reference number to revise
              </p>
            </div>

            <div className="space-y-2">
              <Label>Reasons for Change (Required)</Label>
              <p className="text-xs text-[#6A7282]">
                Select all applicable reasons (multiple selections allowed)
              </p>
              <div className="flex flex-wrap gap-2">
                {reasonOptions.map((reason) => {
                  const isOn = reasons.includes(reason);
                  return (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => toggleReason(reason)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        isOn
                          ? "border-[#22B323] bg-[#EAF6EC] text-[#22B323]"
                          : "border-[#E5E7EB] bg-white text-[#6A7282] hover:bg-[#F9FAFB]"
                      }`}
                    >
                      {reason}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="revision-comment">Reasons / Comments</Label>
              <Textarea
                id="revision-comment"
                value={revisionComment}
                onChange={(e) =>
                  setRevisionComment(limitToWords(e.target.value, 50))
                }
                placeholder="Other (please specify integration, max 50 words)"
              />
              <div className="flex justify-between text-xs text-[#6A7282]">
                <span>Max 50 words — briefly explain the reason for this revision</span>
                <span>{countWords(revisionComment)}/50 words</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Revise → Transfer: 1.10 Transfer the Document (Manual) */}
      {isReviseTransfer ? (
        <Card className="py-4">
          <CardContent className="space-y-4">
            <div className="rounded-md border border-[#BFDBFE] bg-[#EFF6FF] p-4">
              <div className="flex gap-3">
                <RefreshCw className="shrink-0 text-[#2563EB] mt-0.5" size={20} />
                <div>
                  <p className="text-sm font-semibold text-[#1E40AF]">
                    1.10 Transfer the Document (Manual)
                  </p>
                  <p className="text-xs text-[#1D4ED8] mt-1 leading-relaxed">
                    Transfers must preserve document history, linked approvals, and audit trail. Use this
                    section to record the source document, target site and process, and any standard or
                    type change so compliance and traceability remain intact across the transfer.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <h4 className="text-xl font-semibold text-[#22B323]">1.10. Transfer the Document (Manual)</h4>
              <p className="text-sm text-[#6A7282]">
                Move document to a new site, process, standard, or type with originator approval.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transfer-doc-search">Documented Information Search</Label>
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6A7282]"
                />
                <Input
                  id="transfer-doc-search"
                  value={transferSearchRef}
                  onChange={(e) => setTransferSearchRef(e.target.value)}
                  className="pl-9"
                  placeholder="e.g. Doc/2025/S1/P2/F/D1/v1"
                />
              </div>
              <p className="text-xs text-[#6A7282]">Enter the reference of the document to transfer</p>
            </div>

            <div className="space-y-2">
              <Label>Site</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-xs text-[#6A7282]">Current Site</span>
                  <Input
                    readOnly
                    value={currentSiteDisplay}
                    className="bg-[#F9FAFB] text-[#6A7282]"
                  />
                </div>
                <div className="space-y-2">
                  <span className="text-xs text-[#6A7282]">Transfer to Site</span>
                  <div className="flex flex-wrap gap-2">
                    {TRANSFER_SITE_OPTIONS.map((s) => {
                      const on = transferTargetSite === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setTransferTargetSite(s)}
                          className={`rounded-lg border px-3 py-2 text-sm font-medium min-w-[2.5rem] transition-colors ${
                            on
                              ? "border-[#22B323] bg-[#22B323] text-white"
                              : "border-[#E5E7EB] bg-white text-[#6A7282] hover:bg-[#F9FAFB]"
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Process</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-xs text-[#6A7282]">Current Process</span>
                  <Input
                    readOnly
                    value={currentProcessDisplay}
                    className="bg-[#F9FAFB] text-[#6A7282]"
                  />
                </div>
                <div className="space-y-2">
                  <span className="text-xs text-[#6A7282]">Transfer to Process</span>
                  <div className="flex flex-wrap gap-2">
                    {TRANSFER_PROCESS_OPTIONS.map((p) => {
                      const on = transferTargetProcess === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setTransferTargetProcess(p)}
                          className={`rounded-lg border px-3 py-2 text-sm font-medium min-w-[2.5rem] transition-colors ${
                            on
                              ? "border-[#22B323] bg-[#22B323] text-white"
                              : "border-[#E5E7EB] bg-white text-[#6A7282] hover:bg-[#F9FAFB]"
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Standard</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-xs text-[#6A7282]">Current Standard</span>
                  <Input
                    readOnly
                    value={managementStandardLabel(managementStandard)}
                    className="bg-[#F9FAFB] text-[#6A7282]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transfer-standard-change" className="text-xs text-[#6A7282]">
                    Change (If Required)
                  </Label>
                  <Input
                    id="transfer-standard-change"
                    value={transferStandardChange}
                    onChange={(e) => setTransferStandardChange(e.target.value)}
                    placeholder="e.g. ISO 14001"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Document Type</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-xs text-[#6A7282]">Current Type</span>
                  <Input
                    readOnly
                    value={classificationTypeLabel(documentClassification)}
                    className="bg-[#F9FAFB] text-[#6A7282]"
                  />
                </div>
                <div className="space-y-2">
                  <span className="text-xs text-[#6A7282]">Change (If Required)</span>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { value: "P" as const, title: "P" },
                        { value: "F" as const, title: "F" },
                        { value: "EXT" as const, title: "EXT" },
                      ] as const
                    ).map((item) => {
                      const on = transferDocumentClass === item.value;
                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => {
                            setTransferDocumentClass(item.value);
                            setDocumentClassification(item.value);
                            if (item.value === "P" || item.value === "F") {
                              setDocType(item.value);
                            }
                            if (item.value !== "EXT") {
                              setExternalDocumentFileName("");
                            }
                          }}
                          className={`rounded-lg border px-4 py-2 text-sm font-semibold min-w-[2.75rem] transition-colors ${
                            on
                              ? "border-[#22B323] bg-[#22B323] text-white"
                              : "border-[#E5E7EB] bg-white text-[#6A7282] hover:bg-[#F9FAFB]"
                          }`}
                        >
                          {item.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transfer-initiator-request">Request by the Initiator</Label>
              <Textarea
                id="transfer-initiator-request"
                value={transferInitiatorRequest}
                onChange={(e) => setTransferInitiatorRequest(e.target.value)}
                placeholder="Describe the reason for transfer and accountability context..."
                className="min-h-[120px]"
              />
            </div>

            <div className="space-y-2">
              <Label>Originator Consent (if different)</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOriginatorConsent("accepted")}
                  className={`rounded-lg border p-3 text-sm font-medium transition-colors ${
                    originatorConsent === "accepted"
                      ? "border-[#22B323] bg-[#22B323] text-white"
                      : "border-[#E5E7EB] bg-white text-[#6A7282] hover:bg-[#F9FAFB]"
                  }`}
                >
                  ✓ Accepted
                </button>
                <button
                  type="button"
                  onClick={() => setOriginatorConsent("declined")}
                  className={`rounded-lg border p-3 text-sm font-medium transition-colors ${
                    originatorConsent === "declined"
                      ? "border-[#EF4444] bg-[#EF4444] text-white"
                      : "border-[#E5E7EB] bg-white text-[#6A7282] hover:bg-[#F9FAFB]"
                  }`}
                >
                  ✕ Declined
                </button>
              </div>
              <p className="text-xs text-[#6A7282]">
                Originator consent is mandatory before any transfer. If process owner initiates, no consent
                required.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Fifth card under Step 1: Document Title */}
      <Card className="py-4">
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <h4 className="text-xl font-semibold text-[#0A0A0A]">5. Document Title</h4>
            <p className="text-sm text-[#6A7282]">Enter document title (max 30 characters)</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-title">Document Title *</Label>
            <Input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 30))}
              placeholder="e.g., Machine Maintenance SOP"
            />
            <p className="text-xs text-[#6A7282] text-right">{title.length}/30 characters</p>
          </div>
        </CardContent>
      </Card>

      {/* Sixth card under Step 1: Standard Selection */}
      <Card className="py-4">
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <h4 className="text-xl font-semibold text-[#0A0A0A]">6. Standard Selection</h4>
            <p className="text-sm text-[#6A7282]">Select applicable management system standard</p>
          </div>

          <div className="space-y-2">
            <Label>Management System Standard *</Label>
            <Select value={managementStandard} onValueChange={setManagementStandard}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select standard" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="iso-9001">ISO 9001</SelectItem>
                <SelectItem value="iso-14001">ISO 14001</SelectItem>
                <SelectItem value="iso-45001">ISO 45001</SelectItem>
                <SelectItem value="integrated">Integrated Management System</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Clause</Label>
              <Select value={clause} onValueChange={setClause}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Clause" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">4. Context</SelectItem>
                  <SelectItem value="5">5. Leadership</SelectItem>
                  <SelectItem value="6">6. Planning</SelectItem>
                  <SelectItem value="7">7. Support</SelectItem>
                  <SelectItem value="8">8. Operation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sub-Clause</Label>
              <Select value={subClause} onValueChange={setSubClause}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sub-Clause" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4.1">4.1</SelectItem>
                  <SelectItem value="4.2">4.2</SelectItem>
                  <SelectItem value="8.5">8.5</SelectItem>
                  <SelectItem value="8.6">8.6</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seventh card under Step 1: Document Restriction */}
      <Card className="py-4">
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <h4 className="text-xl font-semibold text-[#0A0A0A]">7. Document Restriction (Security)</h4>
            <p className="text-sm text-[#6A7282]">Lock confidential documents with PIN protection</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="space-y-2 md:col-span-2">
              <Label>Document Restriction</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRestriction("unlocked")}
                  className={`rounded-lg border p-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${restriction === "unlocked"
                      ? "border-[#22B323] bg-[#EAF6EC] text-[#22B323]"
                      : "border-[#E5E7EB] bg-white text-[#6A7282]"
                    }`}
                >
                  <Unlock size={14} /> Unlocked
                </button>
                <button
                  type="button"
                  onClick={() => setRestriction("locked")}
                  className={`rounded-lg border p-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${restriction === "locked"
                      ? "border-[#22B323] bg-[#EAF6EC] text-[#22B323]"
                      : "border-[#E5E7EB] bg-white text-[#6A7282]"
                    }`}
                >
                  <Lock size={14} /> Locked
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Access Scope</Label>
              <Select value={accessScope} onValueChange={setAccessScope}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="department-only">Department Only</SelectItem>
                  <SelectItem value="organization-wide">Organization Wide</SelectItem>
                  <SelectItem value="restricted-team">Restricted Team</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Eighth card under Step 1: Reasons for Document Change (hidden when Revise → Update — covered in 1.9) */}
      {!isReviseUpdate ? (
        <Card className="py-4">
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <h4 className="text-xl font-semibold text-[#0A0A0A]">8. Reasons for Document Change</h4>
              <p className="text-sm text-[#6A7282]">
                Select all applicable reasons (multiple selection)
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
              {reasonOptions.map((reason) => {
                const reasonId = `doc-change-reason-${reason.replace(/[^a-zA-Z0-9]+/g, "-")}`;
                return (
                  <div key={reason} className="flex items-center gap-2">
                    <Checkbox
                      id={reasonId}
                      checked={reasons.includes(reason)}
                      onCheckedChange={() => toggleReason(reason)}
                    />
                    <Label htmlFor={reasonId} className="text-sm font-normal text-[#0A0A0A] cursor-pointer">
                      {reason}
                    </Label>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-[#E5E7EB]" />

            <div className="space-y-2">
              <Label htmlFor="reasons-comment">Reasons / Comments (Max 50 words)</Label>
              <Textarea
                id="reasons-comment"
                value={reasonComment}
                onChange={(e) => setReasonComment(e.target.value)}
                placeholder="Describe the reasons for this change..."
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Ninth card under Step 1: Impact Assessment */}
      <Card className="py-4">
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <h4 className="text-xl font-semibold text-[#0A0A0A]">9. Impact Assessment</h4>
            <p className="text-sm text-[#6A7282]">Identify impact on other documents</p>
          </div>

          <div className="space-y-2">
            <Label>Does this change affect other documents?</Label>
            <RadioGroup
              value={affectsOtherDocs}
              onValueChange={(v) => setAffectsOtherDocs(v as "yes" | "no")}
              className="space-y-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="yes" id="affects-other-yes" />
                <Label htmlFor="affects-other-yes" className="text-sm font-normal cursor-pointer">
                  Yes
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="no" id="affects-other-no" />
                <Label htmlFor="affects-other-no" className="text-sm font-normal cursor-pointer">
                  No
                </Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* Tenth card under Step 1: Risk Severity */}
      <Card className="py-4">
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <h4 className="text-xl font-semibold text-[#0A0A0A]">10. Risk Severity</h4>
            <p className="text-sm text-[#6A7282]">Assess risk level of this change</p>
          </div>

          <div className="space-y-2">
            <Label>Risk Severity Level</Label>
            <RadioGroup
              value={riskLevel}
              onValueChange={(v) => setRiskLevel(v as "high" | "medium" | "low")}
              className="space-y-2"
            >
              <Label
                htmlFor="risk-level-high"
                className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer font-normal ${
                  riskLevel === "high" ? "border-[#22B323] bg-[#EAF6EC]" : "border-[#E5E7EB]"
                }`}
              >
                <RadioGroupItem value="high" id="risk-level-high" />
                <span className="text-sm">
                  <span className="font-semibold text-[#EF4444]">High</span> Significant impact on operations or compliance
                </span>
              </Label>
              <Label
                htmlFor="risk-level-medium"
                className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer font-normal ${
                  riskLevel === "medium" ? "border-[#22B323] bg-[#EAF6EC]" : "border-[#E5E7EB]"
                }`}
              >
                <RadioGroupItem value="medium" id="risk-level-medium" />
                <span className="text-sm">
                  <span className="font-semibold text-[#F59E0B]">Medium</span> Moderate impact with manageable risks
                </span>
              </Label>
              <Label
                htmlFor="risk-level-low"
                className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer font-normal ${
                  riskLevel === "low" ? "border-[#22B323] bg-[#EAF6EC]" : "border-[#E5E7EB]"
                }`}
              >
                <RadioGroupItem value="low" id="risk-level-low" />
                <span className="text-sm">
                  <span className="font-semibold text-[#22B323]">Low</span> Minimal impact on operations
                </span>
              </Label>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="risk-comments">Risk Comments</Label>
            <Textarea
              id="risk-comments"
              value={riskComments}
              onChange={(e) => setRiskComments(e.target.value)}
              placeholder="Describe risk factors and mitigation measures..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Eleventh card under Step 1: Staff Training Requirement */}
      <Card className="py-4">
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <h4 className="text-xl font-semibold text-[#0A0A0A]">11. Staff Training Requirement</h4>
            <p className="text-sm text-[#6A7282]">Determine if training is needed for this change</p>
          </div>

          <div className="space-y-2">
            <Label>Is staff training required?</Label>
            <RadioGroup
              value={trainingRequired}
              onValueChange={(v) => setTrainingRequired(v as "yes" | "no")}
              className="space-y-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="yes" id="training-required-yes" />
                <Label htmlFor="training-required-yes" className="text-sm font-normal cursor-pointer">
                  Yes
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="no" id="training-required-no" />
                <Label htmlFor="training-required-no" className="text-sm font-normal cursor-pointer">
                  No
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="training-details">Training Details</Label>
            <Textarea
              id="training-details"
              value={trainingDetails}
              onChange={(e) => setTrainingDetails(e.target.value)}
              placeholder="Provide training scope, participants, and schedule..."
              disabled={trainingRequired === "no"}
            />
          </div>
        </CardContent>
      </Card>

      {/* Twelfth card: always shown — EXT uses upload; P/F use textarea */}
      <Card className="py-4">
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <h4 className="text-xl font-semibold text-[#0A0A0A]">12. Document Editor (Main Content)</h4>
            {documentClassification === "EXT" ? (
              <p className="text-sm text-[#6A7282]">Upload the external document file</p>
            ) : isReviseTransfer ? null : (
              <p className="text-sm text-[#6A7282]">
                {isReviseUpdate
                  ? "Enter or paste the revised document body"
                  : "Enter or paste the document body"}
              </p>
            )}
          </div>
          {documentClassification === "EXT" ? (
            <div className="relative min-h-[220px] rounded-lg border border-[#E5E7EB] bg-[#F9FAFB]">
              {externalDocumentFileName ? (
                <p className="p-4 text-sm text-[#0A0A0A] pr-48 break-all">{externalDocumentFileName}</p>
              ) : null}
              <input
                id="external-doc-upload"
                type="file"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setExternalDocumentFileName(f?.name ?? "");
                }}
              />
              <label
                htmlFor="external-doc-upload"
                className="absolute bottom-4 right-4 inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-4 py-2.5 text-xs font-bold tracking-wide text-[#0A0A0A] shadow-sm transition-colors hover:bg-[#F9FAFB]"
              >
                <Paperclip className="text-[#22B323]" size={16} aria-hidden />
                UPLOAD FILE
              </label>
            </div>
          ) : (
            <Textarea
              id="document-editor-main"
              value={documentEditorContent}
              onChange={(e) => setDocumentEditorContent(e.target.value)}
              placeholder={
                isReviseTransfer
                  ? "Document body for the transferred record…"
                  : isReviseUpdate
                    ? "Document body appears here after revision…"
                    : "Enter or paste document content…"
              }
              className="min-h-[220px] resize-y bg-[#F9FAFB] border-[#E5E7EB]"
            />
          )}
        </CardContent>
      </Card>

      {/* Thirteenth card under Step 1: Document Dates */}
      <Card className="py-4">
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <h4 className="text-xl font-semibold text-[#0A0A0A]">13. Document Dates</h4>
            <p className="text-sm text-[#6A7282]">Set planning and execution dates</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="plan-date">Document Plan Date *</Label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6A7282]" />
                <Input
                  id="plan-date"
                  type="date"
                  value={planDate}
                  onChange={(e) => setPlanDate(e.target.value)}
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-[#6A7282]">System generated</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="actual-date">Actual Date</Label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6A7282]" />
                <Input
                  id="actual-date"
                  type="date"
                  value={actualDate}
                  onChange={(e) => setActualDate(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6A7282]" />
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fourteenth card under Step 1: Output Preview */}
      <Card className="py-4">
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <h4 className="text-xl font-semibold text-[#0A0A0A]">14. Document Output Preview</h4>
            <p className="text-sm text-[#6A7282]">Preview how the final document will appear</p>
          </div>

          <div className="rounded-lg border border-[#E5E7EB] p-3">
            <p className="text-xs text-[#6A7282] mb-2">Review before submitting</p>
            <div className="rounded-md bg-[#F9FAFB] p-4 grid grid-cols-1 md:grid-cols-2 gap-y-2 text-sm">
              <p><span className="text-[#6A7282]">Document Ref:</span> <span className="font-medium ml-2">{previewDocRef}</span></p>
              <p><span className="text-[#6A7282]">Title:</span> <span className="font-medium ml-2">{title || "—"}</span></p>
              <p><span className="text-[#6A7282]">Type:</span> <span className="font-medium ml-2">{documentClassification} - {documentClassification === "P" ? "Maintained Doc" : documentClassification === "F" ? "Retained Record" : "External Doc"}</span></p>
              <p><span className="text-[#6A7282]">Standard:</span> <span className="font-medium ml-2">{managementStandard || "ISO 9001"}</span></p>
              <p><span className="text-[#6A7282]">Clause:</span> <span className="font-medium ml-2">{clause || "—"}</span></p>
              <p><span className="text-[#6A7282]">Priority:</span> <span className="font-medium ml-2">{priorityLevel === "high" ? "High" : "Low"}</span></p>
              <p><span className="text-[#6A7282]">Risk Level:</span> <span className="font-medium ml-2">{riskLevel[0].toUpperCase() + riskLevel.slice(1)}</span></p>
              <p><span className="text-[#6A7282]">Initial Status:</span> <span className="font-medium ml-2">Draft</span></p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fifteenth card under Step 1: Submit Actions */}
      <Card className="py-4">
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <h4 className="text-xl font-semibold text-[#0A0A0A]">15. Submit Actions</h4>
            <p className="text-sm text-[#6A7282]">Save as draft or proceed to review stage</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Button variant="outline" type="button" className="gap-2">
              <Save size={14} />
              Save as Draft
            </Button>
            <Button type="button" className="bg-[#22B323] hover:bg-[#1a9825] gap-2" onClick={onNext}>
              <Send size={14} />
              Submit &amp; Proceed
            </Button>
          </div>

          <div className="rounded-md border border-[#BFDBFE] bg-[#EFF6FF] p-3">
            <div className="flex items-start gap-2">
              <CircleAlert className="text-[#2563EB] mt-0.5" size={16} />
              <div>
                <p className="text-sm font-semibold text-[#1E40AF]">After Submission</p>
                <p className="text-xs text-[#1D4ED8]">
                  Document will move to REVIEW stage where the reviewer will perform 4M analysis and technical validation before forwarding to the approver.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

    </>
  );
}

