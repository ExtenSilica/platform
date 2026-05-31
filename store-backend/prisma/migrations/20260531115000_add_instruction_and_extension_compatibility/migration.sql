-- Compatibility metadata for Extension + normalized instruction encodings.

-- CreateEnum
CREATE TYPE "Coupling" AS ENUM ('TIGHTLY_COUPLED', 'LOOSELY_COUPLED', 'HYBRID', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "Dispatch" AS ENUM ('INLINE', 'ROCC', 'PREFIX', 'TRAP_EMULATE', 'UNKNOWN');

-- AlterTable
ALTER TABLE "Extension"
  ADD COLUMN "coupling" "Coupling" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "encodingSpace" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "csrRange" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "dispatch" "Dispatch" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "requiresCoreFeatures" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "Instruction" (
  "id" SERIAL NOT NULL,
  "extensionId" INTEGER NOT NULL,
  "version" TEXT NOT NULL,
  "mnemonic" TEXT NOT NULL,
  "opcode" INTEGER NOT NULL,
  "funct3" INTEGER,
  "funct7" INTEGER,
  "format" TEXT NOT NULL,
  "csrAddress" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Instruction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Instruction_extensionId_idx" ON "Instruction"("extensionId");

-- CreateIndex
CREATE INDEX "Instruction_extensionId_version_idx" ON "Instruction"("extensionId", "version");

-- CreateIndex
CREATE INDEX "Instruction_opcode_funct3_funct7_idx" ON "Instruction"("opcode", "funct3", "funct7");

-- CreateIndex
CREATE INDEX "Instruction_csrAddress_idx" ON "Instruction"("csrAddress");

-- AddForeignKey
ALTER TABLE "Instruction"
  ADD CONSTRAINT "Instruction_extensionId_fkey"
  FOREIGN KEY ("extensionId") REFERENCES "Extension"("id") ON DELETE CASCADE ON UPDATE CASCADE;
