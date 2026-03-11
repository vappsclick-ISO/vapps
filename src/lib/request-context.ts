/**
 * Request-Level Context Helper
 *
 * Provides a unified way to get user + tenant context. When the request is from
 * a tenant subdomain (e.g. stellixsoft.lvh.me), the organization is derived from
 * the host so the backend does not trust client-supplied org in the path.
 * User must belong to the org (getTenantContext returns null otherwise) → 403 if not.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-server-session";
import { getTenantContext, TenantInfo } from "@/lib/tenant-context";
import { getOrgSlugFromHost } from "@/lib/get-org-from-host";

export interface RequestContext {
  user: { id: string; email: string | null; name: string | null };
  tenant: TenantInfo;
}

const requestCache = new WeakMap<NextRequest, Map<string, RequestContext>>();

/**
 * Resolve which org slug/id to use for this request.
 * On tenant subdomain: use host-derived slug (source of truth; path param must match or is ignored).
 * Otherwise: use pathOrgSlugOrId from URL.
 */
function resolveOrgSlugOrId(req: NextRequest, pathOrgSlugOrId: string): string {
  const hostSlug = getOrgSlugFromHost(req);
  if (hostSlug) {
    return hostSlug;
  }
  return pathOrgSlugOrId;
}

/**
 * Get request context (user + tenant) with request-level caching.
 * When the request is from a tenant subdomain (e.g. stellixsoft.lvh.me), the
 * organization is taken from the host; otherwise from the path param.
 * Returns null if unauthorized or user does not belong to the org (security).
 *
 * @param req - Next.js request object
 * @param pathOrgSlugOrId - Organization slug or id from URL path (e.g. [orgId] param)
 * @returns Request context or null if unauthorized / not a member
 */
export async function getRequestContext(
  req: NextRequest,
  pathOrgSlugOrId: string
): Promise<RequestContext | null> {
  const out = await getRequestContextWithStatus(req, pathOrgSlugOrId);
  return out.context;
}

export type RequestContextResult =
  | { context: RequestContext; errorResponse: null }
  | { context: null; errorResponse: Response };

/**
 * Get request context and an error response for API routes.
 * Use in route handlers to return 401 Unauthorized (no session) or 403 Forbidden (not a member of the org).
 *
 * @example
 * const { context, errorResponse } = await getRequestContextAndError(req, orgId);
 * if (errorResponse) return errorResponse;
 * // use context
 */
export async function getRequestContextAndError(
  req: NextRequest,
  pathOrgSlugOrId: string
): Promise<RequestContextResult> {
  const { context, status } = await getRequestContextWithStatus(req, pathOrgSlugOrId);
  if (context) return { context, errorResponse: null };
  if (status === "forbidden") {
    return { context: null, errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { context: null, errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
}

async function getRequestContextWithStatus(
  req: NextRequest,
  pathOrgSlugOrId: string
): Promise<{ context: RequestContext | null; status: "ok" | "unauthorized" | "forbidden" }> {
  const orgSlugOrId = resolveOrgSlugOrId(req, pathOrgSlugOrId);

  const reqCache = requestCache.get(req);
  if (reqCache) {
    const cached = reqCache.get(orgSlugOrId);
    if (cached) return { context: cached, status: "ok" };
  }

  const user = await getCurrentUser(req);
  if (!user?.id) return { context: null, status: "unauthorized" };

  const tenant = await getTenantContext(orgSlugOrId, user.id);
  if (!tenant) return { context: null, status: "forbidden" };

  const context: RequestContext = {
    user: {
      id: user.id,
      email: user.email ?? null,
      name: user.name ?? null,
    },
    tenant,
  };

  if (!reqCache) {
    requestCache.set(req, new Map([[orgSlugOrId, context]]));
  } else {
    reqCache.set(orgSlugOrId, context);
  }

  return { context, status: "ok" };
}
