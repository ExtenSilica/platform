-- XSIL governance points (off-chain ledger) + optional EVM address for Aragon claim.

CREATE TYPE "GovernancePointReason" AS ENUM (
  'email_verified',
  'package_registered',
  'version_published',
  'ownership_approved',
  'implementation_verified'
);

CREATE TABLE "GovernancePointLedger" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "reason" "GovernancePointReason" NOT NULL,
  "points" INTEGER NOT NULL,
  "referenceKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GovernancePointLedger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GovernanceAddressLink" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "linkedEvmAddress" TEXT NOT NULL,
  "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimTxHash" TEXT,
  "claimedAt" TIMESTAMP(3),
  CONSTRAINT "GovernanceAddressLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GovernancePointLedger_userId_reason_referenceKey_key"
  ON "GovernancePointLedger"("userId", "reason", "referenceKey");
CREATE INDEX "GovernancePointLedger_userId_createdAt_idx"
  ON "GovernancePointLedger"("userId", "createdAt");

CREATE UNIQUE INDEX "GovernanceAddressLink_userId_key" ON "GovernanceAddressLink"("userId");

ALTER TABLE "GovernancePointLedger"
  ADD CONSTRAINT "GovernancePointLedger_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GovernanceAddressLink"
  ADD CONSTRAINT "GovernanceAddressLink_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
