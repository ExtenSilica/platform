-- CreateTable
CREATE TABLE "OwnershipRequest" (
    "id" SERIAL NOT NULL,
    "packageId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decisionNote" TEXT,
    "decidedById" INTEGER,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnershipRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OwnershipRequest_packageId_status_idx" ON "OwnershipRequest"("packageId", "status");

-- CreateIndex
CREATE INDEX "OwnershipRequest_userId_status_idx" ON "OwnershipRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "OwnershipRequest_status_createdAt_idx" ON "OwnershipRequest"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "OwnershipRequest" ADD CONSTRAINT "OwnershipRequest_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Extension"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipRequest" ADD CONSTRAINT "OwnershipRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipRequest" ADD CONSTRAINT "OwnershipRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
