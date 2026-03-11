/**
 * Resolve the current organization from the request host (subdomain).
 * Use in API routes and server logic to derive org from hostname instead of trusting path/query.
 */

import type { NextRequest } from "next/server";

/** Subdomains that are NOT tenant orgs (main app, login, org list). */
export const RESERVED_SUBDOMAINS = new Set(["app", "www", "localhost"]);

/**
 * Get the host from the request (respects x-forwarded-host when behind a reverse proxy).
 */
export function getHost(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-host");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const host = req.headers.get("host");
  return host ?? req.nextUrl.host;
}

/**
 * Extract the tenant subdomain from the host.
 * - Apex domain (e.g. vapps.click) or www.vapps.click → null (main app).
 * - Tenant subdomain (e.g. stellixsoft.vapps.click) → "stellixsoft".
 * - Dev: app.lvh.me → "app", stellixsoft.lvh.me → "stellixsoft".
 */
export function getSubdomainFromHost(host: string): string | null {
  const hostname = (host.split(":")[0] ?? "").toLowerCase();
  if (!hostname || hostname === "localhost" || hostname === "127.0.0.1") {
    return null;
  }

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.toLowerCase()?.trim();
  if (rootDomain) {
    if (hostname === rootDomain || hostname === `www.${rootDomain}`) return null;
    if (hostname.endsWith(`.${rootDomain}`)) return hostname.slice(0, -(rootDomain.length + 1));
  }

  const parts = hostname.split(".");
  if (parts.length < 2) return null;
  const sub = parts[0];
  if (!sub) return null;
  return sub;
}

/**
 * Get the organization slug from the request host when the request is on a tenant subdomain.
 * Returns null when on root domain, app, www, or localhost (no tenant context).
 *
 * Use in API routes to:
 * - Resolve org from host instead of trusting path/query
 * - Enforce that the request's org (from host) matches the path param when on subdomain
 *
 * @param req - NextRequest (e.g. from route handler)
 * @returns Tenant org slug (e.g. "stellixsoft") or null
 */
export function getOrgSlugFromHost(req: NextRequest): string | null {
  const host = getHost(req);
  const subdomain = getSubdomainFromHost(host);
  if (!subdomain || RESERVED_SUBDOMAINS.has(subdomain)) {
    return null;
  }
  return subdomain;
}

/**
 * Check if the request is from a tenant subdomain (not app/www/localhost).
 */
export function isTenantHost(req: NextRequest): boolean {
  const slug = getOrgSlugFromHost(req);
  return slug !== null;
}
