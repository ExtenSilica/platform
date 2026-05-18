import { prisma } from './db';

/** Returns a YYYY-MM-DD string for `days` ago (UTC). */
function dayOffset(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Record one download of a specific package version.
 *
 * Uses daily bucketing: at most one DownloadEvent row per (package, version, day).
 * The `count` column is incremented atomically via Prisma upsert so concurrent
 * requests merge into the same bucket rather than creating duplicate rows.
 *
 * Also increments the cached `downloadCount` on the Version row and
 * `totalDownloads` on the Extension row so list-view stats remain fast without
 * requiring aggregate queries.
 *
 * Note: `weeklyDownloads` is NOT incremented here — it is maintained by the
 * periodic `refreshWeeklyDownloads` job so the value always reflects a true
 * rolling 7-day window (old days naturally fall off).
 */
export async function recordDownload(packageId: number, versionId: number): Promise<void> {
  const day = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

  await Promise.all([
    // daily bucket — upsert so concurrent downloads merge
    prisma.downloadEvent.upsert({
      where: { packageId_versionId_day: { packageId, versionId, day } },
      update: { count: { increment: 1 } },
      create: { packageId, versionId, day, count: 1 },
    }),
    // fast-access counters
    prisma.version.update({
      where: { id: versionId },
      data: { downloadCount: { increment: 1 } },
    }),
    prisma.extension.update({
      where: { id: packageId },
      data: { totalDownloads: { increment: 1 } },
    }),
  ]);
}

/**
 * Recompute `weeklyDownloads` for every package from the `DownloadEvent` table
 * (rolling 7-day window ending now, UTC).
 *
 * This is intentionally a full-table recomputation rather than an incremental
 * approach so that packages with zero downloads this week are correctly zeroed
 * out as old events age off.
 *
 * Returns the number of packages that had at least one download in the window.
 */
/**
 * Record one package detail page view (GET /packages/:slug).
 * Daily bucket per package — same upsert pattern as DownloadEvent.
 */
export async function recordPackageView(packageId: number): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);

  await prisma.packageViewEvent.upsert({
    where: { packageId_day: { packageId, day } },
    update: { count: { increment: 1 } },
    create: { packageId, day, count: 1 },
  });
}

export async function refreshWeeklyDownloads(): Promise<number> {
  const since7 = dayOffset(7);

  // Sum downloads per package for the last 7 days.
  const results = await prisma.downloadEvent.groupBy({
    by: ['packageId'],
    where: { day: { gte: since7 } },
    _sum: { count: true },
  });

  // Write the new counts for active packages.
  await Promise.all(
    results.map((r) =>
      prisma.extension.update({
        where: { id: r.packageId },
        data: { weeklyDownloads: r._sum.count ?? 0 },
      }),
    ),
  );

  // Zero out packages that had no downloads this week.
  const activeIds = results.map((r) => r.packageId);
  await prisma.extension.updateMany({
    where: activeIds.length > 0 ? { id: { notIn: activeIds } } : {},
    data: { weeklyDownloads: 0 },
  });

  return results.length;
}
