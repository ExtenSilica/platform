-- Provenance of a package on ExtenSilica — orthogonal to StandardStatus.
-- Always SERVER-SET; the platform refuses to read this from the manifest.
-- See docs/catalog-seed/agent-prompt.md for the seeding workflow.

-- CreateEnum
CREATE TYPE "PortStatus" AS ENUM ('seeded', 'community_port', 'claimed', 'official', 'archived');

-- AlterTable
ALTER TABLE "Extension"
  ADD COLUMN "portStatus" "PortStatus";

-- CreateIndex
CREATE INDEX "Extension_portStatus_idx" ON "Extension"("portStatus");
