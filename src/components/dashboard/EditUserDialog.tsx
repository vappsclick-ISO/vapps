"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";

// Leadership level constants
const LEADERSHIP_TOP = 1;
const LEADERSHIP_OPERATIONAL = 2;
const LEADERSHIP_SUPPORT = 3;

// Job Title → Leadership Level mapping
const jobTitleToRoleLevel = {
  CEO: LEADERSHIP_TOP,
  CTO: LEADERSHIP_TOP,
  CFO: LEADERSHIP_TOP,
  VP: LEADERSHIP_OPERATIONAL,
  Director: LEADERSHIP_OPERATIONAL,
  "Plant Manager": LEADERSHIP_OPERATIONAL,
  Manager: LEADERSHIP_OPERATIONAL,
  Supervisor: LEADERSHIP_SUPPORT,
  "Team Lead": LEADERSHIP_SUPPORT,
  Coordinator: LEADERSHIP_SUPPORT,
} as const;

type JobTitle = keyof typeof jobTitleToRoleLevel;
type RoleLevel = 1 | 2 | 3;
type SystemRole = "Admin" | "Manager" | "Member";

const roleLevelToSystemRole: Record<RoleLevel, SystemRole> = {
  1: "Admin",
  2: "Manager",
  3: "Member",
};

interface Site {
  id: string;
  name: string;
  code: string;
}

interface Process {
  id: string;
  name: string;
}

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  userId: string;
  userName: string;
  userEmail: string;
  currentJobTitle?: string;
  currentLeadershipTier: "TOP" | "OPERATIONAL" | "SUPPORT" | "Top" | "Operational" | "Support";
  currentSiteId?: string;
  currentProcessId?: string;
  /** Current additional role names (e.g. ["Auditor"]) from the members API */
  currentAdditionalRoles?: string[];
  /** When true, user is the org owner editing their own profile; site/process/job title are optional and org role is not changed */
  isOwnerEditingSelf?: boolean;
  onUserUpdated?: () => void;
}

interface FormErrors {
  jobTitle?: string;
  site?: string;
  process?: string;
}

export default function EditUserDialog({
  open,
  onOpenChange,
  orgId,
  userId,
  userName,
  userEmail,
  currentJobTitle,
  currentLeadershipTier,
  currentSiteId,
  currentProcessId,
  currentAdditionalRoles,
  isOwnerEditingSelf = false,
  onUserUpdated,
}: EditUserDialogProps) {
  const [name, setName] = useState(userName || "");
  const [jobTitle, setJobTitle] = useState<JobTitle | "">(currentJobTitle as JobTitle || "");
  const [site, setSite] = useState(currentSiteId || "");
  const [process, setProcess] = useState(currentProcessId || "");
  const [sites, setSites] = useState<Site[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [additionalRoles, setAdditionalRoles] = useState<{ id: string; name: string }[]>([]);
  const [selectedAdditionalRoleIds, setSelectedAdditionalRoleIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Derived values. Every user (except Owner) has one site and one process.
  const roleLevel: RoleLevel | null = jobTitle ? jobTitleToRoleLevel[jobTitle] : null;
  const systemRole: SystemRole | null = roleLevel ? roleLevelToSystemRole[roleLevel] : null;

  // Load sites and additional roles when dialog opens
  useEffect(() => {
    if (open && orgId) {
      loadSites();
      apiClient
        .get<{ additionalRoles: { id: string; name: string }[] }>(`/organization/${orgId}/additional-roles`)
        .then((res) => setAdditionalRoles(res.additionalRoles ?? []))
        .catch(() => setAdditionalRoles([]));
    }
  }, [open, orgId]);

  useEffect(() => {
    if (open && orgId && site) {
      loadProcesses(site);
    } else {
      setProcesses([]);
    }
  }, [open, orgId, site]);

  // Reset form and sync additional role selection when dialog opens or user changes
  useEffect(() => {
    if (open) {
      setName(userName || "");
      setJobTitle((currentJobTitle as JobTitle) || "");
      setSite(currentSiteId || "");
      setProcess(currentProcessId || "");
      setErrors({});
      // selectedAdditionalRoleIds is synced when additionalRoles load (see effect below)
    }
  }, [open, userName, currentJobTitle, currentSiteId, currentProcessId]);

  // When we have both the role list and current user's roles, set selected ids (by matching names)
  useEffect(() => {
    if (!open || additionalRoles.length === 0) return;
    const names = currentAdditionalRoles ?? [];
    const ids = additionalRoles.filter((ar) => names.includes(ar.name)).map((ar) => ar.id);
    setSelectedAdditionalRoleIds(ids);
  }, [open, additionalRoles, currentAdditionalRoles]);

  const loadSites = async () => {
    try {
      const res = await apiClient.get<{ sites: Site[] }>(`/organization/${orgId}/sites`);
      setSites(res.sites || []);
    } catch (e: any) {
      console.error("Failed to load sites", e);
      toast.error("Failed to load sites");
    }
  };

  const loadProcesses = async (siteId: string) => {
    try {
      const res = await apiClient.getProcesses(orgId, siteId);
      setProcesses(res.processes || []);
    } catch (e: unknown) {
      console.error("Failed to load processes", e);
      toast.error("Failed to load processes");
      setProcesses([]);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!isOwnerEditingSelf && !jobTitle) {
      newErrors.jobTitle = "Job title is required";
    }

    // Every user (except owner editing self) must have one site and one process
    if (!isOwnerEditingSelf) {
      if (!site) newErrors.site = "Select one site";
      if (!process) newErrors.process = "Select one process";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!isOwnerEditingSelf && (!roleLevel || !systemRole)) return;

    setIsLoading(true);
    setErrors({});

    try {
      const jobTitleToSend = jobTitle && jobTitle.trim() !== "" ? String(jobTitle).trim() : null;
      const roleToSend = isOwnerEditingSelf ? "owner" : systemRole!.toLowerCase();

      await apiClient.put(`/organization/${orgId}/members/${userId}`, {
        name: name.trim() || userName.trim(),
        role: roleToSend,
        jobTitle: jobTitleToSend,
        siteId: site || null,
        processId: process || null,
        additionalRoleIds: selectedAdditionalRoleIds.length > 0 ? selectedAdditionalRoleIds : [],
      });

      toast.success("User updated successfully");
      onOpenChange(false);
      onUserUpdated?.();
    } catch (error: any) {
      console.error("Error updating user:", error);
      const message = error?.message || "Failed to update user. Please try again.";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJobTitleChange = (value: string) => {
    setJobTitle(value as JobTitle);
    setSite("");
    setProcess("");
    setErrors((prev) => ({
      ...prev,
      jobTitle: undefined,
      site: undefined,
      process: undefined,
    }));
  };

  const handleSiteChange = (value: string) => {
    setSite(value);
    setProcess("");
    loadProcesses(value);
    setErrors((prev) => ({ ...prev, site: undefined, process: undefined }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update user's job title, role, and site/process assignments.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* User Info */}
          <div className="space-y-2">
            <Label htmlFor="edit-name">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input 
              id="edit-name"
              value={name} 
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter user's full name"
            />
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={userEmail} disabled className="bg-gray-50 cursor-not-allowed" />
          </div>

          {/* Job Title (read-only for org owner editing self) */}
          <div className="space-y-2">
            <Label htmlFor="jobTitle">
              <div className="flex items-center gap-2">
                <span>Job Title</span>
                {!isOwnerEditingSelf && <span className="text-red-500">*</span>}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-gray-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isOwnerEditingSelf ? "Organization owner. You can set your site, process, and additional roles (e.g. Auditor) below." : "Defines the user's business designation and determines their system role."}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </Label>
            {isOwnerEditingSelf ? (
              <Input id="jobTitle" value="Owner" disabled className="bg-gray-50 cursor-not-allowed" />
            ) : (
              <>
                <Select value={jobTitle} onValueChange={handleJobTitleChange}>
                  <SelectTrigger
                    id="jobTitle"
                    className={errors.jobTitle ? "border-red-500" : ""}
                  >
                    <SelectValue placeholder="Select job title" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CEO">CEO</SelectItem>
                    <SelectItem value="CTO">CTO</SelectItem>
                    <SelectItem value="CFO">CFO</SelectItem>
                    <SelectItem value="VP">VP</SelectItem>
                    <SelectItem value="Director">Director</SelectItem>
                    <SelectItem value="Plant Manager">Plant Manager</SelectItem>
                    <SelectItem value="Manager">Manager</SelectItem>
                    <SelectItem value="Supervisor">Supervisor</SelectItem>
                    <SelectItem value="Team Lead">Team Lead</SelectItem>
                    <SelectItem value="Coordinator">Coordinator</SelectItem>
                  </SelectContent>
                </Select>
                {errors.jobTitle && (
                  <div className="flex items-center gap-1 text-sm text-red-500">
                    <AlertCircle className="h-4 w-4" />
                    <span>{errors.jobTitle}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Leadership Level (Read-only) */}
          {roleLevel && (
            <div className="space-y-2">
              <Label>
                <div className="flex items-center gap-2">
                  <span>Leadership Level</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-gray-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Automatically set based on job title.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </Label>
              <Input
                value={`Level ${roleLevel}`}
                disabled
                className="bg-gray-50 cursor-not-allowed"
              />
            </div>
          )}

          {/* System Role (Read-only) */}
          {systemRole && (
            <div className="space-y-2">
              <Label>
                <div className="flex items-center gap-2">
                  <span>System Role</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-gray-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Automatically assigned based on leadership level.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </Label>
              <Input
                value={systemRole}
                disabled
                className="bg-gray-50 cursor-not-allowed"
              />
            </div>
          )}

          {/* Site and Process – required for non-owner; optional for owner editing self */}
          {(roleLevel != null || isOwnerEditingSelf) && (
            <>
              <div className="space-y-2">
                <Label htmlFor="edit-site">
                  Site {!isOwnerEditingSelf && <span className="text-red-500">*</span>}
                </Label>
                <p className="text-xs text-gray-500 mb-1">
                  Select the site where this user operates.
                </p>
                <Select value={site} onValueChange={handleSiteChange}>
                  <SelectTrigger
                    id="edit-site"
                    className={`w-full ${errors.site ? "border-red-500" : ""}`}
                  >
                    <SelectValue placeholder="Select one site" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.site && (
                  <div className="flex items-center gap-1 text-sm text-red-500">
                    <AlertCircle className="h-4 w-4" />
                    <span>{errors.site}</span>
                  </div>
                )}
              </div>

              {site && (
                <div className="space-y-2">
                  <Label htmlFor="edit-process">
                    Process {!isOwnerEditingSelf && <span className="text-red-500">*</span>}
                  </Label>
                  <p className="text-xs text-gray-500 mb-1">
                    Select one process within this site.
                  </p>
                  <Select
                    value={process}
                    onValueChange={(v) => {
                      setProcess(v);
                      setErrors((prev) => ({ ...prev, process: undefined }));
                    }}
                  >
                    <SelectTrigger
                      id="edit-process"
                      className={`w-full ${errors.process ? "border-red-500" : ""}`}
                    >
                      <SelectValue placeholder={processes.length === 0 ? "No processes" : "Select one process"} />
                    </SelectTrigger>
                    <SelectContent>
                      {processes.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.process && (
                    <div className="flex items-center gap-1 text-sm text-red-500">
                      <AlertCircle className="h-4 w-4" />
                      <span>{errors.process}</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Additional roles (e.g. Auditor) */}
          {additionalRoles.length > 0 && (
            <div className="space-y-2">
              <Label>Additional roles (e.g. Auditor)</Label>
              <p className="text-xs text-gray-500 mb-1">
                Assign or remove custom roles such as Auditor.
              </p>
              <div className="flex flex-wrap gap-3 border rounded-md p-3 bg-gray-50/50">
                {additionalRoles.map((ar) => (
                  <label key={ar.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedAdditionalRoleIds.includes(ar.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedAdditionalRoleIds((prev) => [...prev, ar.id]);
                        } else {
                          setSelectedAdditionalRoleIds((prev) => prev.filter((id) => id !== ar.id));
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">{ar.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? "Updating..." : "Update User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
