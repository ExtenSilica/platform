-- CreateEnum
CREATE TYPE "ImplementationRequestVisibility" AS ENUM ('public', 'org_only', 'unlisted');

-- CreateEnum
CREATE TYPE "ImplementationRequestStatus" AS ENUM ('draft', 'open', 'in_progress', 'submitted', 'verified', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "ImplementationSubmissionStatus" AS ENUM ('draft', 'submitted');

-- CreateEnum
CREATE TYPE "VerificationRunOutcome" AS ENUM ('pass', 'fail');

-- CreateTable
CREATE TABLE "ImplementationRequest" (
    "id" SERIAL NOT NULL,
    "packageId" INTEGER NOT NULL,
    "createdByUserId" INTEGER NOT NULL,
    "createdByOrgId" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "visibility" "ImplementationRequestVisibility" NOT NULL DEFAULT 'public',
    "status" "ImplementationRequestStatus" NOT NULL DEFAULT 'draft',
    "targetCapability" TEXT,
    "acceptanceCriteriaSummary" TEXT,
    "fundingContactEmail" TEXT,
    "fundingNote" TEXT,
    "assignedImplementerUserId" INTEGER,
    "openedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImplementationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImplementationMilestone" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImplementationMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImplementationSubmission" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "submittedById" INTEGER NOT NULL,
    "status" "ImplementationSubmissionStatus" NOT NULL DEFAULT 'draft',
    "summary" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "versionId" INTEGER,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImplementationSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationRun" (
    "id" SERIAL NOT NULL,
    "submissionId" INTEGER NOT NULL,
    "verifierId" INTEGER NOT NULL,
    "outcome" "VerificationRunOutcome" NOT NULL,
    "notes" TEXT,
    "logUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImplementationInterest" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImplementationInterest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImplementationRequest_packageId_status_idx" ON "ImplementationRequest"("packageId", "status");

-- CreateIndex
CREATE INDEX "ImplementationRequest_createdByUserId_status_idx" ON "ImplementationRequest"("createdByUserId", "status");

-- CreateIndex
CREATE INDEX "ImplementationRequest_status_createdAt_idx" ON "ImplementationRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ImplementationRequest_assignedImplementerUserId_idx" ON "ImplementationRequest"("assignedImplementerUserId");

-- CreateIndex
CREATE INDEX "ImplementationMilestone_requestId_sortOrder_idx" ON "ImplementationMilestone"("requestId", "sortOrder");

-- CreateIndex
CREATE INDEX "ImplementationSubmission_requestId_status_idx" ON "ImplementationSubmission"("requestId", "status");

-- CreateIndex
CREATE INDEX "ImplementationSubmission_submittedById_idx" ON "ImplementationSubmission"("submittedById");

-- CreateIndex
CREATE INDEX "VerificationRun_submissionId_createdAt_idx" ON "VerificationRun"("submissionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImplementationInterest_requestId_userId_key" ON "ImplementationInterest"("requestId", "userId");

-- AddForeignKey
ALTER TABLE "ImplementationRequest" ADD CONSTRAINT "ImplementationRequest_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Extension"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImplementationRequest" ADD CONSTRAINT "ImplementationRequest_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImplementationRequest" ADD CONSTRAINT "ImplementationRequest_createdByOrgId_fkey" FOREIGN KEY ("createdByOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImplementationRequest" ADD CONSTRAINT "ImplementationRequest_assignedImplementerUserId_fkey" FOREIGN KEY ("assignedImplementerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImplementationMilestone" ADD CONSTRAINT "ImplementationMilestone_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ImplementationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImplementationSubmission" ADD CONSTRAINT "ImplementationSubmission_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ImplementationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImplementationSubmission" ADD CONSTRAINT "ImplementationSubmission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImplementationSubmission" ADD CONSTRAINT "ImplementationSubmission_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "Version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationRun" ADD CONSTRAINT "VerificationRun_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ImplementationSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationRun" ADD CONSTRAINT "VerificationRun_verifierId_fkey" FOREIGN KEY ("verifierId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImplementationInterest" ADD CONSTRAINT "ImplementationInterest_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ImplementationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImplementationInterest" ADD CONSTRAINT "ImplementationInterest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
