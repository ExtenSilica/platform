-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "emailVerificationTokenHash" TEXT,
ADD COLUMN     "emailVerificationExpires" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_emailVerificationTokenHash_key" ON "User"("emailVerificationTokenHash");

-- Existing accounts: treat as already verified (avoid lockout).
UPDATE "User" SET "emailVerifiedAt" = COALESCE("emailVerifiedAt", "createdAt")
WHERE "emailVerifiedAt" IS NULL;

ALTER TABLE "Organization" ADD COLUMN "linkedinUrl" TEXT;
