-- AlterTable: Add jobTitle to UserOrganization
ALTER TABLE "UserOrganization" ADD COLUMN "jobTitle" TEXT;

-- CreateIndex: Add index on jobTitle for faster queries
CREATE INDEX "UserOrganization_jobTitle_idx" ON "UserOrganization"("jobTitle");

-- AlterTable: Add jobTitle to Invitation
ALTER TABLE "invitations" ADD COLUMN "jobTitle" TEXT;
