/**
 * Tenant Database Connection Pooling
 * 
 * CRITICAL PERFORMANCE OPTIMIZATION:
 * Replaces per-request Client creation with reusable connection pools.
 * Each organization (tenant) gets its own singleton pool, dramatically
 * reducing connection overhead from ~100-500ms to ~1-5ms per request.
 */

import { Pool, PoolClient } from "pg";
import { prisma } from "@/lib/prisma";
import { getSSLConfig } from "@/lib/db/ssl-config";

// In-memory cache of connection pools per organization
const tenantPools = new Map<string, Pool>();

// Cache connection strings to avoid querying master DB on every pool creation
interface ConnectionStringCache {
  connectionString: string;
  expiresAt: number;
}
const connectionStringCache = new Map<string, ConnectionStringCache>();

// Track last health check time per pool to avoid excessive checks
interface PoolMetadata {
  pool: Pool;
  lastHealthCheck: number;
  createdAt: number;
}
const poolMetadata = new Map<string, PoolMetadata>();

// Health check configuration
const HEALTH_CHECK_INTERVAL = 60000; // Only check health every 60 seconds (reduced frequency)
const HEALTH_CHECK_TIMEOUT = 3000; // 3 second timeout (reduced from 5s for faster failure detection)

// Pool configuration (ssl is set per-pool from connection string in getTenantPool)
const POOL_CONFIG = {
  max: 10, // Maximum 10 connections per tenant
  min: 1, // Keep at least 1 connection alive (faster health checks)
  idleTimeoutMillis: 60000, // Close idle connections after 60s (increased to keep connections longer)
  connectionTimeoutMillis: 15000, // Timeout after 15s (increased for slow RDS connections)
  allowExitOnIdle: false,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
};

/**
 * Get or create a connection pool for a tenant database
 * @param orgId - Organization ID
 * @returns PostgreSQL connection pool
 */
export async function getTenantPool(orgId: string): Promise<Pool> {
  // Return existing pool if available
  if (tenantPools.has(orgId)) {
    const pool = tenantPools.get(orgId)!;
    const metadata = poolMetadata.get(orgId);
    
    // Verify pool is still healthy
    if (!pool.ended) {
      const now = Date.now();
      const timeSinceLastCheck = metadata ? now - metadata.lastHealthCheck : Infinity;
      
      // Only perform health check if:
      // 1. Pool was recently created (< 10 seconds ago) - skip check, assume healthy
      // 2. Last health check was more than HEALTH_CHECK_INTERVAL ago
      // 3. No metadata exists (first access)
      const shouldCheckHealth = metadata 
        ? (timeSinceLastCheck > HEALTH_CHECK_INTERVAL && (now - metadata.createdAt) > 10000)
        : true;
      
      if (shouldCheckHealth) {
        // Smart health check: If pool has active/idle connections, assume it's healthy
        // Only do query check if pool appears empty (no connections)
        const hasConnections = pool.totalCount > 0;
        
        if (hasConnections) {
          // Pool has connections, assume healthy - skip query check
          if (metadata) {
            metadata.lastHealthCheck = now;
          } else {
            poolMetadata.set(orgId, {
              pool,
              lastHealthCheck: now,
              createdAt: now,
            });
          }
          return pool;
        }
        
        // Pool appears empty, do a lightweight health check
        // Use a shorter timeout and make it non-blocking (fire and forget if slow)
        try {
          const healthCheckStart = Date.now();
          const healthCheck = Promise.race([
            pool.query("SELECT 1"),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error("Health check timeout")), HEALTH_CHECK_TIMEOUT)
            ),
          ]);
          await healthCheck;
          const healthCheckDuration = Date.now() - healthCheckStart;
          if (healthCheckDuration > 1000) {
            console.warn(`[TenantPool] Slow health check for orgId ${orgId}: ${healthCheckDuration}ms`);
          }
          
          // Update last health check time
          if (metadata) {
            metadata.lastHealthCheck = now;
          } else {
            poolMetadata.set(orgId, {
              pool,
              lastHealthCheck: now,
              createdAt: now,
            });
          }
          
          return pool;
        } catch (error) {
          // Health check failed - but don't immediately recreate
          // Only recreate if pool has been consistently failing
          console.warn(`[TenantPool] Health check failed for orgId ${orgId}, but pool may still be usable`, error);
          
          // Update last health check time anyway (to avoid checking again immediately)
          if (metadata) {
            metadata.lastHealthCheck = now;
          }
          
          // Return pool anyway - let the actual query fail if pool is truly dead
          // This prevents cascading failures from health check timeouts
          return pool;
        }
      } else {
        // Skip health check, return pool immediately
        return pool;
      }
    } else {
      // Remove dead pool
      tenantPools.delete(orgId);
      poolMetadata.delete(orgId);
    }
  }

  // Check connection string cache first (10 minute TTL)
  const connCacheKey = `conn:${orgId}`;
  const cachedConn = connectionStringCache.get(connCacheKey);
  let connectionString: string;
  
  if (cachedConn && Date.now() < cachedConn.expiresAt) {
    connectionString = cachedConn.connectionString;
  } else {
    // Only query master DB if not cached
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: { database: true },
    });

    if (!org || !org.database) {
      throw new Error(`Tenant database not found for organization ${orgId}`);
    }

    connectionString = org.database.connectionString;
    
    // Cache for 10 minutes
    connectionStringCache.set(connCacheKey, {
      connectionString,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
  }

  // Create new pool for this tenant; SSL derived from connection string (local vs AWS)
  const pool = new Pool({
    ...POOL_CONFIG,
    connectionString,
    ssl: getSSLConfig(connectionString),
  });

  // Handle pool errors (log but don't crash)
  pool.on("error", (err) => {
    console.error(`[TenantPool] Pool error for orgId ${orgId}:`, err);
  });

  // Store pool in cache
  tenantPools.set(orgId, pool);

  return pool;
}

/**
 * Execute a query using a pooled connection
 * Automatically acquires and releases connection
 * @param orgId - Organization ID
 * @param query - SQL query string
 * @param params - Query parameters
 * @returns Query result rows
 */
export async function queryTenant<T = any>(
  orgId: string,
  query: string,
  params?: any[]
): Promise<T[]> {
  try {
    const pool = await getTenantPool(orgId);
    const result = await pool.query(query, params);
    return result.rows as T[];
  } catch (error: any) {
    console.error(`[queryTenant] Error executing query for orgId ${orgId}:`, {
      message: error.message,
      code: error.code,
      query: query.substring(0, 100) + "...",
    });
    throw error;
  }
}

/**
 * Execute multiple queries in a transaction
 * @param orgId - Organization ID
 * @param callback - Function that receives a PoolClient and executes queries
 * @returns Result of the callback
 */
export async function withTenantTransaction<T>(
  orgId: string,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = await getTenantPool(orgId);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release(); // CRITICAL: Always release connection back to pool
  }
}

/**
 * Get a client from the pool (for complex operations)
 * MUST call client.release() when done!
 * @param orgId - Organization ID
 * @returns PoolClient (must be released after use)
 */
export async function getTenantClient(orgId: string): Promise<PoolClient> {
  const pool = await getTenantPool(orgId);
  return await pool.connect();
}

/**
 * Close all pools (for graceful shutdown)
 */
export async function closeAllPools(): Promise<void> {
  const closePromises = Array.from(tenantPools.values()).map((pool) => pool.end());
  await Promise.all(closePromises);
  tenantPools.clear();
  connectionStringCache.clear();
  poolMetadata.clear();
}

/**
 * Invalidate connection string cache (call when org database changes)
 */
export function invalidateConnectionStringCache(orgId: string): void {
  connectionStringCache.delete(`conn:${orgId}`);
}

/**
 * Get pool statistics for monitoring
 */
export function getPoolStats() {
  return {
    totalPools: tenantPools.size,
    pools: Array.from(tenantPools.entries()).map(([orgId, pool]) => ({
      orgId,
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    })),
  };
}
