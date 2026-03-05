import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "org_setup_step";
const BASE = "/organization-setup";

/**
 * Proxy: central URL logic.
 *
 * - Auth redirect:
 *   - If user is NOT logged in and hits "/", send to "/auth"
 *   - If user IS logged in and hits "/auth", send to base URL ("/" or NEXT_PUBLIC_BASE_URL)
 *
 * - Onboarding flow guard (existing behavior):
 *   - Tracks highest step reached in HTTP-only cookie (org_setup_step).
 *   - User may visit stepN only if highestReached >= N. Step 1 always allowed.
 *   - Invalid steps redirect to step1. Backward navigation allowed.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ---- Auth redirects ----
  const sessionCookie =
    request.cookies.get("next-auth.session-token") ??
    request.cookies.get("__Secure-next-auth.session-token");
  const isAuthenticated = Boolean(sessionCookie);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "/";

  // If unauthenticated on root, send to /auth
  if ((pathname === "/" || pathname === "") && !isAuthenticated) {
    return NextResponse.redirect(new URL("/auth", request.url));
  }

  // If authenticated on /auth, send to base URL
  if (pathname === "/auth" || pathname === "/auth/") {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL(baseUrl, request.url));
    }
    return NextResponse.next();
  }

  // ---- Onboarding flow guard ----
  const cookieVal = parseInt(request.cookies.get(COOKIE_NAME)?.value ?? "0", 10);
  const highestReached =
    Number.isNaN(cookieVal) || cookieVal < 0 ? 0 : Math.min(cookieVal, 10);

  if (pathname === BASE || pathname === `${BASE}/`) {
    return NextResponse.redirect(new URL(`${BASE}/step1`, request.url));
  }

  const stepMatch = pathname.match(new RegExp(`^${BASE}/step(\\d+)/?$`));
  const isComplete =
    pathname === `${BASE}/complete` || pathname.startsWith(`${BASE}/complete/`);

  if (stepMatch) {
    const stepNum = parseInt(stepMatch[1], 10);
    if (Number.isNaN(stepNum) || stepNum < 1 || stepNum > 11) {
      return NextResponse.redirect(new URL(`${BASE}/step1`, request.url));
    }
    // Step 1 is always allowed (no cookie / 0 = start here); stepN requires highestReached >= N
    if (stepNum > 1 && highestReached < stepNum) {
      const targetStep = highestReached === 0 ? 1 : highestReached;
      return NextResponse.redirect(
        new URL(`${BASE}/step${targetStep}`, request.url)
      );
    }
    return NextResponse.next();
  }

  if (isComplete) {
    if (highestReached < 10) {
      const targetStep = highestReached === 0 ? 1 : highestReached;
      return NextResponse.redirect(
        new URL(`${BASE}/step${targetStep}`, request.url)
      );
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/auth", "/organization-setup", "/organization-setup/:path*"],
};
