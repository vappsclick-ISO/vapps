"use client";

/**
 * Teams & Roles – Team members, system role permissions (RBAC), and additional (custom) roles.
 * - Team members and stats from API; Invite User opens CreateUserDialog (site + process required for all except Owner; optional additional roles).
 * - RBAC permissions from API (read-only here; edit on Permissions page).
 * - Additional roles (e.g. Auditor) in a separate table; extensible for future custom roles.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Filter, Edit, Trash2, Mail, Shield, UserPlus, Plus, Loader2 } from "lucide-react";
import CreateUserDialog from "@/components/dashboard/CreateUserDialog";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  systemRole: string;
  status: "Active" | "Invited";
  lastActive: string;
  avatar?: string;
  additionalRoles?: string[];
}

interface PermissionRow {
  key: string;
  label: string;
  admin: boolean;
  manager: boolean;
  member: boolean;
}

interface AdditionalRole {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export default function TeamsRolesPage() {
  const params = useParams();
  const orgId = params?.orgId as string;
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [additionalRoles, setAdditionalRoles] = useState<AdditionalRole[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);
  const [canManageTeams, setCanManageTeams] = useState(false);
  const [currentUserSystemRole, setCurrentUserSystemRole] = useState<"Admin" | "Manager" | "Member">("Member");
  const [addRoleDialogOpen, setAddRoleDialogOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [addingRole, setAddingRole] = useState(false);

  useEffect(() => {
    if (orgId) {
      fetchData();
    }
  }, [orgId]);

  const fetchData = async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      const [membersRes, permsRes, rolesRes] = await Promise.all([
        apiClient.get<{ teamMembers: TeamMember[] }>(`/organization/${orgId}/members`),
        apiClient.get<{
          permissions: PermissionRow[];
          currentUserRole?: string;
          currentUserPermissions?: { manage_teams?: boolean };
        }>(`/organization/${orgId}/permissions`),
        apiClient.get<{ additionalRoles: AdditionalRole[] }>(`/organization/${orgId}/additional-roles`).catch(() => ({ additionalRoles: [] })),
      ]);
      setTeamMembers(membersRes.teamMembers ?? []);
      const perms = (permsRes.permissions ?? []).filter(
        (p) => p.key === "manage_teams" || p.key === "manage_sites" || p.key === "manage_processes"
      );
      setPermissions(perms);
      setAdditionalRoles(rolesRes.additionalRoles ?? []);
      setCanManageTeams(permsRes.currentUserPermissions?.manage_teams ?? false);
      const role = permsRes.currentUserRole;
      setCurrentUserSystemRole(role === "Admin" || role === "Manager" || role === "Member" ? role : "Member");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load data");
      setTeamMembers([]);
      setPermissions([]);
      setAdditionalRoles([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = teamMembers.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalUsers = teamMembers.length;
  const activeUsers = teamMembers.filter((m) => m.status === "Active").length;
  const pendingInvites = teamMembers.filter((m) => m.status === "Invited").length;
  const admins = teamMembers.filter((m) => m.systemRole === "Admin").length;

  const getRoleBadgeColor = (role: string) => {
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

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-700 border-green-200";
      case "Invited":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const handleAddAdditionalRole = async () => {
    const name = newRoleName.trim();
    if (!name) {
      toast.error("Role name is required");
      return;
    }
    try {
      setAddingRole(true);
      await apiClient.post(`/organization/${orgId}/additional-roles`, { name, description: newRoleDescription.trim() || null });
      toast.success("Role added");
      setAddRoleDialogOpen(false);
      setNewRoleName("");
      setNewRoleDescription("");
      await fetchData();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to add role");
    } finally {
      setAddingRole(false);
    }
  };

  return (
    <div className="p-6 space-y-6 bg-white min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="text-sm text-gray-500 mb-1 flex items-center gap-1">
            <Link href={`/dashboard/${orgId}/settings`} className="hover:text-gray-700">Settings</Link>
            <span>/</span>
            <span>Sites & Departments</span>
          </div>
          <h1 className="text-2xl font-semibold">Teams & Roles</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage team members, system role permissions, and additional roles (e.g. Auditor).
          </p>
        </div>
        {canManageTeams && (
          <Button
            className="bg-black text-white hover:bg-gray-800 flex items-center gap-2"
            onClick={() => setIsCreateUserDialogOpen(true)}
          >
            <UserPlus className="h-4 w-4" />
            Invite User
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-gray-500 mb-1">Total Users</div>
                <div className="text-2xl font-semibold">{totalUsers}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-gray-500 mb-1">Active</div>
                <div className="text-2xl font-semibold text-green-600">{activeUsers}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-gray-500 mb-1">Pending Invites</div>
                <div className="text-2xl font-semibold">{pendingInvites}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-gray-500 mb-1">Admins</div>
                <div className="text-2xl font-semibold">{admins}</div>
              </CardContent>
            </Card>
          </div>

          {/* Team Members Section */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Team Members</CardTitle>
                  <CardDescription>Manage user accounts and assign roles. Edit users on the Teams page.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search users..."
                      className="pl-10 w-64"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" size="icon">
                    <Filter className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>System Role</TableHead>
                    <TableHead>Additional Roles</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={member.avatar} alt={member.name} />
                            <AvatarFallback className="bg-gray-200 text-gray-600">
                              {getInitials(member.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{member.name}</div>
                            <div className="text-sm text-gray-500">{member.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getRoleBadgeColor(member.systemRole)}>
                          {member.systemRole}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {(member.additionalRoles?.length ?? 0) > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {(member.additionalRoles ?? []).map((r) => (
                              <Badge key={r} variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">
                                {r}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusBadgeColor(member.status)}>
                          {member.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-500">{member.lastActive}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Additional Roles Section – separate table for custom roles (Auditor, etc.) */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Additional Roles</CardTitle>
                  <CardDescription>
                    Custom roles (e.g. Auditor) that can be assigned in addition to system roles. You can assign these when inviting a user.
                  </CardDescription>
                </div>
                {canManageTeams && (
                  <Button variant="outline" size="sm" onClick={() => setAddRoleDialogOpen(true)} className="gap-1">
                    <Plus className="h-4 w-4" />
                    Add Role
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role Name</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {additionalRoles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-gray-500 py-6">
                        No additional roles yet. Add &quot;Auditor&quot; or other custom roles as needed.
                      </TableCell>
                    </TableRow>
                  ) : (
                    additionalRoles.map((role) => (
                      <TableRow key={role.id}>
                        <TableCell className="font-medium">{role.name}</TableCell>
                        <TableCell className="text-gray-600">{role.description ?? "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Role Permissions (RBAC) – read-only summary; edit on Permissions page */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Role Permissions (RBAC)</CardTitle>
                  <CardDescription>System role access. Only the organization owner can change these on the Permissions page.</CardDescription>
                </div>
                <Link href={`/dashboard/${orgId}/settings/permissions`}>
                  <Button variant="outline">Edit Permissions</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-4 pb-4 border-b">
                  <div className="font-medium text-sm text-gray-700">Permission</div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-sm">Admin</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-sm">Manager</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-sm">Member</span>
                  </div>
                </div>
                {permissions.map((permission) => (
                  <div key={permission.key} className="grid grid-cols-4 gap-4 items-center py-2">
                    <div className="text-sm text-gray-700">{permission.label}</div>
                    <div className="text-sm">{permission.admin ? "Yes" : "No"}</div>
                    <div className="text-sm">{permission.manager ? "Yes" : "No"}</div>
                    <div className="text-sm">{permission.member ? "Yes" : "No"}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Create User Dialog */}
      <CreateUserDialog
        open={isCreateUserDialogOpen}
        onOpenChange={setIsCreateUserDialogOpen}
        orgId={orgId}
        currentUserRole={currentUserSystemRole}
        canManageTeams={canManageTeams}
        onUserCreated={fetchData}
      />

      {/* Add Additional Role Dialog */}
      <Dialog open={addRoleDialogOpen} onOpenChange={setAddRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add additional role</DialogTitle>
            <DialogDescription>Create a custom role (e.g. Auditor) that can be assigned to users when inviting them.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Role name</Label>
              <Input
                placeholder="e.g. Auditor"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                placeholder="Brief description"
                value={newRoleDescription}
                onChange={(e) => setNewRoleDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddRoleDialogOpen(false)} disabled={addingRole}>Cancel</Button>
            <Button onClick={handleAddAdditionalRole} disabled={addingRole} className="bg-black text-white hover:bg-gray-800">
              {addingRole ? "Adding..." : "Add role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
