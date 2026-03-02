-- Add issuer and verifier columns to issues table
-- issuer: user_id of the person who created the issue (Top or Operational leadership)
-- verifier: user_id of the person who verifies the task (typically the issuer)
-- assignee: already exists, stores user_id of Support leadership assigned to the task

ALTER TABLE "issues" 
ADD COLUMN IF NOT EXISTS "issuer" TEXT,
ADD COLUMN IF NOT EXISTS "verifier" TEXT;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_issues_issuer" ON "issues"("issuer");
CREATE INDEX IF NOT EXISTS "idx_issues_verifier" ON "issues"("verifier");
CREATE INDEX IF NOT EXISTS "idx_issues_assignee" ON "issues"("assignee");

-- Add comments for documentation
COMMENT ON COLUMN "issues"."issuer" IS 'User ID of the person who created the issue (Top or Operational leadership)';
COMMENT ON COLUMN "issues"."verifier" IS 'User ID of the person who verifies the task (typically the issuer)';
COMMENT ON COLUMN "issues"."assignee" IS 'User ID of the person assigned to the task (Support leadership)';
