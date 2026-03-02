-- AlterTable
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "permissions" JSONB;
