"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, CheckCircle, FileText, Save, Search } from "lucide-react";
import { getDashboardPath } from "@/lib/subdomain";
import { cn } from "@/lib/utils";
import CreateDocumentStep from "@/components/documents/steps/CreateDocumentStep";
import ReviewDocumentStep from "@/components/documents/steps/ReviewDocumentStep";
import ApprovalDocumentStep from "@/components/documents/steps/ApprovalDocumentStep";

type Step = 1 | 2 | 3;

export default function DocumentsCreateContent() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";

  const [step, setStep] = useState<Step>(1);
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("P");
  const [site, setSite] = useState("");
  const [processName, setProcessName] = useState("");
  const [description, setDescription] = useState("");

  const steps = useMemo(
    () => [
      { step: 1 as const, label: "Create Document", icon: FileText },
      { step: 2 as const, label: "Review", icon: Search },
      { step: 3 as const, label: "Approval", icon: CheckCircle },
    ],
    []
  );

  const listHref = orgId ? getDashboardPath(orgId, "documents") : "/";

  return (
    <div className="space-y-6">
      <Card className="py-4">
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
            <h2 className="text-lg font-bold text-[#0A0A0A]">Document Management</h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <Save size={14} />
                Save Draft
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={listHref}>Exit to Dashboard</Link>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {steps.map(({ step: s, label, icon: Icon }) => {
              const isCurrent = step === s;
              const isDone = step > s;
              const DisplayIcon = isDone ? Check : Icon;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStep(s)}
                  className={cn(
                    "rounded-lg border px-4 py-3 transition-all",
                    "flex flex-col items-center justify-center min-h-[92px] gap-2",
                    isCurrent
                      ? "bg-[#22B323] border-[#22B323] text-white"
                      : isDone
                      ? "bg-[#EEFFF3] border-[#22B323] text-[#15803D]"
                      : "bg-[#F3F4F6] border-[#E5E7EB] text-[#6B7280] hover:bg-[#EBEEF2]"
                  )}
                >
                  <span
                    className={cn(
                      "h-8 w-8 rounded-full border flex items-center justify-center",
                      isCurrent
                        ? "border-white/70 bg-white/15"
                        : isDone
                        ? "border-[#22B323] bg-[#22B323]"
                        : "border-[#D1D5DB] bg-white"
                    )}
                  >
                    <DisplayIcon size={15} className={cn(isCurrent || isDone ? "text-white" : "text-[#9CA3AF]")} />
                  </span>
                  <span className="text-xs font-medium">{label}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* <Card className="py-4">
        <CardContent className="space-y-5"> */}
          {step === 1 && (
            <CreateDocumentStep
              title={title}
              setTitle={setTitle}
              docType={docType}
              setDocType={setDocType}
              site={site}
              setSite={setSite}
              processName={processName}
              setProcessName={setProcessName}
              description={description}
              setDescription={setDescription}
              onNext={() => setStep(2)}
            />
          )}

          {step === 2 && (
            <ReviewDocumentStep
              title={title}
              docType={docType}
              site={site}
              processName={processName}
              description={description}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}

          {step === 3 && (
            <ApprovalDocumentStep listHref={listHref} onBack={() => setStep(2)} />
          )}
        {/* </CardContent>
      </Card> */}
    </div>
  );
}

