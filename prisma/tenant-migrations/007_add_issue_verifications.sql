-- Add Issue Verifications table for storing verification and closure data
-- This migration adds a table to store verification data when an issuer marks an issue as effective/ineffective
-- 
-- Dependencies: Requires migration 006_add_issue_reviews.sql (issue_reviews table must exist)
-- This migration runs automatically when a new organization is created via runTenantMigrations()

CREATE TABLE IF NOT EXISTS "issue_verifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "issueId" TEXT NOT NULL,
    "verificationStatus" TEXT NOT NULL, -- 'effective' or 'ineffective'
    "closureComments" TEXT,
    "verificationFiles" JSONB DEFAULT '[]'::jsonb, -- Array of file metadata: [{name, size, type, key}] where key is S3 object key
    "closeOutDate" TIMESTAMP(3),
    "verificationDate" TIMESTAMP(3),
    "signature" TEXT,
    "kpiScore" INTEGER DEFAULT 0,
    "reassignedTo" TEXT, -- User ID if reassigned (ineffective)
    "reassignmentInstructions" TEXT, -- New instructions if ineffective
    "reassignmentDueDate" TIMESTAMP(3), -- New due date if ineffective
    "reassignmentFiles" JSONB DEFAULT '[]'::jsonb, -- Files attached during reassignment
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "issue_verifications_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Unique constraint: one verification per issue (upsert will update existing)
-- This also creates an index for faster lookups
CREATE UNIQUE INDEX IF NOT EXISTS "idx_issue_verifications_issueId_unique" ON "issue_verifications"("issueId");

-- Index for querying by verification status
CREATE INDEX IF NOT EXISTS "idx_issue_verifications_status" ON "issue_verifications"("verificationStatus");
