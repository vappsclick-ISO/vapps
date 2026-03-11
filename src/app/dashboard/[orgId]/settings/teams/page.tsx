"use client";

/**
 * ARCHITECTURE EXPLANATION:
 * =========================
 * 
 * Leadership = Organization-level identity
 * - Leadership levels are defined at ORGANIZATION level, not site level
 * - Users have a leadership tier assigned at org level
 * - This page shows all users in the organization with their leadership tiers
 * 
 * RBAC = System authority
 * - System roles (Admin, Manager, Member) are derived from Leadership levels
 * - Shown here as read-only badges
 * 
 * Site = Scope
 * - Sites only assign users (scope of work)
 * - Sites do NOT define roles or leadership levels
 * - Site pages show assigned users with their org-level leadership (read-only)
 * 
 * Functional roles = Workflow responsibility
 * - Functional roles (Audit Lead, Issue Assignee) are workflow-specific
 * - Managed separately at process/audit level
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getDashboardPath } from "@/lib/subdomain";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Search, Filter, Edit, Trash2, Mail, Info, UserPlus, ChevronRight } from "lucide-react";
import CreateUserDialog from "@/components/dashboard/CreateUserDialog";
import EditUserDialog from "@/components/dashboard/EditUserDialog";
import DeleteUserDialog from "@/components/dashboard/DeleteUserDialog";

// Leadership to System Role mapping (single source of truth)
const leadershipToRoleMap = {
  TOP: "Admin",
  OPERATIONAL: "Manager",
  SUPPORT: "Member",
} as const;

type LeadershipTier = keyof typeof leadershipToRoleMap;
type SystemRole = typeof leadershipToRoleMap[LeadershipTier];

interface TeamMember {
  id: string;
  name: string;
  email: string;
  leadershipTier: LeadershipTier;
  status: "Active" | "Invited";
  lastActive: string;
  avatar?: string;
  siteName?: string; // For Operational and Support: site they're assigned to
  processName?: string; // For Support: process they're assigned to
  jobTitle?: string; // Job title: CEO, CTO, VP, Director, etc.
  isOwner?: boolean; // Whether this user is the organization owner
  siteId?: string; // Site ID for editing
  processId?: string; // Process ID for editing
  additionalRoles?: string[]; // e.g. ["Auditor"]
}

// Helper function to derive system role from leadership tier
const getSystemRole = (leadershipTier: LeadershipTier): SystemRole => {
  return leadershipToRoleMap[leadershipTier];
};

// API returns leadershipTier as "Top" | "Operational" | "Support"; map to our tier type
function toTier(t: string): LeadershipTier {
  if (t === "Top") return "TOP";
  if (t === "Operational") return "OPERATIONAL";
  return "SUPPORT";
}

export default function TeamsPage() {
  const params = useParams();
  const orgId = params?.orgId as string;
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<TeamMember | null>(null);
  const [deletingUser, setDeletingUser] = useState<TeamMember | null>(null);
  const [canManageTeams, setCanManageTeams] = useState(false);
  const [currentUserSystemRole, setCurrentUserSystemRole] = useState<SystemRole>("Member");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    if (orgId) {
      fetchMembers();
      fetchPermissions();
    }
  }, [orgId]);

  const fetchPermissions = async () => {
    try {
      const res = await apiClient.get<{
        currentUserPermissions: {
          manage_teams: boolean;
          manage_sites: boolean;
          manage_processes: boolean;
        };
        currentUserRole: string;
      }>(`/organization/${orgId}/permissions`);
      setCanManageTeams(res.currentUserPermissions?.manage_teams ?? false);
      const role = res.currentUserRole as SystemRole;
      setCurrentUserSystemRole(role === "Admin" || role === "Manager" || role === "Member" ? role : "Member");
    } catch (e: any) {
      console.error("Failed to fetch permissions:", e);
      setCanManageTeams(false); // Default to false on error
    }
  };

  const fetchMembers = async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.get<{ teamMembers: Array<{ id: string; name: string; email: string; leadershipTier: string; systemRole: string; status: "Active" | "Invited"; lastActive: string; avatar?: string; siteName?: string; processName?: string; jobTitle?: string; isOwner?: boolean; siteId?: string; processId?: string; additionalRoles?: string[] }>; currentUserId?: string }>(`/organization/${orgId}/members`);
      setCurrentUserId(res.currentUserId ?? null);
      const list = (res.teamMembers || []).map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        leadershipTier: toTier(m.leadershipTier),
        status: m.status,
        lastActive: m.lastActive,
        avatar: m.avatar,
        siteName: m.siteName,
        processName: m.processName,
        jobTitle: m.jobTitle,
        isOwner: m.isOwner ?? false,
        siteId: m.siteId,
        processId: m.processId,
        additionalRoles: m.additionalRoles ?? [],
      }));
      setTeamMembers(list);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load team members");
      setTeamMembers([]);
    } finally {
      setIsLoading(false);
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
  const admins = teamMembers.filter((m) => getSystemRole(m.leadershipTier) === "Admin").length;

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

  const getLeadershipTierBadgeColor = (tier: LeadershipTier) => {
    switch (tier) {
      case "TOP":
        return "bg-orange-100 text-orange-700 border-orange-200";
      case "OPERATIONAL":
        return "bg-orange-50 text-orange-600 border-orange-200";
      case "SUPPORT":
        return "bg-blue-50 text-blue-600 border-blue-200";
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

  return (
    <div className="space-y-6 px-5">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link 
              href={getDashboardPath(orgId, "")}
              className="hover:text-gray-700 transition-colors"
            >
              Dashboard
            </Link>
            <ChevronRight className="h-4 w-4" />
            <Link
              href={getDashboardPath(orgId, "settings")}
              className="hover:text-gray-700 transition-colors"
            >
              Settings
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-gray-900 font-medium">Teams</span>
          </div>
          <div className="flex items-start gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Teams</h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage organization users. Leadership tiers are assigned at organization level.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isLoading && (
            <p className="text-sm text-gray-500">Updating…</p>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              {canManageTeams && (
                <Button 
                  className="bg-black text-white hover:bg-gray-800 flex items-center gap-2"
                  onClick={() => setIsCreateUserDialogOpen(true)}
                >
                  <UserPlus className="h-4 w-4" />
                  Invite User
                </Button>
              )}
            </TooltipTrigger>
            <TooltipContent>
              <p>Role and permissions are assigned automatically based on leadership level</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

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
            <div className="text-2xl font-semibold text-yellow-600">{pendingInvites}</div>
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
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle>Team Members</CardTitle>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-gray-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Users are assigned to sites for scope, but leadership is organization-level</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <CardDescription>Manage user accounts and view leadership tiers</CardDescription>
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
                <TableHead>
                  <div className="flex items-center gap-2">
                    <span>Job Title</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>User's job title or role designation</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableHead>
                <TableHead>
                  <div className="flex items-center gap-2">
                    <span>Leadership Tier</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Organization-level leadership tier. Determines system role and access permissions.</p>
                        <p className="mt-1 text-xs">Every user has one site and one process (except Owner).</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableHead>
                <TableHead>
                  <div className="flex items-center gap-2">
                    <span>System Role</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Role is automatically assigned based on Leadership Level (read-only)</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableHead>
                <TableHead>
                  <div className="flex items-center gap-2">
                    <span>Site</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Assigned site for this user (required for all except Owner)</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableHead>
                <TableHead>
                  <div className="flex items-center gap-2">
                    <span>Process</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Assigned process for this user (required for all except Owner)</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-gray-500 py-8">
                    Loading team members…
                  </TableCell>
                </TableRow>
              ) : filteredMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-gray-500 py-8">
                    No team members found.
                  </TableCell>
                </TableRow>
              ) : (
              filteredMembers.map((member) => {
                const systemRole = getSystemRole(member.leadershipTier);
                return (
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
                          <div className="font-medium">
                            {member.name && member.name !== "—" ? member.name : member.email || "—"}
                          </div>
                          <div className="text-sm text-gray-500">{member.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {member.isOwner ? (
                        <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                          Owner
                        </Badge>
                      ) : member.jobTitle && member.jobTitle.trim() ? (
                        <span className="text-sm font-medium text-gray-700">{member.jobTitle}</span>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={getLeadershipTierBadgeColor(member.leadershipTier)}
                      >
                        {member.leadershipTier}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={getSystemRoleBadgeColor(systemRole)}
                      >
                        {systemRole}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {member.siteName ? (
                        <span className="text-sm font-medium text-gray-700">
                          {member.siteName}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {member.processName ? (
                        <span className="text-sm font-medium text-gray-700">
                          {member.processName}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={getStatusBadgeColor(member.status)}
                      >
                        {member.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-500">{member.lastActive}</TableCell>
                    <TableCell>
                      {((!member.isOwner && canManageTeams) || (member.isOwner && member.id === currentUserId)) && (
                        <div className="flex items-center justify-end gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => setEditingUser(member)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{member.isOwner ? "Edit your site, process, and additional roles (e.g. Auditor)" : "Edit user details and leadership tier (role updates automatically)"}</p>
                            </TooltipContent>
                          </Tooltip>
                          {!member.isOwner && member.status === "Invited" && (
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Mail className="h-4 w-4" />
                            </Button>
                          )}
                          {!member.isOwner && canManageTeams && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-red-500 hover:text-red-700"
                                  onClick={() => setDeletingUser(member)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Remove user from organization</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <CreateUserDialog
        open={isCreateUserDialogOpen}
        onOpenChange={setIsCreateUserDialogOpen}
        orgId={orgId}
        currentUserRole={currentUserSystemRole}
        canManageTeams={canManageTeams}
        onUserCreated={fetchMembers}
      />

      {/* Edit User Dialog */}
      {editingUser && (
        <EditUserDialog
          open={!!editingUser}
          onOpenChange={(open) => !open && setEditingUser(null)}
          orgId={orgId}
          userId={editingUser.id}
          userName={editingUser.name}
          userEmail={editingUser.email}
          currentJobTitle={editingUser.jobTitle}
          currentLeadershipTier={editingUser.leadershipTier}
          currentSiteId={editingUser.siteId}
          currentProcessId={editingUser.processId}
          currentAdditionalRoles={editingUser.additionalRoles}
          isOwnerEditingSelf={editingUser.isOwner && editingUser.id === currentUserId}
          onUserUpdated={() => {
            setEditingUser(null);
            fetchMembers();
          }}
        />
      )}

      {/* Delete User Dialog */}
      {deletingUser && (
        <DeleteUserDialog
          open={!!deletingUser}
          onOpenChange={(open) => !open && setDeletingUser(null)}
          orgId={orgId}
          userId={deletingUser.id}
          userName={deletingUser.name}
          userEmail={deletingUser.email}
          onUserDeleted={() => {
            setDeletingUser(null);
            fetchMembers();
          }}
        />
      )}
    </div>
  );
}
