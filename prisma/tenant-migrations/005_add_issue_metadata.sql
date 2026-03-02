-- Add metadata tables for issue titles, tags, and sources
-- These are tenant-level metadata that can be customized per organization

-- Issue Titles metadata
CREATE TABLE IF NOT EXISTS "issue_titles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "issue_titles_name_key" UNIQUE ("name")
);

-- Issue Tags metadata
CREATE TABLE IF NOT EXISTS "issue_tags" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "issue_tags_name_key" UNIQUE ("name")
);

-- Issue Sources metadata
CREATE TABLE IF NOT EXISTS "issue_sources" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "issue_sources_name_key" UNIQUE ("name")
);

-- Insert default/pre-seeded values
INSERT INTO "issue_titles" (id, name) VALUES
    (gen_random_uuid()::text, 'Bug'),
    (gen_random_uuid()::text, 'Feature'),
    (gen_random_uuid()::text, 'Task')
ON CONFLICT (name) DO NOTHING;

INSERT INTO "issue_tags" (id, name) VALUES
    (gen_random_uuid()::text, 'Quality Issues'),
    (gen_random_uuid()::text, 'Process Improvement'),
    (gen_random_uuid()::text, 'Risk Mitigation'),
    (gen_random_uuid()::text, 'Enhancement Idea'),
    (gen_random_uuid()::text, 'Compliance Gap'),
    (gen_random_uuid()::text, 'Customer Concern'),
    (gen_random_uuid()::text, 'Lean Manufacturing'),
    (gen_random_uuid()::text, 'GRC'),
    (gen_random_uuid()::text, 'Industry 4.0'),
    (gen_random_uuid()::text, 'ESG'),
    (gen_random_uuid()::text, 'GRI'),
    (gen_random_uuid()::text, 'IFRS'),
    (gen_random_uuid()::text, 'SDGs')
ON CONFLICT (name) DO NOTHING;

INSERT INTO "issue_sources" (id, name) VALUES
    (gen_random_uuid()::text, 'Employee Feedback'),
    (gen_random_uuid()::text, 'Outsourced Process Feedback'),
    (gen_random_uuid()::text, 'Customer Feedback'),
    (gen_random_uuid()::text, 'External Audit Findings'),
    (gen_random_uuid()::text, 'Internal Audit Findings'),
    (gen_random_uuid()::text, 'Management Review Action Item')
ON CONFLICT (name) DO NOTHING;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_issue_titles_name" ON "issue_titles"("name");
CREATE INDEX IF NOT EXISTS "idx_issue_tags_name" ON "issue_tags"("name");
CREATE INDEX IF NOT EXISTS "idx_issue_sources_name" ON "issue_sources"("name");

-- Add source column to issues table if it doesn't exist (for existing databases)
ALTER TABLE "issues" ADD COLUMN IF NOT EXISTS "source" TEXT;

-- Update default status for existing issues if needed
-- This is handled in application logic, but we ensure the column exists
