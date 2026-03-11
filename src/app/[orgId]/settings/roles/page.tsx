"use client";

/**
 * ARCHITECTURE EXPLANATION:
 * =========================
 * 
 * Leadership = Organization-level identity
 * - Leadership levels (Top, Operational, Support) are defined at the ORGANIZATION level
 * - They are NOT site-specific
 * - Leadership determines organizational hierarchy and authority
 * 
 * RBAC = System authority
 * - System roles (Admin, Manager, Member) are derived from Leadership levels
 * - RBAC controls what actions users can perform in VApps
 * - Separate from Leadership but derived from it
 * 
 * Site = Scope
 * - Sites only assign users (scope of work)
 * - Sites do NOT define roles or leadership levels
 * - Sites show assigned users with their org-level leadership tier (read-only)
 * 
 * Functional roles = Workflow responsibility
 * - Functional roles (Audit Lead, Issue Assignee, etc.) are workflow-specific
 * - These are separate from Leadership and RBAC
 * - Managed at process/audit level
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Edit, X, Info, ChevronRight, Plus, Shield } from "lucide-react";
import { getSystemRoleForLevel, getFocusForLevel } from "@/lib/role-mappings";

// Leadership Level to System Role mapping (for display; canonical map is in role-mappings.ts)
const leadershipToRoleMap = {
  1: "Admin",
  2: "Manager",
  3: "Member",
} as const;

type RoleLevel = keyof typeof leadershipToRoleMap;
type SystemRole = typeof leadershipToRoleMap[RoleLevel];

interface Role {
  id: string;
  roleName: string;
  leadershipLevel: RoleLevel;
  systemRole: SystemRole;
  focus: string;
  description: string | null;
  accessDescription: string | null;
  isPreset: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}


const leadershipLevelLabels = {
  1: "Top Leadership",
  2: "Operational Leadership",
  3: "Support Leadership",
} as const;

const leadershipLevelColors = {
  1: "bg-purple-100 text-purple-700 border-purple-200",
  2: "bg-blue-100 text-blue-700 border-blue-200",
  3: "bg-gray-100 text-gray-700 border-gray-200",
} as const;

export default function RoleManagementPage() {
  const params = useParams();
  const orgId = params?.orgId as string;
  const [roles, setRoles] = useState<Role[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDisableDialogOpen, setIsDisableDialogOpen] = useState(false);
  const [roleToDisable, setRoleToDisable] = useState<Role | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // New role form state
  const [newRole, setNewRole] = useState({
    roleName: "",
    leadershipLevel: "1" as "1" | "2" | "3",
    systemRole: "Admin" as SystemRole,
    focus: "Strategy & Governance" as "Strategy & Governance" | "Tactical Deployment" | "Daily Execution",
    description: "",
    accessDescription: "",
  });

  // TODO: Replace with actual current user role_level from auth context
  // For now, defaulting to level 1 (Top Leadership) to allow all role management
  const currentUserRoleLevel: RoleLevel = 1;

  // Fetch roles from API
  useEffect(() => {
    if (orgId) {
      fetchRoles();
    }
  }, [orgId]);

  const fetchRoles = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get<{ roles: Role[] }>(`/organization/${orgId}/roles`);
      setRoles(response.roles || []);
    } catch (error: any) {
      console.error("Error fetching roles:", error);
      toast.error(error.message || "Failed to load roles");
    } finally {
      setIsLoading(false);
    }
  };

  // Permission logic
  const canManageRole = (targetRoleLevel: RoleLevel): boolean => {
    if (currentUserRoleLevel === 1) return true; // Level 1 can manage all roles
    if (currentUserRoleLevel === 2) return targetRoleLevel === 3; // Level 2 can manage level 3 only
    return false; // Level 3 has no role management access
  };

  const canEditRole = (role: Role): boolean => {
    return canManageRole(role.leadershipLevel);
  };

  const canDisableRole = (role: Role): boolean => {
    return canManageRole(role.leadershipLevel);
  };

  const canDeleteRole = (role: Role): boolean => {
    // Only non-preset roles can be deleted
    return !role.isPreset && canManageRole(role.leadershipLevel);
  };

  // Filter roles by search query
  const filteredRoles = roles.filter((role) =>
    role.roleName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    role.focus.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group roles by leadership level
  const groupedRoles = filteredRoles.reduce((acc, role) => {
    if (!acc[role.leadershipLevel]) {
      acc[role.leadershipLevel] = [];
    }
    acc[role.leadershipLevel].push(role);
    return acc;
  }, {} as Record<RoleLevel, Role[]>);

  const handleCreateRole = async () => {
    const level = parseInt(newRole.leadershipLevel) as 1 | 2 | 3;
    const payload = {
      ...newRole,
      leadershipLevel: newRole.leadershipLevel,
      systemRole: getSystemRoleForLevel(level),
      focus: getFocusForLevel(level),
    };
    try {
      await apiClient.post(`/organization/${orgId}/roles`, payload);
      toast.success("Role created successfully");
      setIsCreateDialogOpen(false);
      setNewRole({
        roleName: "",
        leadershipLevel: "1",
        systemRole: "Admin",
        focus: "Strategy & Governance",
        description: "",
        accessDescription: "",
      });
      fetchRoles();
    } catch (error: any) {
      console.error("Error creating role:", error);
      toast.error(error.message || "Failed to create role");
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    try {
      setIsDeleting(roleId);
      await apiClient.delete(`/organization/${orgId}/roles/${roleId}`);
      toast.success("Role deleted successfully");
      fetchRoles();
    } catch (error: any) {
      console.error("Error deleting role:", error);
      toast.error(error.message || "Failed to delete role");
    } finally {
      setIsDeleting(null);
    }
  };

  const getSystemRoleBadgeColor = (role: SystemRole) => {
    switch (role) {
      case "Admin":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "Manager":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "Member":
        return "bg-gray-100 text-gray-700 border-gray-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const handleEdit = (role: Role) => {
    if (canEditRole(role)) {
      setEditingRole({ ...role });
      setIsEditDialogOpen(true);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingRole) return;

    const level = editingRole.leadershipLevel;
    const systemRole = getSystemRoleForLevel(level);
    const focus = getFocusForLevel(level);

    try {
      await apiClient.put(`/organization/${orgId}/roles/${editingRole.id}`, {
        roleName: editingRole.roleName,
        leadershipLevel: editingRole.leadershipLevel.toString(),
        systemRole,
        focus,
        description: editingRole.description || "",
        accessDescription: editingRole.accessDescription || "",
        isActive: editingRole.isActive,
      });
      toast.success("Role updated successfully");
      setIsEditDialogOpen(false);
      setEditingRole(null);
      fetchRoles();
    } catch (error: any) {
      console.error("Error updating role:", error);
      toast.error(error.message || "Failed to update role");
    }
  };

  const handleDisable = (role: Role) => {
    if (canDisableRole(role)) {
      setRoleToDisable(role);
      setIsDisableDialogOpen(true);
    }
  };

  const confirmDisable = async () => {
    if (!roleToDisable) return;

    try {
      await apiClient.put(`/organization/${orgId}/roles/${roleToDisable.id}`, {
        isActive: false,
      });
      toast.success("Role disabled successfully");
      setIsDisableDialogOpen(false);
      setRoleToDisable(null);
      fetchRoles();
    } catch (error: any) {
      console.error("Error disabling role:", error);
      toast.error(error.message || "Failed to disable role");
    }
  };

  const handleEnable = async (role: Role) => {
    if (!canDisableRole(role)) return;

    try {
      await apiClient.put(`/organization/${orgId}/roles/${role.id}`, {
        isActive: true,
      });
      toast.success("Role enabled successfully");
      fetchRoles();
    } catch (error: any) {
      console.error("Error enabling role:", error);
      toast.error(error.message || "Failed to enable role");
    }
  };

  return (
    <div className="space-y-6 px-5">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link
              href={`/dashboard/${orgId}`}
              className="hover:text-gray-700 transition-colors"
            >
              Dashboard
            </Link>
            <ChevronRight className="h-4 w-4" />
            <Link
              href={`/dashboard/${orgId}/settings`}
              className="hover:text-gray-700 transition-colors"
            >
              Settings
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-gray-900 font-medium">Roles</span>
          </div>
          <div className="flex items-start gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Role Management</h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage organizational leadership roles. Leadership is defined at organization level, not site level.
              </p>
            </div>
          </div>
        </div>
        {currentUserRoleLevel === 1 && (
          <Button 
            className="bg-black text-white hover:bg-gray-800 flex items-center gap-2"
            onClick={() => setIsCreateDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add Role
          </Button>
        )}
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search roles by name or focus..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Shield className="h-4 w-4" />
              <span>
                {filteredRoles.length} role{filteredRoles.length !== 1 ? "s" : ""} found
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Roles by Leadership Level */}
      <Card>
        <CardHeader>
          <CardTitle>Roles by Leadership Level</CardTitle>
          <CardDescription>
            Leadership roles are organization-level. Sites assign users but do not define roles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" defaultValue={["1", "2", "3"]} className="w-full">
            {([1, 2, 3] as RoleLevel[]).map((level) => {
              const levelRoles = groupedRoles[level] || [];
              if (levelRoles.length === 0 && searchQuery) return null;

              return (
                <AccordionItem key={level} value={level.toString()} className="border-b">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-4 w-full">
                      <Badge
                        variant="outline"
                        className={leadershipLevelColors[level]}
                      >
                        Level {level}
                      </Badge>
                      <span className="font-semibold text-lg">
                        {leadershipLevelLabels[level]}
                      </span>
                      <span className="text-sm text-gray-500 ml-auto">
                        {levelRoles.length} role{levelRoles.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Role Name</TableHead>
                          <TableHead>Leadership Level</TableHead>
                          <TableHead>System Role</TableHead>
                          <TableHead>Focus</TableHead>
                          <TableHead className="w-12"></TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {levelRoles.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                              {isLoading ? "Loading..." : "No roles found in this level"}
                            </TableCell>
                          </TableRow>
                        ) : (
                          levelRoles.map((role) => (
                            <TableRow key={role.id} className={role.isActive ? "" : "opacity-50"}>
                              <TableCell>
                                <div className="font-medium">{role.roleName}</div>
                                <div className="flex items-center gap-2 mt-1">
                                  {!role.isActive && (
                                    <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600">
                                      Disabled
                                    </Badge>
                                  )}
                                  {role.isPreset && (
                                    <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700">
                                      Preset
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={leadershipLevelColors[role.leadershipLevel]}
                                >
                                  Level {role.leadershipLevel}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={getSystemRoleBadgeColor(role.systemRole)}
                                >
                                  {role.systemRole}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-gray-600">{role.focus}</TableCell>
                              <TableCell>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="h-4 w-4 text-gray-400 cursor-help hover:text-gray-600 transition-colors" />
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-sm">
                                    <div className="space-y-2">
                                      <p className="font-semibold">{role.roleName}</p>
                                      <p className="text-xs">{role.description || "No description"}</p>
                                      <div className="pt-2 border-t">
                                        <p className="text-xs font-medium mb-1">System Access:</p>
                                        <p className="text-xs">{role.accessDescription || "No access description"}</p>
                                      </div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-end gap-2">
                                  {canEditRole(role) && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() => handleEdit(role)}
                                        >
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Edit role</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                  {canDisableRole(role) && (
                                    <>
                                      {role.isActive ? (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-8 w-8 text-red-500 hover:text-red-700"
                                              onClick={() => handleDisable(role)}
                                            >
                                              <X className="h-4 w-4" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Disable role</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      ) : (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-8 w-8 text-green-600 hover:text-green-700"
                                              onClick={() => handleEnable(role)}
                                            >
                                              <Shield className="h-4 w-4" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Enable role</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      )}
                                    </>
                                  )}
                                  {canDeleteRole(role) && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-red-600 hover:text-red-800"
                                          onClick={() => handleDeleteRole(role.id)}
                                          disabled={isDeleting === role.id}
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Delete role</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                  {!canEditRole(role) && !canDisableRole(role) && !canDeleteRole(role) && (
                                    <span className="text-xs text-gray-400">No access</span>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>

      {/* Edit Role Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>
              Update role details. System Role and Focus are determined by the selected leadership level.
            </DialogDescription>
          </DialogHeader>
          {editingRole && (
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Role Name</label>
                <Input
                  value={editingRole.roleName}
                  onChange={(e) =>
                    setEditingRole({ ...editingRole, roleName: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Leadership Level</label>
                <Select
                  value={editingRole.leadershipLevel.toString()}
                  onValueChange={(value) => {
                    const newLevel = parseInt(value) as RoleLevel;
                    setEditingRole({
                      ...editingRole,
                      leadershipLevel: newLevel,
                      systemRole: getSystemRoleForLevel(newLevel),
                      focus: getFocusForLevel(newLevel),
                    });
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select leadership level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Level 1 - Top Leadership</SelectItem>
                    <SelectItem value="2">Level 2 - Operational Leadership</SelectItem>
                    <SelectItem value="3">Level 3 - Support Leadership</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  System Role and Focus are determined by the selected leadership level.
                </p>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">System Role</label>
                <Input
                  value={getSystemRoleForLevel(editingRole.leadershipLevel)}
                  readOnly
                  disabled
                  className="bg-muted cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Focus</label>
                <Input
                  value={getFocusForLevel(editingRole.leadershipLevel)}
                  readOnly
                  disabled
                  className="bg-muted cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Description</label>
                <Textarea
                  className="min-h-[80px]"
                  value={editingRole.description || ""}
                  onChange={(e) =>
                    setEditingRole({ ...editingRole, description: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Access Description</label>
                <Textarea
                  className="min-h-[60px]"
                  value={editingRole.accessDescription || ""}
                  onChange={(e) =>
                    setEditingRole({ ...editingRole, accessDescription: e.target.value })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable Role Dialog */}
      <Dialog open={isDisableDialogOpen} onOpenChange={setIsDisableDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable Role</DialogTitle>
            <DialogDescription>
              Are you sure you want to disable this role? Users with this role will retain their access, but new assignments will be prevented.
            </DialogDescription>
          </DialogHeader>
          {roleToDisable && (
            <div className="py-4">
              <p className="font-medium">{roleToDisable.roleName}</p>
              <p className="text-sm text-gray-500 mt-1">{roleToDisable.description || "No description"}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDisableDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDisable}>
              Disable Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Role Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Role</DialogTitle>
            <DialogDescription>
              Add a new organizational leadership role. System Role and Focus are determined by the selected leadership level.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Role Name</label>
              <Input
                value={newRole.roleName}
                onChange={(e) =>
                  setNewRole({ ...newRole, roleName: e.target.value })
                }
                placeholder="e.g., VP Engineering"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Leadership Level</label>
              <Select
                value={newRole.leadershipLevel}
                onValueChange={(value) => {
                  const level = parseInt(value) as RoleLevel;
                  setNewRole({
                    ...newRole,
                    leadershipLevel: value as "1" | "2" | "3",
                    systemRole: getSystemRoleForLevel(level),
                    focus: getFocusForLevel(level),
                  });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select leadership level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Level 1 - Top Leadership</SelectItem>
                  <SelectItem value="2">Level 2 - Operational Leadership</SelectItem>
                  <SelectItem value="3">Level 3 - Support Leadership</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                System Role and Focus are determined by the selected leadership level.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">System Role</label>
              <Input
                value={getSystemRoleForLevel(parseInt(newRole.leadershipLevel) as RoleLevel)}
                readOnly
                disabled
                className="bg-muted cursor-not-allowed"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Focus</label>
              <Input
                value={getFocusForLevel(parseInt(newRole.leadershipLevel) as RoleLevel)}
                readOnly
                disabled
                className="bg-muted cursor-not-allowed"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Description</label>
              <Textarea
                className="min-h-[80px]"
                value={newRole.description}
                onChange={(e) =>
                  setNewRole({ ...newRole, description: e.target.value })
                }
                placeholder="Describe the role's responsibilities..."
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Access Description</label>
              <Textarea
                className="min-h-[60px]"
                value={newRole.accessDescription}
                onChange={(e) =>
                  setNewRole({ ...newRole, accessDescription: e.target.value })
                }
                placeholder="Describe the system access level..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateRole}
              disabled={!newRole.roleName.trim()}
            >
              Create Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
