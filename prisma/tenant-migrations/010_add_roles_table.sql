-- Add Roles table for organizational leadership roles
-- This migration creates a table to store organizational roles with leadership levels

CREATE TABLE IF NOT EXISTS "roles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roleName" TEXT NOT NULL,
    "leadershipLevel" INTEGER NOT NULL CHECK ("leadershipLevel" IN (1, 2, 3)),
    "systemRole" TEXT NOT NULL CHECK ("systemRole" IN ('Admin', 'Manager', 'Member')),
    "focus" TEXT NOT NULL CHECK ("focus" IN ('Strategy & Governance', 'Tactical Deployment', 'Daily Execution')),
    "description" TEXT,
    "accessDescription" TEXT,
    "isPreset" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_roles_leadershipLevel" ON "roles"("leadershipLevel");
CREATE INDEX IF NOT EXISTS "idx_roles_systemRole" ON "roles"("systemRole");
CREATE INDEX IF NOT EXISTS "idx_roles_isActive" ON "roles"("isActive");
CREATE INDEX IF NOT EXISTS "idx_roles_isPreset" ON "roles"("isPreset");
