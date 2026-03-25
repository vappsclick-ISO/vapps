"use client";

import { Button } from "@/components/ui/button";

type ReviewDocumentStepProps = {
  title: string;
  docType: string;
  site: string;
  processName: string;
  description: string;
  onBack: () => void;
  onNext: () => void;
};

export default function ReviewDocumentStep({
  title,
  docType,
  site,
  processName,
  description,
  onBack,
  onNext,
}: ReviewDocumentStepProps) {
  return (
    <>
      <h3 className="text-base font-semibold">Review</h3>
      <div className="rounded-lg border border-[#0000001A] p-4 text-sm space-y-2">
        <div>
          <span className="font-medium">Title:</span> {title || "-"}
        </div>
        <div>
          <span className="font-medium">Type:</span> {docType}
        </div>
        <div>
          <span className="font-medium">Site:</span> {site || "-"}
        </div>
        <div>
          <span className="font-medium">Process:</span> {processName || "-"}
        </div>
        <div>
          <span className="font-medium">Description:</span> {description || "-"}
        </div>
      </div>
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>Send to Approval</Button>
      </div>
    </>
  );
}

