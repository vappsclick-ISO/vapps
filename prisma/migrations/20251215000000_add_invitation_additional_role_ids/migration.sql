-- AlterTable
ALTER TABLE "invitations" ADD COLUMN IF NOT EXISTS "additionalRoleIds" JSONB;
