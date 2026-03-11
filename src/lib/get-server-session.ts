import { getServerSession } from "next-auth/next";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { authOptions } from "./auth";

/** Session cookie name – must match authOptions.cookies.sessionToken.name in auth.ts */
const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";

/**
 * Get the current authenticated user on the server.
 * In Route Handlers, always pass the request so the session is read from the incoming request.
 *
 * @param req - NextRequest (required in API route handlers to read cookies from the request)
 * @returns User from session or null
 */
export async function getCurrentUser(req?: NextRequest) {
  try {
    if (req) {
      const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? authOptions.secret;
      const token = await getToken({
        req,
        secret: secret ?? undefined,
        cookieName: SESSION_COOKIE_NAME,
        secureCookie: process.env.NODE_ENV === "production",
      });
      if (process.env.NODE_ENV === "development" && !token) {
        console.log("[getCurrentUser] getToken returned null – cookie name:", SESSION_COOKIE_NAME, "secret set:", !!secret);
      }
      if (!token?.sub) return null;
      return {
        id: token.sub,
        name: (token.name as string) ?? null,
        email: (token.email as string) ?? null,
      };
    }
    const session = await getServerSession(authOptions);
    return session?.user ?? null;
  } catch (error) {
    console.error("Error getting server session:", error);
    return null;
  }
}
