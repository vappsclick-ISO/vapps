/**
 * Request-Level Context Helper
 * 
 * Provides a unified way to get user + tenant context in a single call,
 * eliminating redundant master database queries within the same request.
 */

import { Request } from "next/server";
import { getCurrentUser } from "@/lib/get-server-session";
import { getTenantContext, TenantInfo } from "@/lib/tenant-context";

export interface RequestContext {
  user: { id: string; email: string | null; name: string | null };
  tenant: TenantInfo;
}

// Request-scoped cache (cleared after request completes)
// Using WeakMap so it's automatically garbage collected
const requestCache = new WeakMap<Request, Map<string, RequestContext>>();

/**
 * Get request context (user + tenant) with request-level caching
 * @param req - Next.js request object
 * @param orgId - Organization ID
 * @returns Request context or null if unauthorized
 */
export async function getRequestContext(
  req: Request,
  orgId: string
): Promise<RequestContext | null> {
  // Check request cache first (same request = same context)
  const reqCache = requestCache.get(req);
  if (reqCache) {
    const cached = reqCache.get(orgId);
    if (cached) {
      return cached;
    }
  }

  // Get user (JWT-based, no DB query)
  const user = await getCurrentUser();
  if (!user?.id) {
    return null;
  }

  // Get tenant context (cached for 5 minutes)
  const tenant = await getTenantContext(orgId, user.id);
  if (!tenant) {
    return null;
  }

  const context: RequestContext = {
    user: {
      id: user.id,
      email: user.email ?? null,
      name: user.name ?? null,
    },
    tenant,
  };

  // Cache in request scope
  if (!reqCache) {
    requestCache.set(req, new Map([[orgId, context]]));
  } else {
    reqCache.set(orgId, context);
  }

  return context;
}
