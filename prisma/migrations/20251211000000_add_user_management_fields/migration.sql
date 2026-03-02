-- AlterTable: Add lastActive to User
ALTER TABLE "User" ADD COLUMN "lastActive" TIMESTAMP(3);

-- AlterTable: Add leadershipTier to UserOrganization
ALTER TABLE "UserOrganization" ADD COLUMN "leadershipTier" TEXT;

-- CreateIndex: Add index on leadershipTier for faster queries
CREATE INDEX "UserOrganization_leadershipTier_idx" ON "UserOrganization"("leadershipTier");

-- AlterTable: Add role, siteId, processId to Invitation
ALTER TABLE "invitations" ADD COLUMN "role" TEXT;
ALTER TABLE "invitations" ADD COLUMN "siteId" TEXT;
ALTER TABLE "invitations" ADD COLUMN "processId" TEXT;

-- CreateIndex: Add index on role for faster queries
CREATE INDEX "invitations_role_idx" ON "invitations"("role");

-- Backfill leadershipTier for existing UserOrganization records
-- Admin/Owner -> Top, Manager -> Operational, Member -> Support
UPDATE "UserOrganization" 
SET "leadershipTier" = CASE 
  WHEN LOWER("role") IN ('admin', 'owner') THEN 'Top'
  WHEN LOWER("role") = 'manager' THEN 'Operational'
  WHEN LOWER("role") = 'member' THEN 'Support'
  ELSE 'Support'
END
WHERE "leadershipTier" IS NULL;
