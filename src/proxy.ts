import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/** Subdomains that should NOT be rewritten (main app: login, org list). */
const RESERVED_SUBDOMAINS = new Set(["app", "www", "localhost"]);

/** Session cookie name – must match authOptions.cookies.sessionToken.name in auth.ts */
const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";

/**
 * Paths that are public and do NOT require authentication.
 * Users not logged in can access these without being redirected to /auth.
 */
function isPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/auth") ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/forgot-password") ||
    pathname === "/invite" ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/privacy")
  );
}

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
 * Extract tenant subdomain from host.
 * - Apex domain (e.g. vapps.click) or www.vapps.click → null (main app: login, org list).
 * - Tenant subdomain (e.g. stellixsoft.vapps.click) → "stellixsoft".
 * - Dev: app.lvh.me → "app" (reserved), stellixsoft.lvh.me → "stellixsoft".
 */
function getSubdomain(host: string): string | null {
  const hostname = (host.split(":")[0] ?? "").toLowerCase();
  if (!hostname || hostname === "localhost" || hostname === "127.0.0.1")
    return null;

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
 * Proxy: auth redirect for protected routes, then subdomain extraction and rewrite to /dashboard/[orgSlug].
 * Organization validation is done in dashboard layout (notFound() if missing).
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths: no auth check
  if (!isPublicPath(pathname)) {
    const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
    const token = await getToken({
      req: request,
      secret: secret ?? undefined,
      cookieName: SESSION_COOKIE_NAME,
      secureCookie: process.env.NODE_ENV === "production",
    });
    if (!token?.sub) {
      const authUrl = new URL("/auth", request.url);
      authUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(authUrl);
    }
  }

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
