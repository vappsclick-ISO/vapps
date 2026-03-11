/**
 * Build the URL to an organization's dashboard.
 * When subdomain mode is enabled:
 *   - Dev: http://{slug}.lvh.me:3000
 *   - Prod: https://{slug}.{rootDomain}
 */
export function getOrgDashboardUrl(slug: string): string {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  const useSubdomain = process.env.NEXT_PUBLIC_USE_SUBDOMAIN === "true";

  if (useSubdomain && rootDomain) {
    const isDev = process.env.NODE_ENV !== "production";
    const protocol = isDev ? "http:" : "https:";
    const port = process.env.NEXT_PUBLIC_APP_PORT || "3000";
    const portSuffix = isDev ? `:${port}` : "";
    return `${protocol}//${slug}.${rootDomain}${portSuffix}`;
  }

  return `/${slug}`;
}

const RESERVED_SUBDOMAINS = ["app", "www", "localhost"];

/**
 * Whether the current origin is a tenant subdomain (e.g. stellixsoft.vapps.click or stellixsoft.lvh.me).
 * Apex domain (vapps.click) or www.vapps.click is main app, not tenant.
 * Only valid on the client (uses window).
 */
function isTenantSubdomain(): boolean {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1") return false;

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.toLowerCase()?.trim();
  if (rootDomain) {
    if (hostname === rootDomain || hostname === `www.${rootDomain}`) return false;
    if (hostname.endsWith(`.${rootDomain}`)) return true;
  }

  const parts = hostname.split(".");
  const sub = parts.length >= 2 ? parts[0] : null;
  return !!sub && !RESERVED_SUBDOMAINS.includes(sub);
}

/**
 * Build href for dashboard routes (processes, audit, settings, etc.).
 * On a tenant subdomain (e.g. stellixsoft.lvh.me) returns short paths: /processes, /audit, /settings/...
 * Otherwise returns full path: /dashboard/{slug}/processes, etc.
 * Use in Sidebar, Link, router.push for dashboard navigation.
 */
export function getDashboardPath(slug: string, path: string): string {
  const cleanPath = path.replace(/^\/+/, "").replace(/\/+$/, "");
  if (isTenantSubdomain()) {
    return cleanPath ? `/${cleanPath}` : "/";
  }
  return cleanPath ? `/dashboard/${slug}/${cleanPath}` : `/dashboard/${slug}`;
}
