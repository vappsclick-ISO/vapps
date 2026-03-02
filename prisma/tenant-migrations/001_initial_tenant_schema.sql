-- Tenant Database Initial Schema Migration
-- This migration creates all tables for tenant-specific data

-- Organization Information
CREATE TABLE IF NOT EXISTS "organization_info" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "registrationId" TEXT,
    "address" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "industry" TEXT
);

-- Sites
CREATE TABLE IF NOT EXISTS "sites" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sites_code_key" UNIQUE ("code")
);

-- Processes
CREATE TABLE IF NOT EXISTS "processes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "processes_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Leaders
CREATE TABLE IF NOT EXISTS "leaders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Team Members
CREATE TABLE IF NOT EXISTS "team_members" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "ssoMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "team_members_email_key" UNIQUE ("email")
);

-- Financial Settings
CREATE TABLE IF NOT EXISTS "financial_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "baseCurrency" TEXT,
    "fiscalYearStart" TEXT,
    "defaultTaxRate" TEXT,
    "paymentTerms" TEXT,
    "chartOfAccountsTemplate" TEXT,
    "defaultAssetAccount" TEXT,
    "defaultRevenueAccount" TEXT,
    "defaultExpenseAccount" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Products
CREATE TABLE IF NOT EXISTS "products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "unit" TEXT,
    "cost" TEXT,
    "reorder" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Customers
CREATE TABLE IF NOT EXISTS "customers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Vendors
CREATE TABLE IF NOT EXISTS "vendors" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Workflow Settings
CREATE TABLE IF NOT EXISTS "workflow_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "multiLevelApprovals" BOOLEAN NOT NULL DEFAULT false,
    "automaticTaskAssignment" BOOLEAN NOT NULL DEFAULT false,
    "criticalSLA" TEXT,
    "highPrioritySLA" TEXT,
    "mediumPrioritySLA" TEXT,
    "lowPrioritySLA" TEXT,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "inAppNotifications" BOOLEAN NOT NULL DEFAULT true,
    "smsNotifications" BOOLEAN NOT NULL DEFAULT false,
    "escalationRules" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Dashboard Widgets
CREATE TABLE IF NOT EXISTS "dashboard_widgets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tasksCompleted" BOOLEAN NOT NULL DEFAULT false,
    "complianceScore" BOOLEAN NOT NULL DEFAULT false,
    "workloadByUser" BOOLEAN NOT NULL DEFAULT false,
    "overdueTasks" BOOLEAN NOT NULL DEFAULT false,
    "issueDistribution" BOOLEAN NOT NULL DEFAULT false,
    "auditTrend" BOOLEAN NOT NULL DEFAULT false,
    "projectProgress" BOOLEAN NOT NULL DEFAULT false,
    "documentVersion" BOOLEAN NOT NULL DEFAULT false,
    "reportFrequency" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Security Settings
CREATE TABLE IF NOT EXISTS "security_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "require2FA" BOOLEAN NOT NULL DEFAULT false,
    "ipWhitelisting" BOOLEAN NOT NULL DEFAULT false,
    "sessionTimeout" BOOLEAN NOT NULL DEFAULT false,
    "passwordPolicy" TEXT,
    "sessionDuration" TEXT,
    "logAllActions" BOOLEAN NOT NULL DEFAULT false,
    "logRetention" TEXT,
    "backupFrequency" TEXT,
    "backupRetention" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
-- ===============================
-- SITE USERS
-- ===============================
CREATE TABLE site_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  user_id uuid NOT NULL, -- master DB user.id
  role text DEFAULT 'member',
  added_at timestamptz DEFAULT now(),
  UNIQUE (site_id, user_id)
);

-- ===============================
-- PROCESS USERS
-- ===============================
CREATE TABLE process_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid NOT NULL,
  user_id uuid NOT NULL, -- master DB user.id
  role text DEFAULT 'member',
  added_at timestamptz DEFAULT now(),
  UNIQUE (process_id, user_id)
);

-- ===============================
-- INVITATIONS
-- ===============================
CREATE TABLE invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  site_id uuid,
  process_id uuid,
  role text DEFAULT 'member',
  token text UNIQUE NOT NULL,
  status text DEFAULT 'pending',
  expires_at timestamptz,
  invited_by uuid, -- master user id
  created_at timestamptz DEFAULT now()
);

