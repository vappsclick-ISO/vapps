/**
 * Centralized React Query cache keys
 * 
 * CRITICAL: Always use these functions to generate query keys.
 * This prevents cache key mismatches and ensures proper cache invalidation.
 */

export const queryKeys = {
  /**
   * Dashboard data (sites + processes + organization + userRole)
   */
  dashboard: (orgId: string) => ["dashboard", orgId] as const,

  /**
   * Sites data
   */
  sites: (orgId: string) => ["sites", orgId] as const,

  /**
   * Processes data (all or filtered by siteId)
   */
  processes: (orgId: string, siteId?: string) => 
    ["processes", orgId, siteId || "all"] as const,

  /**
   * Single process
   */
  process: (orgId: string, processId: string) => 
    ["process", orgId, processId] as const,

  /**
   * Process users
   */
  processUsers: (orgId: string, processId: string) => 
    ["processUsers", orgId, processId] as const,

  /**
   * Issues for a process
   */
  issues: (orgId: string, processId: string, sprintId?: string | null) => 
    ["issues", orgId, processId, sprintId || "all"] as const,

  /**
   * Sprints for a process
   */
  sprints: (orgId: string, processId: string) => 
    ["sprints", orgId, processId] as const,

  /**
   * Metadata (titles, tags, sources)
   */
  metadata: (orgId: string, type: string) => 
    ["metadata", orgId, type] as const,
} as const;