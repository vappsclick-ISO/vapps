"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

type ApprovalDocumentStepProps = {
  listHref: string;
  onBack: () => void;
};

export default function ApprovalDocumentStep({
  listHref,
  onBack,
}: ApprovalDocumentStepProps) {
  return (
    <>
      <h3 className="text-base font-semibold">Approval</h3>
      <div className="rounded-lg border border-[#0000001A] p-4 text-sm">
        Document is ready for approval.
      </div>
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button asChild>
          <Link href={listHref}>Approve &amp; Finish</Link>
        </Button>
      </div>
    </>
  );
}

