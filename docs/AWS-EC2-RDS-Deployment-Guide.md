# AWS EC2 + RDS/Aurora Deployment Guide

This document covers:
1. **Project requirements** for deploying the vapps Next.js application on AWS EC2
2. **Integrating Amazon RDS (PostgreSQL)** and **Amazon Aurora PostgreSQL**
3. **Recommended architecture** and setup for both options
4. **Performance impact**: whether RDS/Aurora will slow your product

---

## 1. Project Requirements for EC2 Deployment

Your application is a **Next.js 16** app with **Prisma + PostgreSQL** (pg driver), **NextAuth**, **AWS S3**, **multi-tenant databases**, and **SMTP**. Below are the concrete requirements for running it on EC2.

### 1.1 Runtime & Build

| Requirement | Details |
|-------------|---------|
| **Node.js** | v18.x or v20.x LTS (Next.js 16 supports both) |
| **Build** | `npm run build` (or `pnpm build` / `yarn build`) |
| **Start** | `npm run start` (runs `next start`; default port 3000) |
| **Process manager** | Use **PM2** or **systemd** for production so the app restarts on crash |

### 1.2 Environment Variables (Required on EC2)

Set these on the EC2 instance (e.g. in `.env` or via AWS Systems Manager Parameter Store / Secrets Manager):

| Variable | Purpose | Example |
|----------|---------|---------|
| `DATABASE_URL` | Main app DB (users, orgs, sessions). **Points to RDS or Aurora.** | `postgresql://user:pass@your-rds-endpoint:5432/maindb?schema=public` |
| `RDS_ADMIN_URL` | Admin connection for **creating tenant databases** (CREATE DATABASE, CREATE USER). Must be a superuser-capable URL. | `postgresql://admin:pass@your-rds-endpoint:5432/postgres` |
| `NEXTAUTH_SECRET` | NextAuth session encryption | Random 32+ char string |
| `NEXTAUTH_URL` | Canonical app URL (for OAuth callbacks, cookies) | `https://yourdomain.com` |
| `NEXT_PUBLIC_APP_URL` | Public app URL (invite links, emails) | `https://yourdomain.com` |
| **OAuth (optional)** | | |
| `GOOGLE_ID` / `GOOGLE_SECRET` | Google OAuth | |
| `GITHUB_ID` / `GITHUB_SECRET` | GitHub OAuth | |
| `APPLE_ID` / `APPLE_SECRET` | Apple OAuth | |
| `ATLASSIAN_ID` / `ATLASSIAN_SECRET` | Atlassian OAuth | |
| **AWS S3** | | |
| `AWS_ACCESS_KEY_ID` | IAM credentials for S3 | |
| `AWS_SECRET_ACCESS_KEY` | | |
| `AWS_REGION` | e.g. `eu-north-1` | |
| `AWS_S3_BUCKET_NAME` | Bucket for uploads | |
| `AWS_S3_UPLOAD_FOLDER` | Optional; default `issue-reviews` | |
| **SMTP** | | |
| `SMTP_HOST` | e.g. `email-smtp.eu-north-1.amazonaws.com` (SES) or Mailtrap | |
| `SMTP_PORT` | 587 (TLS) or 2525 | |
| `SMTP_USER` / `SMTP_PASS` | SMTP credentials | |
| `SMTP_FROM` | From address for emails | |
| **Other** | | |
| `NODE_ENV` | `production` on EC2 | |

### 1.3 Multi-Tenant Database Model (Important for RDS/Aurora)

Your app uses:

- **One main database** (`DATABASE_URL`): users, sessions, organizations, invitations, and **per-org tenant DB connection info** (`OrgDatabaseInstance`: `dbHost`, `dbPort`, `connectionString`, etc.).
- **One PostgreSQL server** (RDS or Aurora) can host **multiple databases**: one main DB (e.g. `vapps_main`) and many tenant DBs (e.g. `org_<uuid>`). Your `db-creator.ts` already creates tenant DBs and users on the same host as `RDS_ADMIN_URL`.

So for a single RDS/Aurora instance:

- `DATABASE_URL` → main database (e.g. `vapps_main`)
- `RDS_ADMIN_URL` → same host, admin user (e.g. `postgres` or a superuser), used only when **creating** a new org and its tenant DB

### 1.4 Network & Security (EC2)

- **Inbound**: Allow **HTTPS (443)** and **HTTP (80)** from the internet (or from an ALB only) and **22** for SSH if you manage the instance.
- **Outbound**: Allow **5432** to RDS/Aurora, **443** to S3 and other AWS/public endpoints.
- EC2 and RDS/Aurora should be in the **same VPC** (and ideally same subnet or subnets that can talk to the DB subnet) so DB traffic stays private.

### 1.5 Disk & Resources (EC2)

- **Build**: Next.js build can use ~2–4 GB RAM; ensure enough memory during `npm run build`.
- **Runtime**: 1–2 GB RAM is often enough for a single instance; scale up if you run multiple Node processes (e.g. cluster mode).
- **Disk**: 10–20 GB for OS + app + logs is usually sufficient.

---

## 2. Integrating Amazon RDS (PostgreSQL) with Your Project

Your codebase is **already compatible** with RDS:

- **Prisma** uses `DATABASE_URL` (see `prisma/schema.prisma`).
- **`src/lib/prisma.ts`** uses `pg` Pool with `getSSLConfig(connectionString)`: for any host that is **not** localhost, it enables SSL (`rejectUnauthorized: false`), which matches RDS.
- **`src/lib/db/ssl-config.ts`** implements this: localhost → no SSL; other hosts (e.g. RDS) → SSL.

### 2.1 Steps to Use RDS PostgreSQL

1. **Create an RDS PostgreSQL instance** (e.g. 15 or 16) in the same region as your EC2.
2. **Create a database** on it (e.g. `vapps_main`) for the main app.
3. **Create two users** (or use one with superuser for both, only for small setups):
   - **App user**: used in `DATABASE_URL`; needs full access only to `vapps_main`.
   - **Admin user**: used in `RDS_ADMIN_URL`; needs privileges to create databases and users (e.g. `rds_superuser` or equivalent).
4. **Connection strings**:
   - `DATABASE_URL`:  
     `postgresql://appuser:password@your-rds-endpoint.region.rds.amazonaws.com:5432/vapps_main?schema=public`
   - `RDS_ADMIN_URL`:  
     `postgresql://adminuser:password@your-rds-endpoint.region.rds.amazonaws.com:5432/postgres`
5. **Security group**: Allow **port 5432** from the EC2 security group (or from the VPC CIDR where EC2 lives). Do not open 5432 to 0.0.0.0/0.
6. **Run migrations** from EC2 (or from a one-off task):
   - `npx prisma migrate deploy`
7. **Optional**: Store `DATABASE_URL` and `RDS_ADMIN_URL` in **Secrets Manager** and inject them at startup (e.g. via a small script or use of Parameter Store).

No code changes are required; only configuration.

---

## 3. Integrating Amazon Aurora PostgreSQL with Your Project

Aurora PostgreSQL is **wire-compatible** with PostgreSQL. Your app talks to it via a **single endpoint** (writer) the same way as RDS.

### 3.1 Differences from RDS (for your app)

| Aspect | RDS PostgreSQL | Aurora PostgreSQL |
|--------|----------------|-------------------|
| **Endpoint** | One instance endpoint | Cluster endpoint (writer) + optional reader endpoint |
| **Connection string** | Same format | Same format; use **cluster writer endpoint** for `DATABASE_URL` and `RDS_ADMIN_URL` |
| **Multi-DB / CREATE DATABASE** | Supported | Supported (writer) |
| **Scaling** | Single instance; scale vertically | Read replicas (reader endpoint); storage auto-scales |

### 3.2 Steps to Use Aurora PostgreSQL

1. **Create an Aurora PostgreSQL cluster** (compatible with your PostgreSQL version).
2. **Create the main database** (e.g. `vapps_main`) on the writer instance.
3. **User and URLs**: Same idea as RDS:
   - **App user** for `DATABASE_URL` (writer endpoint, database `vapps_main`).
   - **Admin user** for `RDS_ADMIN_URL` (writer endpoint, database `postgres`) for creating tenant DBs.
4. **Endpoints**:
   - Writer: `your-cluster.cluster-xxxx.region.rds.amazonaws.com`
   - Use this for both `DATABASE_URL` and `RDS_ADMIN_URL` so that tenant creation and all writes go to the writer.
5. **Reader endpoint** (optional): Use only if you add **read-only** query paths (e.g. reporting) in a future iteration. Your current code does not use a reader endpoint; everything can go to the writer.
6. **Security group**: Same as RDS — allow 5432 from EC2 (or app layer) only.
7. **Migrations**: `npx prisma migrate deploy` against the writer endpoint.

Again, **no application code changes**; only connection strings and possibly IAM auth if you switch to that later.

---

## 4. Recommended Architecture and Setup

### 4.1 High-Level Diagram (EC2 + RDS or Aurora)

```
                    Internet
                        │
                        ▼
              ┌─────────────────┐
              │   Route 53 /     │
              │   DNS            │
              └────────┬─────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  Application     │
              │  Load Balancer   │  (HTTPS, optional SSL cert from ACM)
              └────────┬─────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
         ▼             ▼             ▼
   ┌──────────┐ ┌──────────┐ ┌──────────┐
   │  EC2 #1  │ │  EC2 #2  │ │  EC2 #N  │   (Next.js app, same VPC)
   └────┬─────┘ └────┬─────┘ └────┬─────┘
        │            │            │
        └────────────┼────────────┘
                     │ 5432 (private)
                     ▼
        ┌────────────────────────────┐
        │  RDS PostgreSQL             │
        │  or                          │
        │  Aurora PostgreSQL (writer) │
        │  - vapps_main                │
        │  - org_xxx (tenant DBs)      │
        └────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
   ┌─────────┐ ┌─────────┐ ┌─────────┐
   │   S3    │ │  SES    │ │  IAM    │
   └─────────┘ └─────────┘ └─────────┘
```

### 4.2 Recommended Setup (Single-Region, Production-Like)

| Component | Recommendation |
|-----------|----------------|
| **EC2** | One or more instances in a **private subnet** (no direct public IP for app), or in a public subnet with strict SG. Minimum **t3.small** (2 vCPU, 2 GB RAM); **t3.medium** for more headroom. |
| **Load balancer** | **ALB** in public subnets; HTTPS listener (certificate from **ACM**); forward to EC2 on port 3000. |
| **Database** | **RDS PostgreSQL** or **Aurora PostgreSQL** in **private subnets**, same VPC as EC2. |
| **RDS** | Instance in **private subnet**; security group allows **5432** only from EC2 security group. Multi-AZ optional for HA. |
| **Aurora** | Cluster in **private subnets**; same SG rule. Enable **backtrack** and **aurora_replica** if you add readers later. |
| **Secrets** | Store `DATABASE_URL`, `RDS_ADMIN_URL`, `NEXTAUTH_SECRET`, and OAuth/SMTP secrets in **Secrets Manager**; grant EC2 instance role read access; load at startup. |
| **S3** | Existing bucket; EC2 instance role or IAM user keys in env; ensure bucket policy and S3 VPC endpoint if you want private access. |

### 4.3 Single EC2 + Single RDS (Minimal)

- One **EC2** (e.g. t3.small) with Node.js, PM2, and your app.
- One **RDS PostgreSQL** instance (e.g. db.t3.micro or db.t3.small).
- **DATABASE_URL** and **RDS_ADMIN_URL** point to this RDS.
- **ALB** (or no ALB and direct EC2 public IP for testing only).

### 4.4 Single EC2 + Aurora (Scalable DB)

- One **EC2** (or more behind ALB).
- One **Aurora PostgreSQL** cluster; use **writer endpoint** for both `DATABASE_URL` and `RDS_ADMIN_URL`.
- Same VPC, same security group rules as above.
- When you need read scaling, add a **reader** and use the reader endpoint only for read-only queries (requires code changes).

---

## 5. Will RDS / Aurora Slow My Product?

**Short answer: No, if you follow good practices.** Using RDS or Aurora in the same region and VPC as your app typically adds only a few milliseconds of latency compared to a DB on the same machine. Your app is already built for remote DBs (connection pooling, timeouts, SSL).

### 5.1 Why It Usually Does Not Slow You Down

1. **Latency**
   - **Same region + same VPC**: DB round-trip is often **1–5 ms**.
   - Your **Prisma + pg Pool** (`src/lib/prisma.ts`) already use connection pooling (e.g. `max: 5`), so you reuse connections and avoid repeated connect overhead.
   - Query time is dominated by **query execution**, not network, for normal OLTP workloads.

2. **Your code is already tuned**
   - Pool timeouts and `statement_timeout` (e.g. 120s) are set.
   - SSL is handled for non-localhost (RDS/Aurora).
   - So moving from a local DB to RDS in the same VPC is a small change in latency.

3. **Aurora**
   - Can be **faster** than single-instance RDS for some workloads (e.g. read-heavy with replicas, or storage throughput).
   - For a single writer, behavior is similar to RDS; you don’t lose performance by choosing Aurora.

### 5.2 When It Could Feel Slow

| Situation | Mitigation |
|-----------|------------|
| **DB in another region** | Put RDS/Aurora in the **same region** (and ideally same AZ) as EC2. |
| **Security group / NACL blocks traffic** | App will hang or timeout; ensure **5432 from EC2 SG to RDS SG** is allowed. |
| **Tiny RDS instance** (e.g. db.t3.micro, 1 vCPU, low memory) | Upgrade to **db.t3.small** or larger; monitor CPU and connections. |
| **Too many connections** | RDS has a **max_connections** limit. Your pool is 5 per process; with 2–3 Node processes you stay low. Don’t set pool size too high. |
| **No connection pooling** | You already have pooling; keep it. |
| **Slow queries** | Use RDS Performance Insights / CloudWatch; optimize indexes and queries. |

### 5.3 Summary

- **RDS or Aurora in the same VPC as EC2**: Typically **does not** make your product meaningfully slower; latency is in the low single-digit ms.
- **Connection pooling** (which you have) is the right approach.
- **Same region** and **appropriate instance size** are the main requirements for good performance.

---

## 6. Checklist: Deploying on EC2 with RDS or Aurora

- [ ] Create VPC and subnets (public for ALB, private for EC2 and DB).
- [ ] Create RDS PostgreSQL or Aurora PostgreSQL in private subnet(s).
- [ ] Create main database (e.g. `vapps_main`) and app + admin users.
- [ ] Security group: allow 5432 from EC2 to RDS/Aurora only.
- [ ] EC2: install Node 18/20, clone repo, `npm ci`, `npm run build`.
- [ ] Set all required env vars (or load from Secrets Manager); include `DATABASE_URL`, `RDS_ADMIN_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, S3, SMTP.
- [ ] Run `npx prisma migrate deploy` against `DATABASE_URL`.
- [ ] Start app with `npm run start` or PM2; open port 3000 to ALB only.
- [ ] ALB: HTTPS listener, target group = EC2:3000.
- [ ] (Optional) Use an AMI + User Data or IaC (Terraform/CloudFormation) to automate the above.

This gives you a clear path to run vapps on **EC2** with **Amazon RDS (PostgreSQL)** or **Amazon Aurora PostgreSQL**, with a recommended architecture and the assurance that RDS/Aurora, when used correctly, **does not** inherently slow your product.
