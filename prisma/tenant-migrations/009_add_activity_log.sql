-- Add Activity Log table for tracking user actions
-- This migration creates a table to log all important user actions across the system

CREATE TABLE IF NOT EXISTS "activity_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "processId" TEXT NOT NULL,
    "userId" TEXT NOT NULL, -- master DB user.id
    "userName" TEXT, -- cached user name for quick display
    "userEmail" TEXT, -- cached user email
    "action" TEXT NOT NULL, -- e.g., 'issue.created', 'issue.updated', 'sprint.created', 'issue.status_changed'
    "entityType" TEXT NOT NULL, -- e.g., 'issue', 'sprint', 'review', 'verification'
    "entityId" TEXT, -- ID of the affected entity (issue, sprint, etc.)
    "entityTitle" TEXT, -- Title/name of the affected entity for display
    "details" JSONB DEFAULT '{}'::jsonb, -- Additional details about the action
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activity_log_processId_fkey" FOREIGN KEY ("processId") REFERENCES "processes"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_activity_log_processId" ON "activity_log"("processId");
CREATE INDEX IF NOT EXISTS "idx_activity_log_userId" ON "activity_log"("userId");
CREATE INDEX IF NOT EXISTS "idx_activity_log_createdAt" ON "activity_log"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_activity_log_entityType" ON "activity_log"("entityType");
CREATE INDEX IF NOT EXISTS "idx_activity_log_action" ON "activity_log"("action");
