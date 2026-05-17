-- AlterTable
ALTER TABLE "OwnershipRequest" ADD COLUMN "claimantOrgId" INTEGER;

-- AddForeignKey
ALTER TABLE "OwnershipRequest" ADD CONSTRAINT "OwnershipRequest_claimantOrgId_fkey" FOREIGN KEY ("claimantOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "OwnershipRequest_claimantOrgId_idx" ON "OwnershipRequest"("claimantOrgId");
