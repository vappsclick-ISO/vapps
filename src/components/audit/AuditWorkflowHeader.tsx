"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Calendar,
  AlertTriangle,
  CheckSquare,
  ClipboardList,
  CheckCircle,
  Check,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { step: 1, label: "Managing Audit Program", icon: FileText },
  { step: 2, label: "Audit Plan", icon: Calendar },
  { step: 3, label: "Audit Findings", icon: AlertTriangle },
  { step: 4, label: "Corrective Action", icon: CheckSquare },
  { step: 5, label: "Verification", icon: ClipboardList },
  { step: 6, label: "Closure", icon: CheckCircle },
] as const;

/** All steps [1,2,3,4,5,6] are accessible (view); edit only in own tab by role. */
interface AuditWorkflowHeaderProps {
  currentStep: number;
  orgId?: string;
  /** All steps are clickable; pass [1,2,3,4,5,6] so everyone can open any tab (read-only when not owner). */
  allowedSteps?: number[];
  /** Steps that are locked for the current user (e.g. Step 6 until 1–5 complete for lead auditor, Step 5 until Step 4 complete for auditor). */
  lockedSteps?: number[];
  /** Query string to append to step links (e.g. auditPlanId, programId, criteria). */
  stepQuery?: string;
  saveDraftHref?: string;
  exitHref?: string;
}

export default function AuditWorkflowHeader({
  currentStep,
  orgId,
  allowedSteps = [1, 2, 3, 4, 5, 6],
  lockedSteps = [],
  stepQuery,
  saveDraftHref = "#",
  exitHref = "../..",
}: AuditWorkflowHeaderProps) {
  const getStepHref = (step: number) => {
    if (!orgId) return "#";
    const base = `/dashboard/${orgId}/audit/create/${step}`;
    return stepQuery ? `${base}?${stepQuery}` : base;
  };

  return (
    <>
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            Audit Workflow Management
          </h2>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={saveDraftHref} className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                Save Draft
              </Link>
            </Button>

            <Button variant="outline" size="sm" asChild>
              <Link href={exitHref}>Exit to Dashboard</Link>
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {STEPS.map(({ step, label, icon: Icon }) => {
            // All steps are accessible (view any tab); completion = any step before current
            const isAccessible = allowedSteps.includes(step);
            const isLocked = lockedSteps.includes(step);
            const isCompleted = currentStep > step;
            const isCurrent = currentStep === step;
            const isUnlocked = isAccessible && !isLocked;

            // Tab container: current step always shows active (green), then completed, then unlocked, then locked
            const tabClasses = cn(
              "flex-1 rounded-lg border-2 transition-all duration-200",
              "flex flex-col items-center justify-center py-4 px-2 min-h-[100px]",
              isCurrent
                ? "bg-green-600 border-green-600 cursor-pointer" // Current step always active
                : isCompleted
                ? "bg-green-50 border-green-600 hover:bg-green-100 cursor-pointer"
                : isUnlocked
                ? "bg-white border-green-600 hover:bg-green-50 cursor-pointer"
                : "bg-gray-50 border-gray-200 cursor-not-allowed opacity-60"
            );

            // Icon circle classes
            const iconCircleClasses = cn(
              "flex h-10 w-10 items-center justify-center rounded-full border-2 mb-2",
              isCompleted
                ? "bg-green-500 border-green-600"
                : isCurrent
                ? "bg-white/20 border-white" // Current: subtle circle on green
                : "bg-white border-gray-300"
            );

            // Icon component - completed shows checkmark, current and others show step icon
            const IconComponent = isCompleted ? Check : Icon;

            // Icon color classes
            const iconColorClasses = cn(
              "h-5 w-5",
              isCompleted
                ? "text-white"
                : isCurrent
                ? "text-white"
                : isUnlocked
                ? "text-gray-600"
                : "text-gray-400"
            );

            // Text classes
            const textClasses = cn(
              "text-xs font-semibold text-center leading-tight px-1",
              isCompleted
                ? "text-green-700"
                : isCurrent
                ? "text-white"
                : isUnlocked
                ? "text-gray-700"
                : "text-gray-400"
            );

            const stepHref = getStepHref(step);

            const tabContent = (
              <>
                <div className={iconCircleClasses}>
                  <IconComponent className={iconColorClasses} strokeWidth={2.5} />
                </div>
                <div className={textClasses}>{label}</div>
              </>
            );

            if (!isAccessible || isLocked) {
              return (
                <div key={step} className={tabClasses} title={isLocked ? "Complete previous steps first" : undefined}>
                  {tabContent}
                </div>
              );
            }

            return (
              <Link
                key={step}
                href={stepHref}
                className={tabClasses}
              >
                {tabContent}
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
