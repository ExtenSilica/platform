-- PR-G2: external citations (papers, DOIs, blog posts) linked to packages or registry-wide
CREATE TABLE "ExternalCitation" (
    "id" SERIAL NOT NULL,
    "packageId" INTEGER,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalCitation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExternalCitation_packageId_idx" ON "ExternalCitation"("packageId");

CREATE INDEX "ExternalCitation_kind_idx" ON "ExternalCitation"("kind");

ALTER TABLE "ExternalCitation" ADD CONSTRAINT "ExternalCitation_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Extension"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExternalCitation" ADD CONSTRAINT "ExternalCitation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
