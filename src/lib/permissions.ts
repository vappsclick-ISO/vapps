/**
 * Organization-level RBAC permissions.
 * Stored per-org in Organization.permissions (JSON).
 * Only the organization owner can change these.
 * Skip audit-related permissions per product scope.
 */

export type SystemRoleKey = "admin" | "manager" | "member";

export interface PermissionRow {
  key: string;
  label: string;
  admin: boolean;
  manager: boolean;
  member: boolean;
}

/** Permission keys used in the app (no audit). */
export const PERMISSION_KEYS = [
  "manage_teams",
  "manage_sites",
  "manage_processes",
  // COMMENTED OUT FOR NOW - keeping only active permissions:
  // "create_issues",
  // "verify_issues",
  // "view_reports",
  // "export_data",
  // "manage_documents",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

const PERMISSION_LABELS: Record<PermissionKey, string> = {
  manage_teams: "Manage Users & Teams",
  manage_sites: "Manage Sites & Departments",
  manage_processes: "Manage Processes",
  create_issues: "Create Issues",
  verify_issues: "Verify / Close Issues",
  view_reports: "View Reports",
  export_data: "Export Data",
  manage_documents: "Manage Documents",
};

/** Default permission matrix (when org has no custom permissions). */
export const DEFAULT_PERMISSIONS: PermissionRow[] = [
  { key: "manage_teams", label: PERMISSION_LABELS.manage_teams, admin: true, manager: false, member: false },
  { key: "manage_sites", label: PERMISSION_LABELS.manage_sites, admin: true, manager: true, member: false },
  { key: "manage_processes", label: PERMISSION_LABELS.manage_processes, admin: true, manager: true, member: false },
  // COMMENTED OUT FOR NOW - keeping only active permissions:
  // { key: "create_issues", label: PERMISSION_LABELS.create_issues, admin: true, manager: true, member: true },
  // { key: "verify_issues", label: PERMISSION_LABELS.verify_issues, admin: true, manager: true, member: false },
  // { key: "view_reports", label: PERMISSION_LABELS.view_reports, admin: true, manager: true, member: true },
  // { key: "export_data", label: PERMISSION_LABELS.export_data, admin: true, manager: false, member: false },
  // { key: "manage_documents", label: PERMISSION_LABELS.manage_documents, admin: true, manager: true, member: true },
];

/** Stored shape in DB: { [key]: { admin, manager, member } } */
export type StoredPermissions = Partial<
  Record<PermissionKey, { admin: boolean; manager: boolean; member: boolean }>
>;

/**
 * Parse stored JSON from Organization.permissions into PermissionRow[].
 * Missing keys use defaults from DEFAULT_PERMISSIONS.
 */
export function storedToPermissionRows(stored: StoredPermissions | null): PermissionRow[] {
  const defaults = DEFAULT_PERMISSIONS;
  if (!stored || typeof stored !== "object") {
    return defaults;
  }
  return PERMISSION_KEYS.map((key) => {
    const def = defaults.find((d) => d.key === key)!;
    const row = stored[key];
    if (!row || typeof row !== "object") {
      return def;
    }
    return {
      key,
      label: def.label,
      admin: typeof row.admin === "boolean" ? row.admin : def.admin,
      manager: typeof row.manager === "boolean" ? row.manager : def.manager,
      member: typeof row.member === "boolean" ? row.member : def.member,
    };
  });
}

/**
 * Convert PermissionRow[] to StoredPermissions for saving.
 */
export function permissionRowsToStored(rows: PermissionRow[]): StoredPermissions {
  const out: StoredPermissions = {};
  for (const row of rows) {
    if (PERMISSION_KEYS.includes(row.key as PermissionKey)) {
      out[row.key as PermissionKey] = {
        admin: row.admin,
        manager: row.manager,
        member: row.member,
      };
    }
  }
  return out;
}

/**
 * Check if a role has a specific permission (for use in APIs).
 * Owner is treated as admin for permission checks.
 */
export function hasPermission(
  stored: StoredPermissions | null,
  role: "owner" | "admin" | "manager" | "member",
  permissionKey: PermissionKey
): boolean {
  const rows = storedToPermissionRows(stored);
  const row = rows.find((r) => r.key === permissionKey);
  if (!row) return false;
  const effectiveRole: SystemRoleKey = role === "owner" ? "admin" : role;
  return row[effectiveRole];
}

/** Permission keys we enforce in API/UI. */
// COMMENTED OUT FOR NOW: create_issues, verify_issues, view_reports, export_data, manage_documents
export const ENFORCED_PERMISSION_KEYS = [
  "manage_teams",
  "manage_sites",
  "manage_processes",
  // "create_issues",
  // "verify_issues",
] as const;

export type EnforcedPermissionKey = (typeof ENFORCED_PERMISSION_KEYS)[number];

export interface CurrentUserPermissionFlags {
  manage_teams: boolean;
  manage_sites: boolean;
  manage_processes: boolean;
  // COMMENTED OUT FOR NOW:
  // create_issues: boolean;
  // verify_issues: boolean;
}

/**
 * Get the current user's permission flags for enforced keys only.
 * Used by GET /permissions and by UI to show/hide Invite User and edit/delete.
 * Org owner always gets all permissions (can do anything).
 */
export function getCurrentUserPermissionFlags(
  stored: StoredPermissions | null,
  role: "owner" | "admin" | "manager" | "member"
): CurrentUserPermissionFlags {
  // Org owner can do anything – always grant all enforced permissions
  if (role === "owner") {
    return {
      manage_teams: true,
      manage_sites: true,
      manage_processes: true,
    };
  }
  return {
    manage_teams: hasPermission(stored, role, "manage_teams"),
    manage_sites: hasPermission(stored, role, "manage_sites"),
    manage_processes: hasPermission(stored, role, "manage_processes"),
  };
}
