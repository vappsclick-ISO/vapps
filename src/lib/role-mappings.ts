/**
 * Fixed mappings between Leadership Level, System Role, and Focus.
 * Enforces a strict hierarchy: level determines system role and focus.
 */

export const LEADERSHIP_LEVEL_MAP = {
  1: {
    systemRole: "Admin" as const,
    focus: "Strategy & Governance" as const,
  },
  2: {
    systemRole: "Manager" as const,
    focus: "Tactical Deployment" as const,
  },
  3: {
    systemRole: "Member" as const,
    focus: "Daily Execution" as const,
  },
} as const;

export type LeadershipLevel = 1 | 2 | 3;
export type SystemRole = "Admin" | "Manager" | "Member";
export type Focus =
  | "Strategy & Governance"
  | "Tactical Deployment"
  | "Daily Execution";

export function getSystemRoleForLevel(level: LeadershipLevel): SystemRole {
  return LEADERSHIP_LEVEL_MAP[level].systemRole;
}

export function getFocusForLevel(level: LeadershipLevel): Focus {
  return LEADERSHIP_LEVEL_MAP[level].focus;
}

export function isValidLeadershipCombination(
  leadershipLevel: number,
  systemRole: string,
  focus: string
): boolean {
  const level = leadershipLevel as LeadershipLevel;
  if (level !== 1 && level !== 2 && level !== 3) return false;
  const mapping = LEADERSHIP_LEVEL_MAP[level];
  return (
    mapping.systemRole === systemRole && mapping.focus === focus
  );
}
