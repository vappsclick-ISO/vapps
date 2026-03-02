/**
 * Centralized PostgreSQL SSL configuration.
 * Local vs remote (e.g. AWS RDS) is determined only by the connection string host:
 * - localhost / 127.0.0.1 / ::1 → no SSL (for development).
 * - Any other host → SSL with rejectUnauthorized: false (for production RDS).
 * No env names or NODE_ENV are used; behavior is driven solely by the URL.
 */

function getHostFromConnectionString(connectionString: string): string | null {
  try {
    const url = new URL(connectionString);
    return url.hostname || null;
  } catch {
    return null;
  }
}

/**
 * True if the host is a local PostgreSQL instance (no SSL needed).
 */
export function isLocalHost(host: string): boolean {
  const h = host.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "::1";
}

/**
 * Returns the SSL option for pg Client/Pool. Use for all PostgreSQL connections.
 * Local host → false; remote (e.g. AWS RDS) → { rejectUnauthorized: false }.
 */
export function getSSLConfig(
  connectionString: string
): false | { rejectUnauthorized: false } {
  const host = getHostFromConnectionString(connectionString);
  if (!host || isLocalHost(host)) return false;
  return { rejectUnauthorized: false };
}

/**
 * Returns sslmode for building a connection string (e.g. when creating tenant DBs).
 * Local → 'disable'; remote → 'require'. Ensures stored tenant URLs work with the same SSL logic.
 */
export function getSSLModeForConnectionString(host: string): "disable" | "require" {
  return isLocalHost(host) ? "disable" : "require";
}
