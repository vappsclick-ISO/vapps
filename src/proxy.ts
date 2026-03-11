import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Subdomains that should NOT be rewritten (main app: login, org list). */
const RESERVED_SUBDOMAINS = new Set(["app", "www", "localhost"]);

/**
 * Get host from request (x-forwarded-host when behind proxy, else Host header).
 */
function getHost(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-host");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const host = request.headers.get("host");
  return host ?? request.nextUrl.host;
}

/**
 * Extract subdomain from host.
 * e.g. stellix.lvh.me:3000 -> stellix; app.lvh.me -> app; localhost:3000 -> null.
 */
function getSubdomain(host: string): string | null {
  const hostname = host.split(":")[0] ?? "";
  if (!hostname || hostname === "localhost" || hostname === "127.0.0.1")
    return null;
  const parts = hostname.split(".");
  if (parts.length < 2) return null;
  const sub = parts[0]?.toLowerCase();
  if (!sub) return null;
  return sub;
}

/**
 * Paths that must never be rewritten by subdomain logic.
 * API routes, auth, and static assets are always passed through.
 */
function shouldSkipRewrite(pathname: string): boolean {
  return (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/auth") ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  );
}

/**
 * Proxy: only subdomain extraction and rewrite to /dashboard/[orgSlug].
 * Organization validation is done in dashboard layout (notFound() if missing).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (shouldSkipRewrite(pathname)) {
    return NextResponse.next();
  }

  const host = getHost(request);
  const subdomain = getSubdomain(host);

  if (!subdomain || RESERVED_SUBDOMAINS.has(subdomain)) {
    return NextResponse.next();
  }

  const basePath = `/dashboard/${subdomain}`;

  // Path already has /dashboard/... (e.g. client Link to /dashboard/slug/processes) – rewrite as-is
  if (pathname.startsWith("/dashboard/")) {
    return NextResponse.rewrite(new URL(pathname, request.url));
  }

  // Root or short path (e.g. /processes) – rewrite to /dashboard/slug/...
  const newPath = pathname === "/" ? basePath : `${basePath}${pathname}`;
  const rewriteUrl = new URL(newPath, request.url);

  return NextResponse.rewrite(rewriteUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:ico|png|jpg|jpeg|gif|webp|svg|woff2?)$).*)",
  ],
};
