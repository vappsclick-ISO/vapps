"use client";

import React, { useRef, useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Upload, X, Paperclip } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { useParams } from "next/navigation";

interface UploadedFile {
  id: string;
  file: File;
}

interface ExistingFileMetadata {
  name: string;
  size: number;
  type?: string;
  url?: string;
  key?: string; // S3 object key for secure downloads
}

interface ActionPlanRow {
  id: string;
  action: string;
  responsible: string;
  plannedDate: string;
  actualDate: string;
  files: UploadedFile[];
  existingFiles?: ExistingFileMetadata[]; // Existing files from database
}

interface ReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  onCancel: () => void;
  issueId?: string;
  orgId?: string;
  processId?: string;
}

export default function ReviewDialog({
  open,
  onOpenChange,
  onSubmit,
  onCancel,
  issueId,
  orgId,
  processId,
}: ReviewDialogProps) {
  const params = useParams();
  const finalOrgId = orgId || (params.orgId as string);
  const finalProcessId = processId || (params.processId as string);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const fileInputRef1 = useRef<HTMLInputElement>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null);

  const [containmentText, setContainmentText] = useState("");
  const [rootCauseText, setRootCauseText] = useState("");
  const [containmentFiles, setContainmentFiles] = useState<UploadedFile[]>([]);
  const [rootCauseFiles, setRootCauseFiles] = useState<UploadedFile[]>([]);
  const [existingContainmentFiles, setExistingContainmentFiles] = useState<ExistingFileMetadata[]>([]);
  const [existingRootCauseFiles, setExistingRootCauseFiles] = useState<ExistingFileMetadata[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});

  const [actionPlans, setActionPlans] = useState<ActionPlanRow[]>([
    {
      id: crypto.randomUUID(),
      action: "",
      responsible: "",
      plannedDate: "",
      actualDate: "",
      files: [],
      existingFiles: [],
    },
  ]);

  const handleFiles = (
    files: FileList | null,
    setter: React.Dispatch<React.SetStateAction<UploadedFile[]>>,
    inputRef?: React.RefObject<HTMLInputElement | null>
  ) => {
    if (!files) return;
    
    // Validate file size (max 10MB per file)
    const maxSize = 10 * 1024 * 1024; // 10MB
    const invalidFiles: File[] = [];
    
    Array.from(files).forEach((file) => {
      if (file.size > maxSize) {
        invalidFiles.push(file);
      }
    });
    
    if (invalidFiles.length > 0) {
      toast.error(`Some files exceed the 10MB limit: ${invalidFiles.map(f => f.name).join(', ')}`);
      return;
    }
    
    const newFiles: UploadedFile[] = Array.from(files)
      .filter((file) => file.size <= maxSize)
      .map((file) => ({
        id: crypto.randomUUID(),
        file,
      }));
    
    setter((prev) => [...prev, ...newFiles]);
    
    // Reset file input so same file can be selected again
    if (inputRef?.current) {
      inputRef.current.value = '';
    }
  };

  const handleActionFileUpload = (rowId: string, files: FileList | null, inputElement?: HTMLInputElement) => {
    if (!files) return;
    
    // Validate file size (max 10MB per file)
    const maxSize = 10 * 1024 * 1024; // 10MB
    const invalidFiles: File[] = [];
    
    Array.from(files).forEach((file) => {
      if (file.size > maxSize) {
        invalidFiles.push(file);
      }
    });
    
    if (invalidFiles.length > 0) {
      toast.error(`Some files exceed the 10MB limit: ${invalidFiles.map(f => f.name).join(', ')}`);
      return;
    }
    
    setActionPlans((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              files: [
                ...row.files,
                ...Array.from(files)
                  .filter((file) => file.size <= maxSize)
                  .map((file) => ({
                    id: crypto.randomUUID(),
                    file,
                  })),
              ],
            }
          : row
      )
    );
    
    // Reset file input so same file can be selected again
    if (inputElement) {
      inputElement.value = '';
    }
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
        existingFiles: [],
      },
    ]);
  };

  const removeActionPlan = (id: string) => {
    setActionPlans((prev) => prev.filter((row) => row.id !== id));
  };

  // Load existing review data when dialog opens
  useEffect(() => {
    const loadExistingReview = async () => {
      if (!open || !issueId || !finalOrgId || !finalProcessId) {
        // Reset form when dialog closes
        if (!open) {
          resetForm();
        }
        return;
      }

      setIsLoadingReview(true);
      try {
        const response = await apiClient.getIssueReview(finalOrgId, finalProcessId, issueId);
        
        if (response.review) {
          console.log('[ReviewDialog] Loading existing review data:', response.review);
          
          // Load existing data into form
          setContainmentText(response.review.containmentText || "");
          setRootCauseText(response.review.rootCauseText || "");
          
          // Load existing file metadata (files are stored in S3, metadata includes S3 key)
          // Files stored as: [{name, size, type, key}] where key is S3 object key for secure downloads
          if (response.review.containmentFiles && Array.isArray(response.review.containmentFiles) && response.review.containmentFiles.length > 0) {
            setExistingContainmentFiles(response.review.containmentFiles);
            console.log('[ReviewDialog] Loaded existing containment files:', response.review.containmentFiles);
          } else {
            setExistingContainmentFiles([]);
          }
          
          if (response.review.rootCauseFiles && Array.isArray(response.review.rootCauseFiles) && response.review.rootCauseFiles.length > 0) {
            setExistingRootCauseFiles(response.review.rootCauseFiles);
            console.log('[ReviewDialog] Loaded existing root cause files:', response.review.rootCauseFiles);
          } else {
            setExistingRootCauseFiles([]);
          }
          
          // Load action plans with existing files
          if (response.review.actionPlans && Array.isArray(response.review.actionPlans) && response.review.actionPlans.length > 0) {
            setActionPlans(
              response.review.actionPlans.map((plan: any) => ({
                id: crypto.randomUUID(), // Generate new ID for form
                action: plan.action || "",
                responsible: plan.responsible || "",
                plannedDate: plan.plannedDate || "",
                actualDate: plan.actualDate || "",
                files: [], // New files uploaded in this session (File objects)
                existingFiles: (plan.files && Array.isArray(plan.files) && plan.files.length > 0) 
                  ? plan.files 
                  : [], // Existing files from database (includes S3 key for secure downloads)
              }))
            );
          } else {
            // If no action plans, start with one empty row
            setActionPlans([
              {
                id: crypto.randomUUID(),
                action: "",
                responsible: "",
                plannedDate: "",
                actualDate: "",
                files: [],
              },
            ]);
          }
        } else {
          // No existing review data - reset form to empty
          resetForm();
        }
      } catch (error: any) {
        console.error('[ReviewDialog] Error loading existing review:', error);
        // If error loading, start with empty form
        resetForm();
      } finally {
        setIsLoadingReview(false);
      }
    };

    // Only load when dialog opens and has valid issueId
    if (open && issueId) {
      loadExistingReview();
    }
    // Note: Form reset happens in handleClose, not here to avoid conflicts
  }, [open, issueId, finalOrgId, finalProcessId]);

  // Reset form to empty state
  const resetForm = () => {
    setContainmentText("");
    setRootCauseText("");
    setContainmentFiles([]);
    setRootCauseFiles([]);
    setExistingContainmentFiles([]);
    setExistingRootCauseFiles([]);
    setActionPlans([
      {
        id: crypto.randomUUID(),
        action: "",
        responsible: "",
        plannedDate: "",
        actualDate: "",
        files: [],
        existingFiles: [],
      },
    ]);
  };

  const handleSubmit = async () => {
    if (!issueId || !finalOrgId || !finalProcessId) {
      toast.error("Missing required information");
      return;
    }

    // Validate that containment text is provided (required field)
    const trimmedContainmentText = containmentText?.trim() || "";
    if (!trimmedContainmentText) {
      toast.error("Please provide containment/immediate correction details");
      // Focus on the textarea to help user
      setTimeout(() => {
        const textarea = document.querySelector('textarea[placeholder*="immediate corrective action"]') as HTMLTextAreaElement;
        if (textarea) {
          textarea.focus();
          textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      return;
    }

    setIsSubmitting(true);

    try {
      // Check if there are any files to upload
      const hasFilesToUpload = containmentFiles.length > 0 || rootCauseFiles.length > 0 || 
        actionPlans.some(plan => plan.files.length > 0);

      if (hasFilesToUpload) {
        setUploadingFiles(true);
        setUploadProgress({});
      }

      // Upload new files to S3
      const uploadPromises: Promise<any>[] = [];

      // Upload containment files
      containmentFiles.forEach(({ id, file }) => {
        const promise = apiClient
          .uploadFile(file, finalOrgId, finalProcessId, issueId, "containment")
          .then((result) => {
            setUploadProgress((prev) => ({ ...prev, [id]: 100 }));
            return { id, result };
          })
          .catch((error) => {
            console.error(`[ReviewDialog] Failed to upload containment file ${file.name}:`, error);
            throw error;
          });
        uploadPromises.push(promise);
      });

      // Upload root cause files
      rootCauseFiles.forEach(({ id, file }) => {
        const promise = apiClient
          .uploadFile(file, finalOrgId, finalProcessId, issueId, "rootCause")
          .then((result) => {
            setUploadProgress((prev) => ({ ...prev, [id]: 100 }));
            return { id, result };
          })
          .catch((error) => {
            console.error(`[ReviewDialog] Failed to upload root cause file ${file.name}:`, error);
            throw error;
          });
        uploadPromises.push(promise);
      });

      // Upload action plan files
      actionPlans.forEach((plan) => {
        plan.files.forEach(({ id, file }) => {
          const promise = apiClient
            .uploadFile(file, finalOrgId, finalProcessId, issueId, "actionPlan")
            .then((result) => {
              setUploadProgress((prev) => ({ ...prev, [id]: 100 }));
              return { planId: plan.id, id, result };
            })
            .catch((error) => {
              console.error(`[ReviewDialog] Failed to upload action plan file ${file.name}:`, error);
              throw error;
            });
          uploadPromises.push(promise);
        });
      });

      // Wait for all uploads to complete with better error handling
      // Use Promise.allSettled to continue even if some uploads fail
      let successfulResults: any[] = [];
      
      if (uploadPromises.length > 0) {
        const uploadResults = await Promise.allSettled(uploadPromises);
        
        // Check for failed uploads
        const failedUploads = uploadResults.filter((result) => result.status === 'rejected');
        if (failedUploads.length > 0) {
          console.error('[ReviewDialog] Some file uploads failed:', failedUploads);
          const failedFileNames = failedUploads.map((result) => {
            if (result.status === 'rejected') {
              return result.reason?.message || 'Unknown file';
            }
            return 'Unknown file';
          });
          toast.error(`Failed to upload ${failedUploads.length} file(s): ${failedFileNames.join(', ')}`);
          setUploadingFiles(false);
          setUploadProgress({});
          setIsSubmitting(false);
          return;
        }
        
        // Extract successful results (all are fulfilled at this point)
        successfulResults = uploadResults
          .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
          .map((result) => result.value);
      }

      // Map upload results to file metadata
      // Add safety checks to ensure result and file exist
      console.log('[ReviewDialog] Processing upload results:', successfulResults.length, 'successful uploads');
      
      const containmentUploads = successfulResults
        .filter((r) => {
          const isValid = r && !r.planId && r.result && r.result.file && containmentFiles.some((f) => f.id === r.id);
          if (!isValid && r) {
            console.warn('[ReviewDialog] Invalid containment upload result:', r);
          }
          return isValid;
        })
        .map((r) => {
          const file = r.result.file;
          if (!file || !file.name) {
            console.error('[ReviewDialog] Missing file data in result:', r);
            return null;
          }
          return file;
        })
        .filter((file): file is NonNullable<typeof file> => file !== null && file.name !== undefined);

      const rootCauseUploads = successfulResults
        .filter((r) => {
          const isValid = r && !r.planId && r.result && r.result.file && rootCauseFiles.some((f) => f.id === r.id);
          if (!isValid && r) {
            console.warn('[ReviewDialog] Invalid root cause upload result:', r);
          }
          return isValid;
        })
        .map((r) => {
          const file = r.result.file;
          if (!file || !file.name) {
            console.error('[ReviewDialog] Missing file data in result:', r);
            return null;
          }
          return file;
        })
        .filter((file): file is NonNullable<typeof file> => file !== null && file.name !== undefined);

      // Group action plan uploads by plan ID
      const actionPlanUploadsMap: { [planId: string]: any[] } = {};
      successfulResults
        .filter((r) => r && r.planId && r.result && r.result.file)
        .forEach((r) => {
          if (!actionPlanUploadsMap[r.planId]) {
            actionPlanUploadsMap[r.planId] = [];
          }
          const file = r.result.file;
          if (file && file.name) {
            actionPlanUploadsMap[r.planId].push(file);
          } else {
            console.error('[ReviewDialog] Missing file data in action plan result:', r);
          }
        });

      // Prepare file metadata - merge existing files with newly uploaded files
      // Now includes S3 keys for secure downloads
      const containmentFilesData = [
        ...existingContainmentFiles, // Keep existing files (already have keys)
        ...containmentUploads.map((upload) => ({
          name: upload.name,
          size: upload.size,
          type: upload.type,
          key: upload.key, // S3 key for secure downloads
        })),
      ];

      const rootCauseFilesData = [
        ...existingRootCauseFiles, // Keep existing files (already have keys)
        ...rootCauseUploads.map((upload) => ({
          name: upload.name,
          size: upload.size,
          type: upload.type,
          key: upload.key, // S3 key for secure downloads
        })),
      ];

      const actionPlansData = actionPlans.map((plan) => ({
        action: plan.action,
        responsible: plan.responsible,
        plannedDate: plan.plannedDate,
        actualDate: plan.actualDate,
        // Merge existing files with newly uploaded files
        files: [
          ...(plan.existingFiles || []), // Keep existing files (already have keys)
          ...(actionPlanUploadsMap[plan.id] || []).map((upload) => ({
            name: upload.name,
            size: upload.size,
            type: upload.type,
            key: upload.key, // S3 key for secure downloads
          })),
        ],
      }));

      // Save review data to database
      await apiClient.saveIssueReview(finalOrgId, finalProcessId, issueId, {
        containmentText: trimmedContainmentText,
        rootCauseText: rootCauseText && rootCauseText.trim() ? rootCauseText.trim() : undefined,
        containmentFiles: containmentFilesData,
        rootCauseFiles: rootCauseFilesData,
        actionPlans: actionPlansData,
      });

      toast.success("Review data saved successfully");
      
      setUploadingFiles(false);
      setUploadProgress({});
      
      // Call onSubmit callback to finalize status update
      // This will queue the status change and close the dialog
      // Form will be reset when dialog closes (in handleClose)
      onSubmit();
    } catch (error: any) {
      console.error("Error saving review data:", error);
      toast.error(error.message || "Failed to save review data");
      setUploadingFiles(false);
      setUploadProgress({});
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Reset form when closing
    setContainmentText("");
    setRootCauseText("");
    setContainmentFiles([]);
    setRootCauseFiles([]);
    setActionPlans([
      {
        id: crypto.randomUUID(),
        action: "",
        responsible: "",
        plannedDate: "",
        actualDate: "",
        files: [],
      },
    ]);
    onOpenChange(false);
  };

  const handleCancel = () => {
    handleClose();
    onCancel();
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={(isOpen) => {
        // Prevent closing without submission - force cancel to revert status
        if (!isOpen && !isSubmitting) {
          handleCancel();
        }
      }}
    >
      <DialogContent className="max-w-4xl! max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Containment / Immediate Correction</DialogTitle>
          <DialogDescription>
            Immediate actions taken to control the issue and prevent further impact until a permanent solution is applied.
            {isLoadingReview && <span className="text-sm text-muted-foreground"> (Loading existing data...)</span>}
          </DialogDescription>
        </DialogHeader>
        
        {isLoadingReview && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading existing review data...</p>
          </div>
        )}
        
        {!isLoadingReview && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Containment Section */}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Containment / Immediate Correction <span className="text-red-500">*</span>
            </label>
            <Textarea
              placeholder="Describe the immediate corrective action taken to control the issue and prevent further impact..."
              value={containmentText}
              onChange={(e) => setContainmentText(e.target.value)}
              className="min-h-[120px]"
              required
            />
            {!containmentText.trim() && (
              <p className="text-xs text-muted-foreground mt-1">
                This field is required. Please describe the immediate actions taken.
              </p>
            )}
          </div>

          <input
            type="file"
            multiple
            hidden
            ref={fileInputRef1}
            onChange={(e) => {
              handleFiles(e.target.files, setContainmentFiles, fileInputRef1);
            }}
          />

          <div
            onClick={() => fileInputRef1.current?.click()}
            className="cursor-pointer border border-dashed rounded-lg p-6 text-center hover:bg-muted"
          >
            <Upload className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Drag & drop or browse</p>
          </div>

          {/* Show existing files from database */}
          {existingContainmentFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Previously uploaded files:</p>
              {existingContainmentFiles.map((fileMeta: ExistingFileMetadata, index: number) => (
                <div key={`existing-${index}`} className="flex items-center justify-between border rounded-md px-3 py-2 bg-muted/50 hover:bg-muted/70 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{fileMeta.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(fileMeta.size / 1024).toFixed(1)} KB {fileMeta.type && `• ${fileMeta.type.split('/')[1]?.toUpperCase() || fileMeta.type}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    {fileMeta.key && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={async () => {
                          try {
                            const result = await apiClient.getFileDownloadUrl(fileMeta.key!);
                            window.open(result.url, "_blank");
                          } catch (error: any) {
                            toast.error("Failed to download file");
                          }
                        }}
                      >
                        Download
                      </Button>
                    )}
                    <Badge variant="secondary" className="text-xs">Saved</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Show newly uploaded files */}
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
          <Textarea
            placeholder="Explain the root cause of the issue..."
            value={rootCauseText}
            onChange={(e) => setRootCauseText(e.target.value)}
          />

          <input
            type="file"
            multiple
            hidden
            ref={fileInputRef2}
            onChange={(e) => {
              handleFiles(e.target.files, setRootCauseFiles, fileInputRef2);
            }}
          />

          <div
            onClick={() => fileInputRef2.current?.click()}
            className="cursor-pointer border border-dashed rounded-lg p-6 text-center hover:bg-muted"
          >
            <Upload className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Drag & drop or browse</p>
          </div>

          {/* Show existing files from database */}
          {existingRootCauseFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Previously uploaded files:</p>
              {existingRootCauseFiles.map((fileMeta: ExistingFileMetadata, index: number) => (
                <div key={`existing-root-${index}`} className="flex items-center justify-between border rounded-md px-3 py-2 bg-muted/50 hover:bg-muted/70 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{fileMeta.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(fileMeta.size / 1024).toFixed(1)} KB {fileMeta.type && `• ${fileMeta.type.split('/')[1]?.toUpperCase() || fileMeta.type}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    {fileMeta.key && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={async () => {
                          try {
                            const result = await apiClient.getFileDownloadUrl(fileMeta.key!);
                            window.open(result.url, "_blank");
                          } catch (error: any) {
                            toast.error("Failed to download file");
                          }
                        }}
                      >
                        Download
                      </Button>
                    )}
                    <Badge variant="secondary" className="text-xs">Saved</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Show newly uploaded files */}
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
                    onChange={(e) => handleActionFileUpload(row.id, e.target.files, e.target)}
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

              {/* Show existing files from database */}
              {row.existingFiles && row.existingFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Previously uploaded files:</p>
                  {row.existingFiles.map((fileMeta: ExistingFileMetadata, index: number) => (
                    <div key={`existing-action-${row.id}-${index}`} className="flex items-center justify-between border rounded-md px-3 py-2 bg-muted/50 hover:bg-muted/70 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{fileMeta.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(fileMeta.size / 1024).toFixed(1)} KB {fileMeta.type && `• ${fileMeta.type.split('/')[1]?.toUpperCase() || fileMeta.type}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        {fileMeta.key && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={async () => {
                              try {
                                const result = await apiClient.getFileDownloadUrl(fileMeta.key!);
                                window.open(result.url, "_blank");
                              } catch (error: any) {
                                toast.error("Failed to download file");
                              }
                            }}
                          >
                            Download
                          </Button>
                        )}
                        <Badge variant="secondary" className="text-xs">Saved</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Show newly uploaded files */}
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
          <Button variant="ghost" onClick={handleCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || isLoadingReview || uploadingFiles}>
            {uploadingFiles ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Uploading files...
              </>
            ) : isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Submitting...
              </>
            ) : (
              "Submit to Issuer"
            )}
          </Button>
        </div>
          </div>
        )}
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
