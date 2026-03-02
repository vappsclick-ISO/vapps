"use client";

/**
 * Role Permissions (RBAC) – dynamic, org-level.
 * - Permissions are stored per organization; only the org owner can change them.
 * - System roles (Admin, Manager, Member) map to leadership tiers.
 * - This page loads permissions from the API and lets the owner edit and save.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Shield, Info, ChevronRight, Loader2, Save } from "lucide-react";

interface PermissionRow {
  key: string;
  label: string;
  admin: boolean;
  manager: boolean;
  member: boolean;
}

type RoleKey = "admin" | "manager" | "member";

export default function PermissionsPage() {
  const params = useParams();
  const orgId = params?.orgId as string;
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (orgId) fetchPermissions();
  }, [orgId]);

  const fetchPermissions = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<{
        permissions: PermissionRow[];
        isOwner: boolean;
        currentUserRole: string;
      }>(`/organization/${orgId}/permissions`);
      // Filter to show only active permissions: manage_teams, manage_sites, manage_processes
      const activePermissions = (res.permissions ?? []).filter(
        (p) => p.key === "manage_teams" || p.key === "manage_sites" || p.key === "manage_processes"
      );
      setPermissions(activePermissions);
      setIsOwner(res.isOwner ?? false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load permissions");
      setPermissions([]);
      setIsOwner(false);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (index: number, role: RoleKey) => {
    if (!isOwner) return;
    setPermissions((prev) => {
      const next = [...prev];
      const row = next[index];
      if (!row) return prev;
      // Independent toggle - each role can be enabled/disabled independently
      next[index] = {
        ...row,
        [role]: !row[role],
      };
      return next;
    });
  };

  const handleSave = async () => {
    if (!isOwner) return;
    try {
      setSaving(true);
      // Only send the active permissions (manage_teams, manage_sites, manage_processes)
      await apiClient.put(`/organization/${orgId}/permissions`, { permissions });
      toast.success("Permissions saved. Only the organization owner can change these.");
      await fetchPermissions();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save permissions");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 px-5">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href={`/dashboard/${orgId}`} className="hover:text-gray-700 transition-colors">
              Dashboard
            </Link>
            <ChevronRight className="h-4 w-4" />
            <Link href={`/dashboard/${orgId}/settings`} className="hover:text-gray-700 transition-colors">
              Settings
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-gray-900 font-medium">Permissions</span>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Role Permissions (RBAC)</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure what each system role can do. Only the organization owner can change these settings.
          </p>
        </div>
        {isOwner && (
          <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save changes
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Role Permissions (RBAC)</CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-gray-400 cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Permissions are defined per role and can only be edited by the organization owner.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <CardDescription>
            Configure access for each system role (Admin, Manager, Member). These apply across the organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
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
              {permissions.map((permission, index) => (
                <div key={permission.key} className="grid grid-cols-4 gap-4 items-center py-2">
                  <div className="text-sm text-gray-700">{permission.label}</div>
                  <div className="flex items-center">
                    <Switch
                      checked={permission.admin}
                      onCheckedChange={() => handleToggle(index, "admin")}
                      disabled={!isOwner}
                    />
                  </div>
                  <div className="flex items-center">
                    <Switch
                      checked={permission.manager}
                      onCheckedChange={() => handleToggle(index, "manager")}
                      disabled={!isOwner}
                    />
                  </div>
                  <div className="flex items-center">
                    <Switch
                      checked={permission.member}
                      onCheckedChange={() => handleToggle(index, "member")}
                      disabled={!isOwner}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
