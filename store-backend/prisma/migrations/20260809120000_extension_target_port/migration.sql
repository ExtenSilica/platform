-- Extension is the architectural catalog entry; Target is an execution or
-- integration destination; Port is the independently verifiable pairing.
CREATE TYPE "TargetKind" AS ENUM (
  'simulator',
  'emulator',
  'core',
  'board',
  'toolchain',
  'reference',
  'other'
);

CREATE TYPE "PortVerificationStatus" AS ENUM (
  'declared',
  'built',
  'tested',
  'verified',
  'failed',
  'archived'
);

CREATE TABLE "Target" (
  "id" SERIAL NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" "TargetKind" NOT NULL DEFAULT 'other',
  "description" TEXT,
  "homepageUrl" TEXT,
  "architecture" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Target_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Port" (
  "id" SERIAL NOT NULL,
  "extensionId" INTEGER NOT NULL,
  "targetId" INTEGER NOT NULL,
  "versionId" INTEGER,
  "contributorId" INTEGER,
  "implementationRequestId" INTEGER,
  "verificationStatus" "PortVerificationStatus" NOT NULL DEFAULT 'declared',
  "testSummary" TEXT,
  "toolchain" TEXT,
  "sourceUrl" TEXT,
  "evidenceUrl" TEXT,
  "evidence" TEXT,
  "rewardXsil" INTEGER,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Port_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ImplementationRequest"
  ADD COLUMN "targetId" INTEGER,
  ADD COLUMN "rewardXsil" INTEGER;

CREATE UNIQUE INDEX "Target_slug_key" ON "Target"("slug");
CREATE INDEX "Target_kind_name_idx" ON "Target"("kind", "name");
CREATE UNIQUE INDEX "Port_implementationRequestId_key" ON "Port"("implementationRequestId");
CREATE UNIQUE INDEX "Port_extensionId_targetId_key" ON "Port"("extensionId", "targetId");
CREATE INDEX "Port_targetId_verificationStatus_idx" ON "Port"("targetId", "verificationStatus");
CREATE INDEX "Port_extensionId_verificationStatus_idx" ON "Port"("extensionId", "verificationStatus");
CREATE INDEX "Port_contributorId_idx" ON "Port"("contributorId");
CREATE INDEX "ImplementationRequest_targetId_status_idx" ON "ImplementationRequest"("targetId", "status");

ALTER TABLE "Port" ADD CONSTRAINT "Port_extensionId_fkey"
  FOREIGN KEY ("extensionId") REFERENCES "Extension"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Port" ADD CONSTRAINT "Port_targetId_fkey"
  FOREIGN KEY ("targetId") REFERENCES "Target"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Port" ADD CONSTRAINT "Port_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "Version"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Port" ADD CONSTRAINT "Port_contributorId_fkey"
  FOREIGN KEY ("contributorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Port" ADD CONSTRAINT "Port_implementationRequestId_fkey"
  FOREIGN KEY ("implementationRequestId") REFERENCES "ImplementationRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ImplementationRequest" ADD CONSTRAINT "ImplementationRequest_targetId_fkey"
  FOREIGN KEY ("targetId") REFERENCES "Target"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Stable choices for the first port matrix. Additional targets are created
-- automatically from manifest.targets as extensions are published/backfilled.
INSERT INTO "Target" ("slug", "name", "kind", "description", "updatedAt") VALUES
  ('spike', 'Spike', 'simulator', 'RISC-V ISA simulator', CURRENT_TIMESTAMP),
  ('qemu', 'QEMU', 'emulator', 'RISC-V system emulator', CURRENT_TIMESTAMP),
  ('cva6', 'CVA6', 'core', 'Open-source 64-bit RISC-V application core', CURRENT_TIMESTAMP),
  ('cv32e40x', 'CV32E40X', 'core', 'OpenHW embedded RISC-V core with extension interface', CURRENT_TIMESTAMP),
  ('neorv32', 'NEORV32', 'core', 'Configurable RISC-V soft core', CURRENT_TIMESTAMP),
  ('rocket', 'Rocket', 'core', 'Rocket Chip RISC-V core', CURRENT_TIMESTAMP),
  ('milk-v-duo-c906', 'Milk-V Duo / C906', 'board', 'Milk-V Duo Linux-capable RISC-V target', CURRENT_TIMESTAMP),
  ('llvm', 'LLVM', 'toolchain', 'LLVM compiler toolchain support', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
