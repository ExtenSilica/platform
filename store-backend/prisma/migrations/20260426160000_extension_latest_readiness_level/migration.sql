-- AlterTable
ALTER TABLE "Extension" ADD COLUMN "latestReadinessLevel" INTEGER;

-- CreateIndex
CREATE INDEX "Extension_latestReadinessLevel_idx" ON "Extension"("latestReadinessLevel");
