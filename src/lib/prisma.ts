import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { getSSLConfig } from "@/lib/db/ssl-config";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

// Add timeout parameters to connection string if not already present
// PrismaPg adapter uses specific timeout parameters:
// - socket_timeout: Max seconds for SQL query execution (default: varies)
// - pool_timeout: Max seconds to wait for a free connection (default: 10s)
// - connect_timeout: Max seconds to establish connection (default: 5s)
const getConnectionStringWithTimeouts = () => {
  const baseUrl = process.env.DATABASE_URL!;
  try {
    const url = new URL(baseUrl);
    // CRITICAL: The ~23 second timeout is likely a TCP socket timeout
    // We need to ensure all timeout parameters are set correctly
    // Note: socket_timeout and pool_timeout are Prisma-specific and may not work with pg Pool
    // But we set them anyway in case PrismaPg adapter reads them
    
    // Connection establishment timeout
    if (!url.searchParams.has('connect_timeout')) {
      url.searchParams.set('connect_timeout', '120'); // 120 seconds to establish connection
    }
    
    // PostgreSQL server-side timeouts (these are the most important!)
    if (!url.searchParams.has('statement_timeout')) {
      url.searchParams.set('statement_timeout', '120000'); // 120 seconds (120000ms) - CRITICAL!
    }
    if (!url.searchParams.has('lock_timeout')) {
      url.searchParams.set('lock_timeout', '30000'); // 30 seconds
    }
    if (!url.searchParams.has('idle_in_transaction_session_timeout')) {
      url.searchParams.set('idle_in_transaction_session_timeout', '120000'); // 120 seconds
    }
    
    // TCP keepalive parameters (help prevent socket timeouts)
    // These are PostgreSQL connection parameters that help keep connections alive
    if (!url.searchParams.has('tcp_keepalives_idle')) {
      url.searchParams.set('tcp_keepalives_idle', '60'); // Start keepalive after 60 seconds idle
    }
    if (!url.searchParams.has('tcp_keepalives_interval')) {
      url.searchParams.set('tcp_keepalives_interval', '10'); // Send keepalive every 10 seconds
    }
    if (!url.searchParams.has('tcp_keepalives_count')) {
      url.searchParams.set('tcp_keepalives_count', '6'); // Retry 6 times before considering dead
    }
    
    return url.toString();
  } catch {
    // If URL parsing fails, return original
    return baseUrl;
  }
};

// Create a connection pool for better performance and timeout handling
// CRITICAL: The ~23 second timeout is likely a TCP socket-level timeout
// We need to configure TCP keepalive and socket timeouts to prevent this
const pool =
  global.__pgPool ??
  new Pool({
    connectionString: getConnectionStringWithTimeouts(),
    ssl: getSSLConfig(getConnectionStringWithTimeouts()),
    max: 5, // Max connections in pool
    min: 0, // Don't pre-create connections
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 120000, // 120 seconds to acquire connection from pool
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000, // Start keepalive after 10 seconds
    // Allow pool to wait for connections when all are busy
    allowExitOnIdle: false,
    // Note: TCP keepalive parameters are set in connection string (tcp_keepalives_*)
    // Socket-level timeouts are handled by PostgreSQL connection parameters
  });

// Handle pool errors
pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  // Clear the global pool on error to force recreation
  if (process.env.NODE_ENV !== "production") {
    global.__pgPool = undefined;
  }
});

pool.on("connect", async (client) => {
  // Connection established successfully
  const connectStart = Date.now();
  try {
    // CRITICAL: Set timeouts FIRST before any queries to ensure they're active
    // Use 120 seconds to match our pool and wrapper timeouts
    await client.query("SET statement_timeout = 120000"); // 120 seconds (120000ms)
    await client.query("SET lock_timeout = 30000"); // 30 seconds
    await client.query("SET idle_in_transaction_session_timeout = 120000"); // 120 seconds for idle transactions
    
    // Test the connection with a simple query
    await client.query("SELECT 1");
    const connectTime = Date.now() - connectStart;
    if (connectTime > 1000) {
      console.warn(`⚠️ Slow connection established: ${connectTime}ms`);
    }
  } catch (err) {
    // Log but don't fail - connection might still work
    console.warn("Failed to set connection timeouts:", err);
  }
});

pool.on("acquire", async (client) => {
  // Client checked out from pool - ensure timeouts are set
  try {
    // Set timeouts on each connection to ensure they're active (CRITICAL: increased to 120 seconds for very slow AWS RDS)
    await client.query("SET statement_timeout = 120000").catch(() => {}); // 120 seconds (120000ms)
    await client.query("SET lock_timeout = 30000").catch(() => {}); // 30 seconds
  } catch (err) {
    // Ignore errors - connection will still work
  }
});

pool.on("remove", () => {
  // Client removed from pool
});

if (process.env.NODE_ENV !== "production") {
  global.__pgPool = pool;
}

// CRITICAL FIX: PrismaPg adapter expects a Pool object or PoolConfig
// We pass our pre-configured Pool which has all timeout settings
// The Pool uses the connection string with timeout parameters, and we've also
// set connectionTimeoutMillis and idleTimeoutMillis on the Pool itself
// Note: socket_timeout in connection string may not be respected by pg Pool,
// but connectionTimeoutMillis on the Pool will control connection acquisition timeout
const adapter = new PrismaPg(pool);

// Create Prisma client with timeout wrapper
// Note: Prisma has internal timeouts that may be shorter than our wrapper
const basePrisma =
  global.__prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    // Add error formatting for better debugging
    errorFormat: "pretty",
  });

// Wrap Prisma client to add query-level timeouts
export const prisma = basePrisma.$extends({
  query: {
    $allOperations: async ({ operation, model, args, query }) => {
      const start = Date.now();
      try {
        // Add a 120-second timeout wrapper for all queries (increased for very slow AWS RDS)
        // Note: This matches statement_timeout set on database connections (120000ms)
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Query timeout after 120 seconds: ${model}.${operation}`));
          }, 120000);
        });

        const result = await Promise.race([
          query(args),
          timeoutPromise,
        ]);

        const duration = Date.now() - start;
        if (duration > 5000) {
          console.warn(`Slow query detected: ${model}.${operation} took ${duration}ms`);
        }

        return result;
      } catch (error: any) {
        if (error.message?.includes('timeout')) {
          console.error(`Query timeout: ${model}.${operation}`, {
            args: JSON.stringify(args).substring(0, 200),
            duration: Date.now() - start,
          });
          
          // Log timeout details for debugging
          console.warn('Query timeout details:', {
            model,
            operation,
            duration: Date.now() - start,
            note: 'Database connection may be very slow. Check AWS RDS performance and network latency.',
          });
        }
        throw error;
      }
    },
  },
}) as typeof basePrisma;

if (process.env.NODE_ENV !== "production") {
  global.__prisma = basePrisma;
}

// Test database connection on startup
if (process.env.NODE_ENV === "development") {
  // Test connection asynchronously (don't block startup)
  (async () => {
    try {
      const testStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const testTime = Date.now() - testStart;
      if (testTime > 5000) {
        console.warn(`⚠️ Database connection is slow: ${testTime}ms. This may cause login timeouts.`);
      } else {
        console.log(`✅ Database connection test: ${testTime}ms`);
      }
    } catch (error) {
      console.error("❌ Database connection test failed:", error);
    }
  })();
}

// Note: If you're experiencing timeout errors, check:
// 1. AWS IAM credentials are valid and not expired (CRITICAL!)
// 2. AWS RDS instance is running and accessible
// 3. Security groups allow connections from your IP on port 5432
// 4. DATABASE_URL is correct and credentials are valid
// 5. Network connectivity to AWS RDS (try: psql with your connection string)
// 
// Common causes of ~23 second timeouts:
// - Expired AWS IAM credentials (connection rejected, hangs then times out)
// - Security group blocking connections
// - RDS instance paused/stopped
// - Network/firewall issues
