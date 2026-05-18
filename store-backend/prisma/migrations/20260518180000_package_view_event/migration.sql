-- PR-G1: daily package page view buckets for adoption metrics
CREATE TABLE "PackageViewEvent" (
    "id" SERIAL NOT NULL,
    "packageId" INTEGER NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "PackageViewEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PackageViewEvent_packageId_day_key" ON "PackageViewEvent"("packageId", "day");

CREATE INDEX "PackageViewEvent_day_idx" ON "PackageViewEvent"("day");

ALTER TABLE "PackageViewEvent" ADD CONSTRAINT "PackageViewEvent_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Extension"("id") ON DELETE CASCADE ON UPDATE CASCADE;
