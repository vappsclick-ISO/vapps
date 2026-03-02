-- Add Issue Reviews table for storing review dialog data
-- This migration adds a table to store containment, root cause, and action plan data
-- when an issue is moved from "in-progress" to "in-review"
-- 
-- Dependencies: Requires migration 004_add_sprints_and_issues.sql (issues table must exist)
-- This migration runs automatically when a new organization is created via runTenantMigrations()

CREATE TABLE IF NOT EXISTS "issue_reviews" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "issueId" TEXT NOT NULL,
    "containmentText" TEXT,
    "rootCauseText" TEXT,
    "containmentFiles" JSONB DEFAULT '[]'::jsonb, -- Array of file metadata: [{name, size, type, key}] where key is S3 object key
    "rootCauseFiles" JSONB DEFAULT '[]'::jsonb, -- Array of file metadata: [{name, size, type, key}] where key is S3 object key
    "actionPlans" JSONB DEFAULT '[]'::jsonb, -- Array of action plans: [{action, responsible, plannedDate, actualDate, files: [{name, size, type, key}]}] where key is S3 object key
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "issue_reviews_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Unique constraint: one review per issue (upsert will update existing)
-- This also creates an index for faster lookups
CREATE UNIQUE INDEX IF NOT EXISTS "idx_issue_reviews_issueId_unique" ON "issue_reviews"("issueId");
