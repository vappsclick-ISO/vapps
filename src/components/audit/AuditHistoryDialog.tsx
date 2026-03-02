"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertTriangle, ArrowUpCircle } from "lucide-react";

export type AuditHistoryEntry = {
  id: string;
  type: "Created" | "Updated" | "Escalated";
  title: string;
  description: string;
  date: string;
  by: string;
};

const defaultHistoryEntries: AuditHistoryEntry[] = [
  {
    id: "1",
    type: "Created",
    title: "Audit Created",
    description: "Audit was initiated and assigned to reviewer",
    date: "Nov 1, 2025 at 9:00 AM",
    by: "Sarah Johnson",
  },
  {
    id: "2",
    type: "Updated",
    title: "Scope Updated",
    description: "Audit scope was expanded to include additional processes",
    date: "Nov 3, 2025 at 2:30 PM",
    by: "Mike Chen",
  },
  {
    id: "3",
    type: "Escalated",
    title: "Non-Conformance Found",
    description: "Major non-conformance identified in documentation",
    date: "Nov 5, 2025 at 11:15 AM",
    by: "Sarah Johnson",
  },
];

function HistoryIcon({ type }: { type: AuditHistoryEntry["type"] }) {
  const base = "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2";
  if (type === "Created") {
    return (
      <span className={`${base} border-blue-200 bg-blue-50 text-blue-600 relative flex items-center justify-center`}>
        <Clock className="h-4 w-4" />
        {/* vertical blue line from bottom center, clearly visible as in image */}
        <span
          className="absolute left-1/2"
          style={{
            top: "100%",
            transform: "translateX(-50%)",
            height: "68px",
            width: "2px",
            background: "#2563eb",
            borderRadius: "1px",
            opacity: 1,
            zIndex: 10
          }}
          aria-hidden="true"
        />
      </span>

    );
  }
  if (type === "Updated") {
    return (
      <span className={`${base} border-amber-200 bg-amber-50 text-amber-600 relative flex items-center justify-center`}>
        <AlertTriangle className="h-4 w-4" />
        <span
          className="absolute left-1/2"
          style={{
            top: "100%",
            transform: "translateX(-50%)",
            height: "68px",
            width: "2px",
            background: "#f59e42",
            borderRadius: "1px",
            opacity: 1,
            zIndex: 10
          }}
          aria-hidden="true"
        />
      </span>
    );
  }
  return (
    <span className={`${base} border-red-200 bg-red-50 text-red-600`}>
      <ArrowUpCircle className="h-4 w-4" />
    </span>
  );
}

function StatusBadge({ type }: { type: AuditHistoryEntry["type"] }) {
  if (type === "Created") {
    return (
      <Badge className="border-transparent bg-blue-100 text-blue-800 hover:bg-blue-100">
        Created
      </Badge>
    );
  }
  if (type === "Updated") {
    return (
      <Badge variant="outline" >
        Updated
      </Badge>
    );
  }
  return <Badge variant="destructive">Escalated</Badge>;
}

interface AuditHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  traceabilityId: string;
  entries?: AuditHistoryEntry[];
}

export default function AuditHistoryDialog({
  open,
  onOpenChange,
  traceabilityId,
  entries = defaultHistoryEntries,
}: AuditHistoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl! max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl font-bold text-gray-900">
            Task History: Audit History
          </DialogTitle>
          <p className="text-sm font-normal text-gray-500">
            Traceability ID: {traceabilityId}
          </p>
        </DialogHeader>

        <div className="mt-4 space-y-6">
          {entries.map((entry) => (
            <div key={entry.id} className="flex gap-3">
              <HistoryIcon type={entry.type} />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge type={entry.type} />
                  <span className="font-semibold text-gray-900">{entry.title}</span>
                </div>
                <p className="text-sm text-gray-600">{entry.description}</p>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-gray-500" />
                    {entry.date}
                  </span>
                  <span className="text-gray-400">•</span>
                  <span>by {entry.by}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
