# Subdomain-based multi-tenancy

This app supports organization access via subdomains. The Next.js middleware (via `proxy`) rewrites tenant subdomains to the internal path `/dashboard/[orgSlug]`. Organization validation happens in the dashboard layout; API routes resolve the organization from the request host when on a tenant subdomain and enforce access (403 if the user is not a member).

## How the proxy rewrite works

1. **Request arrives**  
   Example: `http://stellixsoft.lvh.me:3000/processes`

2. **Hostname and subdomain**  
   The middleware reads the host from the request (or `x-forwarded-host` when behind a reverse proxy).  
   - Hostname: `stellixsoft.lvh.me`  
   - Subdomain: `stellixsoft` (first label before the parent domain)

3. **Reserved subdomains (no rewrite)**  
   These are treated as the “main app” (login, org list, auth):  
   - `app`  
   - `www`  
   - `localhost`  

   So `app.lvh.me:3000` is not rewritten and shows the login/org-selection experience.

4. **Tenant subdomain**  
   For any other subdomain (e.g. `stellixsoft`, `acme`):  
   - The proxy **does not** query the database.  
   - It rewrites the request internally to `/dashboard/[subdomain]` and keeps the path.  
   - Organization validation (slug exists, 404 if not) is done in **`src/app/dashboard/[orgId]/layout.tsx`** via `getOrgBySlugOrId` and `notFound()`.

5. **Rewrite examples**  
   - `stellixsoft.lvh.me:3000` → `/dashboard/stellixsoft`  
   - `stellixsoft.lvh.me:3000/processes` → `/dashboard/stellixsoft/processes`  
   - `stellixsoft.lvh.me:3000/settings` → `/dashboard/stellixsoft/settings`  
   - Paths that already start with `/dashboard/` are rewritten as-is (no double-prepend).

   The browser URL stays e.g. `stellixsoft.lvh.me:3000/processes`; only the internal route changes.

6. **Paths that are never rewritten**  
   The proxy does not run subdomain logic (and does not rewrite) for:  
   - `/api/*`  
   - `/api/auth/*`  
   - `/auth*`  
   - `/login`  
   - `/register`  
   - `/_next/*`  
   - `/favicon.ico`  

   So API routes, NextAuth, and auth pages work the same on every host.

## Organization from host in API routes

When a request hits an organization-scoped API (e.g. `/api/organization/[orgId]/sites`), the backend resolves the organization as follows:

- **Tenant subdomain** (e.g. `stellixsoft.lvh.me`): the organization is taken from the **request host** via `getOrgSlugFromHost(req)`, not from the path. So even if the path contains another org id/slug, the effective org is the one from the host. This prevents cross-tenant access by URL manipulation.
- **Non-tenant host** (e.g. `app.lvh.me`): the organization is taken from the path param `orgId` (slug or UUID).

The helper **`lib/get-org-from-host.ts`** provides:

- `getOrgSlugFromHost(req)` – returns the tenant slug when the request is from a tenant subdomain, otherwise `null`.
- `getHost(req)`, `getSubdomainFromHost(host)`, `isTenantHost(req)` – for custom logic.

**`getRequestContext(req, pathOrgSlugOrId)`** (and **`getRequestContextAndError`**) already use this: when the request is from a tenant subdomain, they use the host-derived slug as the org; otherwise they use the path param. So all existing `/api/organization/[orgId]/...` routes automatically “resolve org from host” when the request comes from a tenant subdomain.

Inside API route handlers, the path param **`orgId`** may be a **slug** (e.g. when the frontend calls `/api/organization/stellixsoft/...` from a subdomain). For Prisma and tenant DB lookups, use the **resolved org UUID** from the context: **`ctx.tenant.orgId`**, not the route param. This avoids “organization not found” or “not a member” errors when the path contains a slug. The org owner is treated as a member even without a `UserOrganization` row.

## Security: 401 vs 403

- **401 Unauthorized**: No valid session (user not logged in).  
- **403 Forbidden**: User is logged in but is **not a member** of the organization derived from the request (host or path).

Use **`getRequestContextAndError(req, orgId)`** in API routes to get a ready-made `NextResponse` for 401 or 403:

```ts
const { context, errorResponse } = await getRequestContextAndError(req, orgId);
if (errorResponse) return errorResponse;
// use context.tenant, context.user
```

Existing routes that use `getRequestContext` continue to work; they only return 401 when context is null. Migrating them to `getRequestContextAndError` enables proper 403 for “authenticated but not a member”.

## Cookie configuration (NextAuth)

Sessions must be shared across subdomains so that logging in at `app.lvh.me` keeps you logged in on `stellixsoft.lvh.me`.

### NextAuth cookie options (in `src/lib/auth.ts`)

- **`domain`**  
  Set via **`NEXTAUTH_COOKIE_DOMAIN`**.  
  - Development: `.lvh.me` (so cookies apply to `app.lvh.me`, `stellixsoft.lvh.me`, etc.).  
  - Production: your parent domain, e.g. `.yourapp.com`.

- **Session cookie name**  
  - Production: `__Secure-next-auth.session-token` (secure only).  
  - Development: `next-auth.session-token` so the cookie is sent over HTTP.

- **Other settings** (already applied in code):  
  - **httpOnly**: `true`  
  - **sameSite**: `lax`  
  - **path**: `/`  
  - **secure**: `true` in production, `false` in development  
  - **maxAge**: 30 days  

### Environment variables

| Variable | Purpose |
|----------|--------|
| `NEXTAUTH_COOKIE_DOMAIN` | Parent domain for the session cookie (e.g. `.lvh.me`, `.yourapp.com`). |
| `NEXTAUTH_URL` | Canonical app URL (e.g. `http://app.lvh.me:3000` in dev, `https://app.yourapp.com` in prod). |
| `NEXTAUTH_SECRET` or `AUTH_SECRET` | Secret for signing/verifying the session (required for session in API routes). |
| `NEXT_PUBLIC_USE_SUBDOMAIN` | `true` to redirect org selection to subdomain URLs. |
| `NEXT_PUBLIC_ROOT_DOMAIN` | Root domain for subdomain redirects (e.g. `lvh.me`, `yourapp.com`). |
| `NEXT_PUBLIC_APP_PORT` | Optional; port for dev subdomain URLs (default 3000). |

### Example `.env` (development with lvh.me)

```env
NEXTAUTH_URL=http://app.lvh.me:3000
NEXTAUTH_COOKIE_DOMAIN=.lvh.me
NEXTAUTH_SECRET=your-secret-at-least-32-chars
NEXT_PUBLIC_USE_SUBDOMAIN=true
NEXT_PUBLIC_ROOT_DOMAIN=lvh.me
```

### Example production

```env
NEXTAUTH_URL=https://app.yourapp.com
NEXTAUTH_COOKIE_DOMAIN=.yourapp.com
NEXT_PUBLIC_USE_SUBDOMAIN=true
NEXT_PUBLIC_ROOT_DOMAIN=yourapp.com
```

## Frontend navigation (subdomain vs path)

- **`getOrgDashboardUrl(slug)`** (`lib/subdomain.ts`)  
  Returns the full URL to an org dashboard: on subdomain mode, `http://{slug}.lvh.me:3000` (dev) or `https://{slug}.{rootDomain}` (prod); otherwise path-based `/{slug}`. Use after login/org selection for redirects.

- **`getDashboardPath(slug, path)`** (`lib/subdomain.ts`)  
  Returns the href for dashboard routes so that:
  - On a **tenant subdomain** (e.g. `stellixsoft.lvh.me`): short paths like `/processes`, `/audit`, `/settings`.  
  - On the **root domain** (e.g. `app.lvh.me`): full path `/dashboard/[slug]/processes`, etc.

Use **`getDashboardPath(slug, path)`** for all dashboard links (Sidebar, SettingSidebar, Topbar, audit steps, processes, settings) so that on tenant subdomains the address bar shows short URLs and navigation stays correct on both subdomain and path-based setups.

### Client-side: getting the current org (`useOrg`)

On a **tenant subdomain**, the browser pathname is short (e.g. `/audit`, `/processes`), so **do not** derive the org from the URL path (e.g. with a regex on `/dashboard/([^/]+)/`), or the org will be empty and API calls will not run.

The dashboard layout (**`src/app/dashboard/[orgId]/layout.tsx`**) wraps children with **`OrgProvider`**, which supplies the current org’s **`orgId`** (UUID) and **`slug`**. Any client component under the dashboard (e.g. audit list, settings, process pages) should use **`useOrg()`** from **`@/components/providers/org-provider`** to get `{ orgId, slug }` and use **`slug`** for API paths and **`getDashboardPath(slug, path)`** for links. Example:

```ts
const { slug } = useOrg();
const { data } = useQuery({
  queryKey: ["auditPlans", slug],
  queryFn: () => apiClient.getAuditPlans(slug),
  enabled: !!slug,
});
```

## Development setup (lvh.me)

`lvh.me` resolves to `127.0.0.1`, so you can use real subdomains locally:

- `app.lvh.me:3000` → login / org list  
- `stellixsoft.lvh.me:3000` → organization dashboard (rewritten to `/dashboard/stellixsoft`)  
- `acme.lvh.me:3000` → organization dashboard (rewritten to `/dashboard/acme`)  

Run the app and visit `http://app.lvh.me:3000` (and ensure `app.lvh.me` resolves to 127.0.0.1).

If you use a different port, set it in `NEXTAUTH_URL` and in the URLs you open (e.g. `app.lvh.me:3001`).

## Expected flow

1. User opens **`app.lvh.me:3000`** → middleware does not rewrite → login page or org list.  
2. User signs in at **`app.lvh.me:3000`** → session cookie is set with `domain=.lvh.me`.  
3. User selects an org (e.g. “Stellixsoft”) → app redirects to **`stellixsoft.lvh.me:3000`** (when `NEXT_PUBLIC_USE_SUBDOMAIN=true`).  
4. Request to **`stellixsoft.lvh.me:3000`** → middleware rewrites to **`/dashboard/stellixsoft`**.  
5. Dashboard layout loads, validates org by slug (404 if not found), and renders the org dashboard; session is sent because the cookie domain is `.lvh.me`.  
6. API calls from **`stellixsoft.lvh.me`** use the host-derived org; the backend ensures the user is a member (403 if not).

## After pulling from main: alignment checklist

When you merge or pull from `main`, use this checklist so new code works with the subdomain system.

### 1. Proxy and middleware

- **Check:** There must be **only** `src/proxy.ts` as the entry. Next.js 16 does not use `middleware.ts` for this; having both causes build errors.
- **Align:** If `src/middleware.ts` was re-added, remove it. Do not re-export `config` from proxy in another file.
- **Check:** In `src/proxy.ts`, `shouldSkipRewrite` must still skip: `/api/`, `/auth`, `/login`, `/register`, `/_next/`, `/favicon.ico`. Any new path that must never be rewritten (e.g. a new auth or API prefix) should be added there.

### 2. New API routes under `/api/organization/[orgId]/...`

- **Check:** Every handler must get context with **`getRequestContext(req, orgId)`** or **`getRequestContextAndError(req, orgId)`** (and handle null/errorResponse).
- **Align:** Use **`ctx.tenant.orgId`** (resolved UUID) for all Prisma and tenant DB calls—**not** the route param `orgId`, which may be a slug. Example:
  ```ts
  const ctx = await getRequestContext(req, orgId);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const resolvedOrgId = ctx.tenant.orgId;
  // Use resolvedOrgId for prisma.organization.findUnique, userOrganization, getTenantClient, etc.
  ```
- **Check:** If the route checks “current user is member,” treat the **org owner** as a member even without a `UserOrganization` row (compare `organization.ownerId === ctx.user.id`).

### 3. New dashboard client components (pages under `dashboard/[orgId]/...`)

- **Check:** Components that need the current org must **not** derive it from `pathname` (e.g. regex on `/dashboard/([^/]+)/`), because on a tenant subdomain the path is short (e.g. `/audit`, `/processes`).
- **Align:** Use **`useOrg()`** from `@/components/providers/org-provider` and use **`slug`** for API paths and **`getDashboardPath(slug, path)`** for links:
  ```ts
  const { slug } = useOrg();
  apiClient.someMethod(slug, ...);
  router.push(getDashboardPath(slug, "some/path"));
  ```

### 4. Links and redirects to dashboard or org

- **Check:** Any `Link` `href` or `router.push()` to a dashboard route (processes, audit, settings, etc.) must work on both subdomain and path-based URLs.
- **Align:** Use **`getDashboardPath(slug, path)`** for hrefs (e.g. `getDashboardPath(slug, "processes")` → `/processes` on subdomain, `/dashboard/stellixsoft/processes` on root).
- **Check:** Redirect after login or org selection to the org dashboard must go to the **subdomain** when subdomain mode is on.
- **Align:** Use **`getOrgDashboardUrl(slug)`** and full navigation (e.g. `window.location.href = getOrgDashboardUrl(slug)`) for that redirect—not `router.push('/dashboard/' + slug)`.

### 5. NextAuth and cookies

- **Check:** `src/lib/auth.ts` must keep cookie config that supports subdomains: **`domain: process.env.NEXTAUTH_COOKIE_DOMAIN`**, and session token name **`__Secure-next-auth.session-token`** in production, **`next-auth.session-token`** in development.
- **Align:** If main changed the auth config, restore the cookie options above so the session is sent on tenant subdomains.

### 6. Environment variables

- **Check:** `.env` / `.env.local` still have: `NEXTAUTH_URL`, `NEXTAUTH_COOKIE_DOMAIN`, `NEXTAUTH_SECRET` or `AUTH_SECRET`, `NEXT_PUBLIC_USE_SUBDOMAIN`, `NEXT_PUBLIC_ROOT_DOMAIN` (and optionally `NEXT_PUBLIC_APP_PORT`).
- **Align:** After pulling, re-add or keep these if they were removed or overwritten.

### 7. Quick verification

- Open **`app.lvh.me:3000`** → login → select org → should redirect to **`{slug}.lvh.me:3000`**.
- On **`{slug}.lvh.me:3000`**, open Audits, Processes, Settings; URLs should stay on the subdomain and show short paths (e.g. `/audit`, `/processes`).
- Call an org-scoped API from the subdomain; it should resolve the org from the host and return 200 (not 401/403 for a valid member/owner).

---

## File reference

| File | Purpose |
|------|--------|
| **`src/proxy.ts`** | Next.js proxy entry (do not add `middleware.ts`; Next.js uses `proxy.ts` only). Subdomain detection and rewrite to `/dashboard/[orgSlug]`; no DB access. |
| **`src/lib/get-org-from-host.ts`** | `getOrgSlugFromHost(req)`, `getHost`, `isTenantHost`, reserved subdomains. |
| **`src/lib/request-context.ts`** | `getRequestContext`, `getRequestContextAndError`; resolve org from host when on tenant subdomain; 401/403. |
| **`src/lib/auth.ts`** | NextAuth config, cookie domain and session token name. |
| **`src/lib/subdomain.ts`** | `getOrgDashboardUrl(slug)`, `getDashboardPath(slug, path)` for redirects and links. |
| **`src/app/dashboard/[orgId]/layout.tsx`** | Validates organization by slug/id, `notFound()` if missing; wraps children in `OrgProvider` with `orgId` and `slug`. |
| **`src/components/providers/org-provider.tsx`** | `OrgProvider`, `useOrg()`, `useOrgOptional()`; provides current org `orgId` and `slug` to client components under the dashboard. |
| **`src/app/(auth)/auth/resolve/page.tsx`** | Uses `getOrgDashboardUrl()` to redirect to org subdomain or path after org selection. |
