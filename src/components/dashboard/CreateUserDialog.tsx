"use client";

/**
 * CreateUserDialog – Leadership Hierarchy aligned
 *
 * PHASE 1 SCOPE POLICY
 * ====================
 * Top Leadership    → All sites & all processes (no selectors)
 * Operational       → 1 site, multiple processes (single site + multi process)
 * Support           → 1 site, 1 process (single site + single process required)
 *
 * Leadership defines identity. Site & Process define scope.
 *
 * ARCHITECTURE:
 * - Leadership = Organization-level identity
 * - Site = Operational scope
 * - Process = Operational responsibility
 * - RBAC = System authority (derived from leadership level)
 * - No site-based role definitions
 */

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

// Leadership level constants (organization-level identity)
const LEADERSHIP_TOP = 1;
const LEADERSHIP_OPERATIONAL = 2;
const LEADERSHIP_SUPPORT = 3;

// Job Title → Leadership Level (org-level, not site-based)
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

// RBAC: System role derived from leadership level (separate from site scope)
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

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  currentUserRole: SystemRole;
  canManageTeams?: boolean; // Permission flag for manage_teams
  onUserCreated?: () => void;
}

interface FormErrors {
  fullName?: string;
  email?: string;
  jobTitle?: string;
  organization?: string;
  site?: string;
  process?: string;
}

export default function CreateUserDialog({
  open,
  onOpenChange,
  orgId,
  currentUserRole,
  canManageTeams = false,
  onUserCreated,
}: CreateUserDialogProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState<JobTitle | "">("");
  const [organization, setOrganization] = useState("");
  const [site, setSite] = useState("");
  const [selectedProcesses, setSelectedProcesses] = useState<string[]>([]);
  const [process, setProcess] = useState("");
  const [sites, setSites] = useState<Site[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [additionalRoles, setAdditionalRoles] = useState<{ id: string; name: string }[]>([]);
  const [selectedAdditionalRoleIds, setSelectedAdditionalRoleIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [orgName, setOrgName] = useState("");

  // Permission checks: Use actual permission flag (canManageTeams) instead of just role
  // Admin can create all users, Manager can create Members, Member can create if they have manage_teams permission
  const canCreateAllUsers = currentUserRole === "Admin";
  const canCreateMembersOnly = currentUserRole === "Manager";
  const cannotCreateUsers = !canManageTeams && currentUserRole === "Member";

  // Derived: leadership level and RBAC system role (org-level)
  const roleLevel: RoleLevel | null = jobTitle ? jobTitleToRoleLevel[jobTitle] : null;
  const systemRole: SystemRole | null = roleLevel ? roleLevelToSystemRole[roleLevel] : null;

  // Leadership tier flags. Every user (including Top/Admin) must have one site and one process except Owner.
  const isTopLeadership = roleLevel === LEADERSHIP_TOP;
  const isOperationalLeadership = roleLevel === LEADERSHIP_OPERATIONAL;
  const isSupportLeadership = roleLevel === LEADERSHIP_SUPPORT;

  // Check if current user can create this role
  const canCreateThisRole = (targetRole: SystemRole | null): boolean => {
    if (!targetRole) return false;
    if (canCreateAllUsers) return true;
    if (canCreateMembersOnly && targetRole === "Member") return true;
    // Member role users can create users if they have manage_teams permission
    if (currentUserRole === "Member" && canManageTeams && targetRole === "Member") return true;
    return false;
  };

  // Fetch sites, organization, and additional roles
  useEffect(() => {
    if (open && orgId) {
      const fetchData = async () => {
        try {
          const [sitesResponse, rolesResponse] = await Promise.all([
            apiClient.getSites(orgId),
            apiClient.get<{ additionalRoles: { id: string; name: string }[] }>(`/organization/${orgId}/additional-roles`).catch(() => ({ additionalRoles: [] })),
          ]);
          setSites(sitesResponse.sites || []);
          setOrganization(orgId);
          if (sitesResponse.organization) {
            setOrgName(sitesResponse.organization.name || "");
          }
          setAdditionalRoles(rolesResponse.additionalRoles ?? []);
        } catch (error) {
          console.error("Error fetching sites:", error);
        }
      };
      fetchData();
    }
  }, [open, orgId]);

  // Site context for process fetch: all tiers (including Top) need site + process
  const siteForProcess = site;

  // Fetch processes when a site is selected (Operational or Support)
  useEffect(() => {
    if (siteForProcess && orgId) {
      const fetchProcesses = async () => {
        try {
          const processesResponse = await apiClient.getProcesses(orgId, siteForProcess);
          setProcesses(processesResponse.processes || []);
        } catch (error) {
          console.error("Error fetching processes:", error);
          setProcesses([]);
        }
      };
      fetchProcesses();
    } else {
      setProcesses([]);
      setProcess("");
      setSelectedProcesses([]);
    }
  }, [siteForProcess, orgId]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setFullName("");
      setEmail("");
      setJobTitle("");
      setSite("");
      setSelectedProcesses([]);
      setProcess("");
      setSelectedAdditionalRoleIds([]);
      setErrors({});
    }
  }, [open]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Common validations (all tiers)
    if (!fullName.trim()) {
      newErrors.fullName = "Full name is required";
    }
    if (!email.trim()) {
      newErrors.email = "Email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email address";
    }
    if (!jobTitle) {
      newErrors.jobTitle = "Job title is required";
    }
    if (!organization) {
      newErrors.organization = "Organization is required";
    }

    // Every user (Admin, Manager, Member) must have one site and one process. Owner is not invited from this dialog.
    if (!site) {
      newErrors.site = "Select one site.";
    }
    if (!process) {
      newErrors.process = "Select one process.";
    }

    // Permission check (all tiers)
    if (jobTitle && systemRole && !canCreateThisRole(systemRole)) {
      newErrors.jobTitle = `You don't have permission to create ${systemRole} users. ${canCreateMembersOnly ? "You can only create Member users." : ""}`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !roleLevel || !systemRole) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      // Every user (Admin, Manager, Member) gets one site and one process. Owner is not invited from this dialog.
      const siteId = site || null;
      const processId = process || null;

      const jobTitleToSend = jobTitle && jobTitle.trim() !== "" ? String(jobTitle).trim() : null;

      await apiClient.post("/invites", {
        orgId,
        email: email.trim(),
        fullName: fullName.trim(),
        siteId,
        processId,
        role: systemRole.toLowerCase(),
        jobTitle: jobTitleToSend,
        additionalRoleIds: selectedAdditionalRoleIds.length > 0 ? selectedAdditionalRoleIds : undefined,
      });

      setFullName("");
      setEmail("");
      setJobTitle("");
      setSite("");
      setSelectedProcesses([]);
      setProcess("");
      setSelectedAdditionalRoleIds([]);
      setErrors({});
      toast.success("Invitation sent successfully.");
      onOpenChange(false);
      onUserCreated?.();
    } catch (error: any) {
      console.error("Error sending invitation:", error);
      const message = error?.message || "Failed to send invitation. Please try again.";
      setErrors({ email: message });
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJobTitleChange = (value: string) => {
    setJobTitle(value as JobTitle);
    setSite("");
    setSelectedProcesses([]);
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
    setSelectedProcesses([]);
    setErrors((prev) => ({ ...prev, site: undefined, process: undefined }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
          <DialogDescription>
            Add a new user to your organization. System role is automatically assigned based on job title.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="fullName">
              Full Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (errors.fullName) {
                  setErrors({ ...errors, fullName: undefined });
                }
              }}
              placeholder="John Doe"
              className={errors.fullName ? "border-red-500" : ""}
            />
            {errors.fullName && (
              <div className="flex items-center gap-1 text-sm text-red-500">
                <AlertCircle className="h-4 w-4" />
                <span>{errors.fullName}</span>
              </div>
            )}
          </div>

          {/* Email Address */}
          <div className="space-y-2">
            <Label htmlFor="email">
              Email Address <span className="text-red-500">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) {
                  setErrors({ ...errors, email: undefined });
                }
              }}
              placeholder="john.doe@example.com"
              className={errors.email ? "border-red-500" : ""}
            />
            {errors.email && (
              <div className="flex items-center gap-1 text-sm text-red-500">
                <AlertCircle className="h-4 w-4" />
                <span>{errors.email}</span>
              </div>
            )}
          </div>

          {/* Job Title */}
          <div className="space-y-2">
            <Label htmlFor="jobTitle">
              <div className="flex items-center gap-2">
                <span>Job Title</span>
                <span className="text-red-500">*</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-gray-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Defines the user's business designation and determines their system role.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </Label>
            <Select value={jobTitle} onValueChange={handleJobTitleChange}>
              <SelectTrigger
                id="jobTitle"
                className={`w-full ${errors.jobTitle ? "border-red-500" : ""}`}
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
          </div>

          {/* Leadership Level (Auto-selected, Read-only) */}
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
                      <p>Determines the user's authority in the organization. Automatically set based on job title.</p>
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
                      <p>Controls what actions the user can perform in VApps. Automatically assigned based on leadership level.</p>
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

          {/* Organization */}
          <div className="space-y-2">
            <Label htmlFor="organization">
              Organization <span className="text-red-500">*</span>
            </Label>
            <Input
              id="organization"
              value={orgName || orgId}
              disabled
              className="bg-gray-50 cursor-not-allowed"
            />
          </div>

          {/* Every user must be assigned one site and one process (except Owner, who is not invited here). */}
          {roleLevel != null && (
            <>
              <div className="space-y-2">
                <Label htmlFor="site">
                  Site <span className="text-red-500">*</span>
                </Label>
                <p className="text-xs text-gray-500 mb-1">
                  Select the site where this user will operate.
                </p>
                <Select value={site} onValueChange={handleSiteChange}>
                  <SelectTrigger id="site" className={`w-full ${errors.site ? "border-red-500" : ""}`}>
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
                  <Label htmlFor="process">
                    Process <span className="text-red-500">*</span>
                  </Label>
                  <p className="text-xs text-gray-500 mb-1">
                    Select one process within this site.
                  </p>
                  <Select
                    value={process}
                    onValueChange={(v) => {
                      setProcess(v);
                      if (errors.process) setErrors((e) => ({ ...e, process: undefined }));
                    }}
                  >
                    <SelectTrigger id="process" className={`w-full ${errors.process ? "border-red-500" : ""}`}>
                      <SelectValue placeholder={processes.length === 0 ? "No processes available" : "Select one process"} />
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

              {/* Optional additional roles (e.g. Auditor) */}
              {additionalRoles.length > 0 && (
                <div className="space-y-2">
                  <Label>Additional roles (optional)</Label>
                  <p className="text-xs text-gray-500 mb-1">
                    Assign custom roles such as Auditor if needed.
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
            </>
          )}

          {/* Permission Warning */}
          {cannotCreateUsers && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex items-center gap-2 text-sm text-yellow-800">
                <AlertCircle className="h-4 w-4" />
                <span>You don't have permission to create users.</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || cannotCreateUsers || !!(systemRole && !canCreateThisRole(systemRole))}
            className="bg-black text-white hover:bg-gray-800"
          >
            {isLoading ? "Creating..." : "Create User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
