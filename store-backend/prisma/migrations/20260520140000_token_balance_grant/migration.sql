-- Replace GovernancePointLedger / GovernanceAddressLink with TokenBalance / TokenGrant.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "TokenGrantReason" AS ENUM (
  'FIRST_PACKAGE_PUBLISH',
  'PACKAGE_PUBLISH',
  'OWNERSHIP_CLAIM_APPROVED',
  'IMPLEMENTATION_SUBMISSION_ACCEPTED',
  'VERIFICATION_RUN_COMPLETED',
  'EXTERNAL_CITATION_VERIFIED',
  'CODE_CONTRIBUTION_MERGED',
  'VENDOR_CLAIM_APPROVED',
  'SECURITY_REPORT_FIXED',
  'ADMIN_DISCRETIONARY'
);

CREATE TYPE "TokenGrantStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CLAIMED'
);

CREATE TABLE "TokenBalance" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "pendingXsil" INTEGER NOT NULL DEFAULT 0,
  "claimedXsil" INTEGER NOT NULL DEFAULT 0,
  "totalEarned" INTEGER NOT NULL DEFAULT 0,
  "linkedEvmAddress" TEXT,
  "evmLinkedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TokenBalance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TokenGrant" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "xsilAmount" INTEGER NOT NULL,
  "reason" "TokenGrantReason" NOT NULL,
  "referenceId" TEXT NOT NULL,
  "note" TEXT,
  "status" "TokenGrantStatus" NOT NULL DEFAULT 'PENDING',
  "approvedById" INTEGER,
  "approvedAt" TIMESTAMP(3),
  "claimTxHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TokenGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TokenBalance_userId_key" ON "TokenBalance"("userId");
CREATE UNIQUE INDEX "TokenGrant_userId_reason_referenceId_key"
  ON "TokenGrant"("userId", "reason", "referenceId");
CREATE INDEX "TokenGrant_userId_status_idx" ON "TokenGrant"("userId", "status");
CREATE INDEX "TokenGrant_userId_createdAt_idx" ON "TokenGrant"("userId", "createdAt");

ALTER TABLE "TokenBalance"
  ADD CONSTRAINT "TokenBalance_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TokenGrant"
  ADD CONSTRAINT "TokenGrant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TokenGrant"
  ADD CONSTRAINT "TokenGrant_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migrate ledger rows → approved grants + balances
INSERT INTO "TokenGrant" (
  "id", "userId", "xsilAmount", "reason", "referenceId", "status", "approvedAt", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  l."userId",
  l."points",
  CASE l."reason"::text
    WHEN 'first_package_published' THEN 'FIRST_PACKAGE_PUBLISH'::"TokenGrantReason"
    WHEN 'package_registered' THEN 'PACKAGE_PUBLISH'::"TokenGrantReason"
    WHEN 'ownership_approved' THEN 'OWNERSHIP_CLAIM_APPROVED'::"TokenGrantReason"
    WHEN 'implementation_verified' THEN 'IMPLEMENTATION_SUBMISSION_ACCEPTED'::"TokenGrantReason"
    WHEN 'verification_run_passed' THEN 'VERIFICATION_RUN_COMPLETED'::"TokenGrantReason"
    WHEN 'external_citation_verified' THEN 'EXTERNAL_CITATION_VERIFIED'::"TokenGrantReason"
    WHEN 'cli_contribution_merged' THEN 'CODE_CONTRIBUTION_MERGED'::"TokenGrantReason"
    WHEN 'vendor_official_claim' THEN 'VENDOR_CLAIM_APPROVED'::"TokenGrantReason"
    WHEN 'security_issue_reported' THEN 'SECURITY_REPORT_FIXED'::"TokenGrantReason"
    WHEN 'admin_grant' THEN 'ADMIN_DISCRETIONARY'::"TokenGrantReason"
    WHEN 'email_verified' THEN 'ADMIN_DISCRETIONARY'::"TokenGrantReason"
    WHEN 'version_published' THEN 'ADMIN_DISCRETIONARY'::"TokenGrantReason"
    ELSE 'ADMIN_DISCRETIONARY'::"TokenGrantReason"
  END,
  l."referenceKey",
  'APPROVED'::"TokenGrantStatus",
  l."createdAt",
  l."createdAt",
  l."createdAt"
FROM "GovernancePointLedger" l;

INSERT INTO "TokenBalance" (
  "id", "userId", "pendingXsil", "claimedXsil", "totalEarned", "linkedEvmAddress", "evmLinkedAt", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  u."userId",
  u."pending",
  0,
  u."pending",
  a."linkedEvmAddress",
  a."linkedAt",
  NOW(),
  NOW()
FROM (
  SELECT "userId", COALESCE(SUM("xsilAmount"), 0) AS pending
  FROM "TokenGrant"
  WHERE "status" = 'APPROVED'
  GROUP BY "userId"
) u
LEFT JOIN "GovernanceAddressLink" a ON a."userId" = u."userId";

INSERT INTO "TokenBalance" (
  "id", "userId", "pendingXsil", "claimedXsil", "totalEarned", "linkedEvmAddress", "evmLinkedAt", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  a."userId",
  0,
  0,
  0,
  a."linkedEvmAddress",
  a."linkedAt",
  NOW(),
  NOW()
FROM "GovernanceAddressLink" a
WHERE NOT EXISTS (SELECT 1 FROM "TokenBalance" tb WHERE tb."userId" = a."userId");

ALTER TABLE "GovernancePointLedger" DROP CONSTRAINT IF EXISTS "GovernancePointLedger_userId_fkey";
ALTER TABLE "GovernanceAddressLink" DROP CONSTRAINT IF EXISTS "GovernanceAddressLink_userId_fkey";
DROP TABLE "GovernancePointLedger";
DROP TABLE "GovernanceAddressLink";
DROP TYPE "GovernancePointReason";
