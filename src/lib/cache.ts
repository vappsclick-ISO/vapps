/**
 * Lightweight In-Memory Caching Layer
 * 
 * Caches GET responses for frequently accessed data to reduce database load.
 * TTL: 60 seconds (configurable per key)
 * 
 * FUTURE: Consider Redis for distributed caching in production
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class SimpleCache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 60 * 1000; // 60 seconds

  /**
   * Get cached value
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cached value
   */
  set<T>(key: string, data: T, ttlMs?: number): void {
    const ttl = ttlMs ?? this.defaultTTL;
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * Delete cached value
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clear cache for a specific pattern (e.g., org:123:*)
   */
  clearPattern(pattern: string): void {
    const regex = new RegExp(pattern.replace("*", ".*"));
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

export const cache = new SimpleCache();

/**
 * Cache key generators
 */
export const cacheKeys = {
  orgSites: (orgId: string) => `org:${orgId}:sites`,
  orgProcesses: (orgId: string, siteId?: string) => `org:${orgId}:processes:${siteId || "all"}`,
  orgMetadata: (orgId: string, type: string) => `org:${orgId}:metadata:${type}`,
  orgIssue: (orgId: string, processId: string, issueId: string) => `org:${orgId}:process:${processId}:issue:${issueId}`,
  orgRoles: (orgId: string) => `org:${orgId}:roles`,
  tenantContext: (orgId: string, userId: string) => `tenant:${orgId}:${userId}`,
  connectionString: (orgId: string) => `conn:${orgId}`,
};
