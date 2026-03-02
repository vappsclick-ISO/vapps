import { Client, Pool } from "pg";
import { getSSLConfig } from "@/lib/db/ssl-config";

const tenantPools = new Map<string, Pool>();
const MAX_POOL_SIZE = 3;
const IDLE_TIMEOUT_MS = 20000;

function getTenantPool(connectionString: string): Pool {
  let pool = tenantPools.get(connectionString);
  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: getSSLConfig(connectionString),
      max: MAX_POOL_SIZE,
      idleTimeoutMillis: IDLE_TIMEOUT_MS,
      connectionTimeoutMillis: 10000,
    });
    tenantPools.set(connectionString, pool);
  }
  return pool;
}

/**
 * Execute a function with a tenant DB connection. Uses a small pool per connection
 * string so connections are reused instead of opening a new one every time.
 */
export async function withTenantConnection<T>(
  connectionString: string,
  fn: (client: Client) => Promise<T>
): Promise<T> {
  const pool = getTenantPool(connectionString);
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

