-- Honest classification of a package's relationship to the RISC-V standard.
-- See docs/catalog-seed/catalog.md and the Prisma schema for the full rubric.

-- CreateEnum
CREATE TYPE "StandardStatus" AS ENUM ('ratified', 'draft', 'vendor', 'research', 'custom');

-- AlterTable
ALTER TABLE "Extension"
  ADD COLUMN "standardStatus" "StandardStatus",
  ADD COLUMN "authority" TEXT;

-- CreateIndex
CREATE INDEX "Extension_standardStatus_idx" ON "Extension"("standardStatus");
