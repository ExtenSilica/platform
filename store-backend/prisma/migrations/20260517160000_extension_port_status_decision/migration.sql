-- PR-C4: audit fields when platform admin sets portStatus = official
ALTER TABLE "Extension" ADD COLUMN "portStatusDecisionNote" TEXT;
ALTER TABLE "Extension" ADD COLUMN "portStatusDecidedById" INTEGER;
ALTER TABLE "Extension" ADD COLUMN "portStatusDecidedAt" TIMESTAMP(3);

ALTER TABLE "Extension" ADD CONSTRAINT "Extension_portStatusDecidedById_fkey"
  FOREIGN KEY ("portStatusDecidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
