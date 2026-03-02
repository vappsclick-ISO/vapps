"use client";

import React, { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Upload, X, Paperclip } from "lucide-react";

interface UploadedFile {
  id: string;
  file: File;
}

interface ActionPlanRow {
  id: string;
  action: string;
  responsible: string;
  plannedDate: string;
  actualDate: string;
  files: UploadedFile[];
}

export default function RisksDialog() {
  const fileInputRef1 = useRef<HTMLInputElement>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null);

  const [containmentFiles, setContainmentFiles] = useState<UploadedFile[]>([]);
  const [rootCauseFiles, setRootCauseFiles] = useState<UploadedFile[]>([]);

  const [actionPlans, setActionPlans] = useState<ActionPlanRow[]>([
    {
      id: crypto.randomUUID(),
      action: "",
      responsible: "",
      plannedDate: "",
      actualDate: "",
      files: [],
    },
  ]);

  const handleFiles = (
    files: FileList | null,
    setter: React.Dispatch<React.SetStateAction<UploadedFile[]>>
  ) => {
    if (!files) return;
    const newFiles: UploadedFile[] = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      file,
    }));
    setter((prev) => [...prev, ...newFiles]);
  };

  const handleActionFileUpload = (rowId: string, files: FileList | null) => {
    if (!files) return;
    setActionPlans((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              files: [
                ...row.files,
                ...Array.from(files).map((file) => ({
                  id: crypto.randomUUID(),
                  file,
                })),
              ],
            }
          : row
      )
    );
  };

  const removeFile = (
    id: string,
    setter: React.Dispatch<React.SetStateAction<UploadedFile[]>>
  ) => {
    setter((prev) => prev.filter((f) => f.id !== id));
  };

  const removeActionFile = (rowId: string, fileId: string) => {
    setActionPlans((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? { ...row, files: row.files.filter((f) => f.id !== fileId) }
          : row
      )
    );
  };

  const updateActionPlan = (
    id: string,
    field: keyof ActionPlanRow,
    value: string
  ) => {
    setActionPlans((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, [field]: value } : row
      )
    );
  };

  const addActionPlan = () => {
    setActionPlans((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        action: "",
        responsible: "",
        plannedDate: "",
        actualDate: "",
        files: [],
      },
    ]);
  };

  const removeActionPlan = (id: string) => {
    setActionPlans((prev) => prev.filter((row) => row.id !== id));
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Open Dialog</Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl! max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Containment / Immediate Correction</DialogTitle>
          <DialogDescription>
            Immediate actions taken to control the issue and prevent further impact until a permanent solution is applied.
          </DialogDescription>
        </DialogHeader>

        {/* Containment Section */}
        <div className="space-y-4">
          <Textarea placeholder="Describe the immediate corrective action taken..." />

          <input
            type="file"
            multiple
            hidden
            ref={fileInputRef1}
            onChange={(e) => handleFiles(e.target.files, setContainmentFiles)}
          />

          <div
            onClick={() => fileInputRef1.current?.click()}
            className="cursor-pointer border border-dashed rounded-lg p-6 text-center hover:bg-muted"
          >
            <Upload className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Drag & drop or browse</p>
          </div>

          {containmentFiles.map(({ id, file }) => (
            <FileItem
              key={id}
              file={file}
              onRemove={() => removeFile(id, setContainmentFiles)}
            />
          ))}
        </div>

        {/* Root Cause */}
        <div className="space-y-4 pt-6">
          <h3 className="font-semibold">Root Cause of Problem (Optional)</h3>
          <Textarea placeholder="Explain the root cause of the issue..." />

          <input
            type="file"
            multiple
            hidden
            ref={fileInputRef2}
            onChange={(e) => handleFiles(e.target.files, setRootCauseFiles)}
          />

          <div
            onClick={() => fileInputRef2.current?.click()}
            className="cursor-pointer border border-dashed rounded-lg p-6 text-center hover:bg-muted"
          >
            <Upload className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Drag & drop or browse</p>
          </div>

          {rootCauseFiles.map(({ id, file }) => (
            <FileItem
              key={id}
              file={file}
              onRemove={() => removeFile(id, setRootCauseFiles)}
            />
          ))}
        </div>

        {/* Action Plan */}
        <div className="space-y-4 pt-6">
          <h3 className="font-semibold">Action Plan</h3>

          {actionPlans.map((row) => (
            <div key={row.id} className="border rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-6 gap-3">
                <Input
                  placeholder="Action"
                  value={row.action}
                  onChange={(e) => updateActionPlan(row.id, "action", e.target.value)}
                />
                <Input
                  placeholder="Responsible"
                  value={row.responsible}
                  onChange={(e) => updateActionPlan(row.id, "responsible", e.target.value)}
                />
                <Input
                  type="date"
                  value={row.plannedDate}
                  onChange={(e) => updateActionPlan(row.id, "plannedDate", e.target.value)}
                />
                <Input
                  type="date"
                  value={row.actualDate}
                  onChange={(e) => updateActionPlan(row.id, "actualDate", e.target.value)}
                />

                <label className="flex items-center gap-2 cursor-pointer">
                  <Paperclip className="h-4 w-4" /> Upload
                  <input
                    type="file"
                    multiple
                    hidden
                    onChange={(e) => handleActionFileUpload(row.id, e.target.files)}
                  />
                </label>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeActionPlan(row.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {row.files.map(({ id, file }) => (
                <FileItem
                  key={id}
                  file={file}
                  onRemove={() => removeActionFile(row.id, id)}
                />
              ))}
            </div>
          ))}

          <Button variant="ghost" onClick={addActionPlan} className="gap-2">
            <Plus className="h-4 w-4" /> Add Another Action
          </Button>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="ghost">Cancel</Button>
          <Button>Submit to Issuer</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FileItem({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-between border rounded-md px-3 py-2">
      <div>
        <p className="text-sm">{file.name}</p>
        <p className="text-xs text-muted-foreground">
          {(file.size / 1024).toFixed(1)} KB
        </p>
      </div>
      <Button size="icon" variant="ghost" onClick={onRemove}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
