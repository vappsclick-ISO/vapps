# VApps — Application Architecture

This document describes the overall architecture of the VApps application: tech stack, data flow, multi-tenancy, authentication, and deployment.

---

## 1. Overview

**VApps** is a multi-tenant SaaS platform for managing organizations, processes, teams, issues, and audits. It uses:

- **Next.js 16** (App Router) for the full-stack app
- **PostgreSQL** for persistence (one main DB + one DB per tenant)
- **NextAuth** for authentication (JWT + OAuth + credentials)
- **AWS S3** for file storage
- **Prisma** for the main database only; tenant DBs use raw SQL and connection pooling

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser)                                │
│  React 19 • Next.js App Router • TanStack Query • Zustand • Radix UI        │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NEXT.JS APPLICATION (EC2 / Vercel)                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Pages /   │  │  API Routes │  │  Middleware  │  │  Server Components  │  │
│  │   Layouts   │  │  (REST)     │  │  (optional)  │  │  & Server Actions   │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                │                     │            │
│         └────────────────┴────────────────┴─────────────────────┘            │
│                                    │                                          │
│  ┌────────────────────────────────┼──────────────────────────────────────┐  │
│  │                    SHARED LIBRARIES                                     │  │
│  │  auth • get-server-session • permissions • prisma • tenant-pool • S3   │  │
│  └────────────────────────────────┬──────────────────────────────────────┘  │
└───────────────────────────────────┼─────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────┐         ┌───────────────────┐         ┌───────────────┐
│  MAIN DB      │         │  TENANT DBs       │         │  AWS S3       │
│  (Prisma)     │         │  (per org, raw pg)│         │  (uploads)    │
│  Users, Orgs, │         │  Sites, Processes,│         │  Avatars,     │
│  Sessions,    │         │  Issues, Audits,  │         │  Issue files  │
│  Invitations  │         │  Tasks, etc.      │         │               │
└───────────────┘         └───────────────────┘         └───────────────┘
```

---

## 3. Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 16 (App Router) |
| **UI** | React 19, Radix UI, Tailwind CSS 4, Lucide icons |
| **State** | Zustand (onboarding, etc.), TanStack React Query (server state) |
| **Forms** | React Hook Form, Zod |
| **Auth** | NextAuth 4 (JWT strategy, Prisma adapter for DB) |
| **Main DB** | PostgreSQL + Prisma ORM |
| **Tenant DBs** | PostgreSQL, raw SQL via `pg`, connection pooling per org |
| **Files** | AWS S3 (presigned URLs, upload/download APIs) |
| **Email** | Nodemailer (SMTP) |
| **Drag & Drop** | @hello-pangea/dnd, @dnd-kit |
| **Calendar** | FullCalendar |
| **Charts** | Recharts |
| **Rich text** | Froala Editor |

---

## 4. Multi-Tenancy Model

### 4.1 Two-Database Model

- **Main database** (`DATABASE_URL`): Single PostgreSQL database used by Prisma. It stores:
  - **Users**, **Accounts**, **Sessions** (NextAuth)
  - **Organizations**, **UserOrganization** (membership + role)
  - **OrgDatabaseInstance** (per-org tenant DB connection details)
  - **Invitations**, **VerificationToken**, **EmailChangeRequest**, **UserNotificationDismissal**

- **Tenant databases**: One PostgreSQL database per organization (`org_<orgId>`). Created on organization creation. Store:
  - Organization info, sites, processes, leaders, team members
  - Financial settings, products, customers, vendors
  - Issues, tasks, sprints, audit plans, audit checklists, activity log, etc.

Tenant DBs live on the **same PostgreSQL server** as the main DB (e.g. RDS/Aurora). Connection details are in `OrgDatabaseInstance` (host, port, user, password, `connectionString`).

### 4.2 Tenant Lifecycle

1. **Create org**  
   - `POST /api/organization/create` (with full onboarding payload).  
   - Calls `createTenantDatabase(orgId)` (uses `RDS_ADMIN_URL`): creates DB `org_<orgId>`, dedicated user, grants.  
   - Runs `runTenantMigrations()` (SQL files in `prisma/tenant-migrations/`).  
   - Calls `storeTenantData(connectionString, orgName, data)` to seed organization info, sites, processes, leaders, etc.  
   - Inserts `Organization` and `OrgDatabaseInstance` in the main DB and links the user as owner.

2. **Runtime access**  
   - Resolve `orgId` from URL (e.g. `[orgId]` in route).  
   - Load tenant connection from main DB (or from cache).  
   - Use `getTenantPool(orgId)` / `queryTenant()` / `withTenantTransaction()` from `src/lib/db/tenant-pool.ts` for all tenant reads/writes.

3. **Connection pooling**  
   - `tenant-pool.ts` keeps a **singleton pool per org** in memory.  
   - Connection strings are cached (e.g. 10 min TTL).  
   - Health checks and timeouts avoid stale or dead pools.

### 4.3 Key Files

| Purpose | File(s) |
|---------|--------|
| Create tenant DB + run migrations | `src/lib/db-creator.ts` |
| Tenant connection pooling & queries | `src/lib/db/tenant-pool.ts` |
| One-off tenant connection by URL | `src/lib/db/connection-helper.ts` |
| Seed tenant data from onboarding | `src/lib/store-tenant-data.ts` |
| Tenant schema (SQL) | `prisma/tenant-migrations/*.sql` |
| Main schema | `prisma/schema.prisma` |

---

## 5. Authentication & Authorization

### 5.1 Authentication (NextAuth)

- **Strategy**: JWT (sessions stored in JWT, not DB).
- **Providers**: Credentials (email/password), Google, GitHub, Apple, Atlassian.
- **Adapter**: Prisma adapter for user/account/session persistence (used for OAuth linking and DB-backed user data).
- **Credentials**: Email + password; password checked with bcrypt; `emailVerified` must be set for login.
- **Custom pages**: Sign-in at `/auth`; redirects preserved (e.g. invite token in URL).
- **Session callback**: Enriches session with current `name`, `email`, `image` from main DB.
- **Config**: `src/lib/auth.ts`; route: `src/app/api/auth/[...nextauth]/route.ts`.

### 5.2 Session on the Server

- **Get current user**: `getCurrentUser()` in `src/lib/get-server-session.ts` (uses `getServerSession(authOptions)`).
- Used in API routes and server components to require login and to scope by `userId` or `orgId`.

### 5.3 Authorization (RBAC)

- **Model**: Role-based access per organization. Roles: **owner**, **admin**, **manager**, **member** (and custom roles in tenant DB).
- **Storage**: `Organization.permissions` (JSON) defines a matrix of permission keys × roles (e.g. `manage_teams`, `manage_sites`, `create_issues`, `verify_issues`, etc.).
- **Helpers**: `src/lib/permissions.ts` — e.g. `getPermissionsForOrg(orgId)`, check if current user’s role has a given permission.
- **Usage**: API routes and UI gate features by role/permission (e.g. settings, invite, delete user).

### 5.4 Invitations

- **Invitation** model in main DB: token, org, email, role, optional site/process, `additionalRoleIds`, status, expiry.
- **Accept flow**: User hits invite link/code → `invites/accept` (or similar) → create/update `UserOrganization`, mark invitation accepted.
- Optional: assign to site/process and additional roles in tenant DB.

---

## 6. Application Structure (Next.js App Router)

### 6.1 Route Layout

```
src/app/
├── layout.tsx                    # Root: AuthProvider, QueryProvider, Toaster
├── page.tsx                      # Home: org list, create org, join org
├── (auth)/
│   ├── auth/
│   │   ├── page.tsx              # Sign-in
│   │   ├── resolve/page.tsx      # OAuth/invite resolve
│   │   └── invite/page.tsx       # Invite entry
│   └── forgot-password/page.tsx
├── (onboarding)/
│   └── organization-setup/
│       ├── step1/ … step11/     # Multi-step org onboarding
│       └── complete/page.tsx
├── dashboard/[orgId]/            # Main app under an org
│   ├── layout.tsx               # Sidebar + Topbar
│   ├── page.tsx                 # Org dashboard home
│   ├── audit/                    # Audit plans, history, create (steps 1–6)
│   ├── processes/
│   │   └── [processId]/         # Process: board, backlog, tasks, issues, calendar, reports, etc.
│   ├── settings/                 # Org settings, roles, teams, sites, notifications, billing, etc.
│   └── account/page.tsx
├── invite/page.tsx
├── welcome/page.tsx
└── api/                          # REST API (see below)
```

- **`[orgId]`**: Optional slug/ID in URL; `app/[orgId]/*` re-exports from `app/dashboard/[orgId]/*` for compatibility.
- **Onboarding**: Steps 1–11 collect company info, sites/processes, leaders, products, customers/vendors, workflows, etc. State is in Zustand (`src/store/onboardingStore.ts`); completion is synced via `/api/organization-setup/complete-step` (e.g. cookie for step reached).

### 6.2 API Routes (REST)

All under `src/app/api/`. Key groups:

| Area | Path pattern | Purpose |
|------|----------------|--------|
| **Auth** | `auth/[...nextauth]`, `auth/register`, `auth/verify-email*` | NextAuth, registration, email verification |
| **User** | `user/profile`, `user/profile/avatar`, `user/avatar` | Profile and avatar (S3) |
| **Organization** | `organization/list`, `organization/create` | List orgs, create org (tenant DB + main DB) |
| **Per-org** | `organization/[orgId]/*` | All org-scoped data |
| **Org sub-routes** | `members`, `sites`, `roles`, `permissions`, `metadata`, `notifications`, `me`, `tenant-info`, `organization-info` | Members, sites, roles, permissions, notifications, etc. |
| **Processes** | `organization/[orgId]/processes`, `.../processes/[processId]` | CRUD processes |
| **Tasks** | `.../processes/[processId]/tasks`, `.../tasks/[taskId]` | Tasks |
| **Issues** | `.../processes/[processId]/issues`, `.../issues/[issueId]` | Issues, claim, verify, review |
| **Sprints** | `.../processes/[processId]/sprints`, `.../sprints/[sprintId]` | Sprints |
| **Audit** | `.../audit/plans`, `.../audit/programs`, `.../audit-checklists`, `.../audit/checklist-questions` | Audit plans, programs, checklists |
| **Files** | `files/upload`, `files/froala/upload`, `files/audit-upload`, `files/download` | S3 upload/download, Froala, audit assets |
| **Invites** | `invites/accept` | Accept invitation |
| **Setup** | `organization-setup/complete-step` | Onboarding step completion |

Most org-scoped routes:

1. Resolve session via `getCurrentUser()`.
2. Resolve `orgId` from params and optionally check membership/role.
3. Use `getTenantPool(orgId)` / `queryTenant()` for tenant data and `prisma` for main DB (users, orgs, invitations).

---

## 7. Data Flow Examples

### 7.1 Organization creation

1. User completes onboarding UI (steps 1–11); state in Zustand.
2. Client sends `POST /api/organization/create` with full onboarding payload.
3. Server: auth check → `createTenantDatabase(orgId)` → `runTenantMigrations()` → `storeTenantData(...)` → create `Organization` + `OrgDatabaseInstance` + `UserOrganization` in main DB.
4. Redirect to new org dashboard.

### 7.2 Loading process issues

1. User opens `dashboard/[orgId]/processes/[processId]/issues`.
2. Page or layout loads; server gets `orgId`, `processId` from params, session from `getCurrentUser()`.
3. Server (or API route) calls `queryTenant(orgId, "SELECT * FROM issues WHERE process_id = $1", [processId])` (or similar).
4. UI renders list; mutations go to `api/organization/[orgId]/processes/[processId]/issues` (and sub-routes).

### 7.3 File upload (e.g. issue attachment)

1. Client sends file to `POST /api/files/upload` (or audit/avatar-specific route) with `orgId`, `processId`, `issueId` (or equivalent).
2. Server checks auth and optionally org access, then uses `src/lib/s3.ts` to upload to S3 (key often like `orgId/processId/issueId/...`).
3. For private files, download is via presigned URL (e.g. `GET /api/files/download?key=...`) or similar.

---

## 8. File Storage (S3)

- **Library**: `src/lib/s3.ts` (AWS SDK v3: PutObject, GetObject, DeleteObject, presigner).
- **Config**: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET_NAME`, optional `AWS_S3_UPLOAD_FOLDER`.
- **Usage**: User avatars, issue attachments, Froala uploads, audit-related files. Keys are prefixed by org/process/issue (or similar) for isolation.

---

## 9. Frontend Architecture

- **Root layout**: `AuthProvider` (NextAuth session), `QueryProvider` (TanStack Query), global Toaster.
- **Dashboard layout**: Sidebar (nav per org) + Topbar; main content area.
- **State**: Server state via TanStack Query; client state (e.g. onboarding) via Zustand; form state via React Hook Form.
- **UI**: Radix primitives, Tailwind, shared components under `src/components/` (e.g. `ui/`, `dashboard/`, `common/`).
- **Forms**: Zod schemas in `src/schemas/` (e.g. onboarding step schemas).

---

## 10. Deployment

- **Runtime**: Node 18+ (e.g. 20 LTS). Build: `npm run build`; start: `npm run start` (or PM2/systemd on EC2).
- **Main DB & tenant DBs**: Same PostgreSQL server (e.g. Amazon RDS or Aurora). `DATABASE_URL` = main DB; `RDS_ADMIN_URL` = admin URL for creating tenant DBs and users.
- **Env**: See `docs/AWS-EC2-RDS-Deployment-Guide.md` for full list (NextAuth, OAuth, S3, SMTP, etc.).
- **Multi-tenant**: No separate app per tenant; single app, tenant isolation by `orgId` and per-org DB and pool.

---

## 11. Summary Diagram

```
User → Next.js (App Router)
         → Auth (NextAuth, JWT)
         → Main DB (Prisma): users, orgs, invitations, org DB credentials
         → Tenant DB (pg pool per org): sites, processes, issues, tasks, audits
         → S3: files
         → SMTP: email
```

For deployment details and environment variables, see **AWS-EC2-RDS-Deployment-Guide.md**.
