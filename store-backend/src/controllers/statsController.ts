import { Request, Response } from 'express';
import { prisma } from '../db';
import { refreshWeeklyDownloads } from '../analytics';
import {
  buildFilledDailySeries,
  dayOffsetUtc,
  parseAdoptionDaysQuery,
} from '../lib/adoptionStats';
import { STANDARD_STATUS_VALUES, type StandardStatus } from '../lib/standardStatus';

function dayOffset(days: number): string {
  return dayOffsetUtc(days);
}

// GET /stats/packages/:name
export const getPackageStats = async (req: Request, res: Response) => {
  const { name } = req.params;

  const pkg = await prisma.extension.findUnique({
    where: { slug: name },
    include: { versions: { select: { id: true, version: true } } },
  });
  if (!pkg) {
    res.status(404).json({ error: 'Package not found.' });
    return;
  }

  const since7  = dayOffset(7);
  const since30 = dayOffset(30);
  const since90 = dayOffset(90); // used for per-version breakdown

  // ── Aggregate totals ───────────────────────────────────────────────────────

  const [agg7, agg30] = await Promise.all([
    prisma.downloadEvent.aggregate({
      where: { packageId: pkg.id, day: { gte: since7 } },
      _sum: { count: true },
    }),
    prisma.downloadEvent.aggregate({
      where: { packageId: pkg.id, day: { gte: since30 } },
      _sum: { count: true },
    }),
  ]);

  // ── Daily history (last 30 days) ────────────────────────────────────────────

  const rawDaily = await prisma.downloadEvent.groupBy({
    by: ['day'],
    where: { packageId: pkg.id, day: { gte: since30 } },
    _sum: { count: true },
    orderBy: { day: 'asc' },
  });

  // Fill in zeros for days with no downloads so the chart is a continuous series.
  const dailyHistory = buildDailyHistory(rawDaily, since30);

  // ── Per-version breakdown (last 90 days for context) ───────────────────────

  const rawByVersion = await prisma.downloadEvent.groupBy({
    by: ['versionId'],
    where: { packageId: pkg.id, day: { gte: since90 } },
    _sum: { count: true },
    orderBy: { _sum: { count: 'desc' } },
  });

  const versionMap = new Map(pkg.versions.map((v) => [v.id, v.version]));

  const byVersion = rawByVersion
    .filter((row) => versionMap.has(row.versionId))
    .map((row) => ({
      version: versionMap.get(row.versionId)!,
      count90Days: row._sum.count ?? 0,
    }));

  res.json({
    slug: pkg.slug,
    allTime:   pkg.totalDownloads,
    last7Days:  agg7._sum.count  ?? 0,
    last30Days: agg30._sum.count ?? 0,
    dailyHistory,
    byVersion,
  });
};

// GET /stats/catalog
//
// Aggregated counts of published packages, grouped by their honest
// `standardStatus` classification. Powers the homepage hero ("X ratified RISC-V
// extensions, Y vendor / draft / research"). Public, cache-friendly.
export const getCatalogStats = async (_req: Request, res: Response) => {
  const [grouped, verifiedPorts, targets] = await Promise.all([
    prisma.extension.groupBy({
      by: ['standardStatus'],
      where: { recordKind: 'extension' },
      _count: { _all: true },
    }),
    prisma.port.count({
      where: {
        verificationStatus: 'verified',
        extension: { recordKind: 'extension' },
      },
    }),
    prisma.target.count(),
  ]);

  const byStatus: Record<StandardStatus, number> = {
    ratified: 0,
    draft: 0,
    vendor: 0,
    research: 0,
    custom: 0,
  };
  let unclassified = 0;
  let total = 0;
  for (const row of grouped) {
    const n = row._count._all;
    total += n;
    if (row.standardStatus === null || row.standardStatus === undefined) {
      unclassified += n;
    } else {
      byStatus[row.standardStatus as StandardStatus] += n;
    }
  }

  res.json({
    extensions: total,
    verifiedPorts,
    targets,
    // Legacy alias retained for clients deployed before the Extension/Port split.
    total,
    byStatus,
    unclassified,
    statusOrder: STANDARD_STATUS_VALUES,
  });
};

// GET /stats/adoption — registry-wide page views + download adoption (PR-G1)
export const getAdoptionStats = async (req: Request, res: Response) => {
  const days = parseAdoptionDaysQuery(req.query.days);
  const since = dayOffsetUtc(days - 1);
  const since7 = dayOffsetUtc(7);
  const since30 = dayOffsetUtc(30);

  const [
    totalPackages,
    viewsAggWindow,
    viewsAgg7,
    viewsAgg30,
    downloadsAggWindow,
    downloadsAgg7,
    downloadsAgg30,
    rawViewsDaily,
    rawDownloadsDaily,
    topByViews,
  ] = await Promise.all([
    prisma.extension.count({ where: { recordKind: 'extension' } }),
    prisma.packageViewEvent.aggregate({
      where: { day: { gte: since }, package: { recordKind: 'extension' } },
      _sum: { count: true },
    }),
    prisma.packageViewEvent.aggregate({
      where: { day: { gte: since7 }, package: { recordKind: 'extension' } },
      _sum: { count: true },
    }),
    prisma.packageViewEvent.aggregate({
      where: { day: { gte: since30 }, package: { recordKind: 'extension' } },
      _sum: { count: true },
    }),
    prisma.downloadEvent.aggregate({
      where: { day: { gte: since }, package: { recordKind: 'extension' } },
      _sum: { count: true },
    }),
    prisma.downloadEvent.aggregate({
      where: { day: { gte: since7 }, package: { recordKind: 'extension' } },
      _sum: { count: true },
    }),
    prisma.downloadEvent.aggregate({
      where: { day: { gte: since30 }, package: { recordKind: 'extension' } },
      _sum: { count: true },
    }),
    prisma.packageViewEvent.groupBy({
      by: ['day'],
      where: { day: { gte: since }, package: { recordKind: 'extension' } },
      _sum: { count: true },
      orderBy: { day: 'asc' },
    }),
    prisma.downloadEvent.groupBy({
      by: ['day'],
      where: { day: { gte: since }, package: { recordKind: 'extension' } },
      _sum: { count: true },
      orderBy: { day: 'asc' },
    }),
    prisma.packageViewEvent.groupBy({
      by: ['packageId'],
      where: { day: { gte: since }, package: { recordKind: 'extension' } },
      _sum: { count: true },
      orderBy: { _sum: { count: 'desc' } },
      take: 10,
    }),
  ]);

  const packageIds = topByViews.map((r) => r.packageId);
  const packages =
    packageIds.length > 0
      ? await prisma.extension.findMany({
          where: { id: { in: packageIds }, recordKind: 'extension' },
          select: { id: true, slug: true, name: true },
        })
      : [];
  const pkgMap = new Map(packages.map((p) => [p.id, p]));

  const viewsDaily = buildFilledDailySeries(
    rawViewsDaily.map((r) => ({ day: r.day, count: r._sum.count ?? 0 })),
    since,
  );
  const downloadsDaily = buildFilledDailySeries(
    rawDownloadsDaily.map((r) => ({ day: r.day, count: r._sum.count ?? 0 })),
    since,
  );

  res.json({
    days,
    totalPackages,
    views: {
      windowTotal: viewsAggWindow._sum.count ?? 0,
      last7Days: viewsAgg7._sum.count ?? 0,
      last30Days: viewsAgg30._sum.count ?? 0,
      daily: viewsDaily,
    },
    downloads: {
      windowTotal: downloadsAggWindow._sum.count ?? 0,
      last7Days: downloadsAgg7._sum.count ?? 0,
      last30Days: downloadsAgg30._sum.count ?? 0,
      daily: downloadsDaily,
    },
    topPackagesByViews: topByViews
      .map((row) => {
        const pkg = pkgMap.get(row.packageId);
        if (!pkg) return null;
        return {
          slug: pkg.slug,
          name: pkg.name,
          viewsInWindow: row._sum.count ?? 0,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null),
  });
};

// POST /stats/refresh
// Manually trigger a weeklyDownloads recomputation.
// Any authenticated user may call this; the operation is idempotent and cheap.
export const triggerWeeklyRefresh = async (req: Request, res: Response) => {
  if (!(req as any).user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const count = await refreshWeeklyDownloads();
  res.json({ ok: true, packagesWithDownloads: count });
};

/* ─── helper: fill gaps in daily history ─────────────────────────────────── */

function buildDailyHistory(
  raw: Array<{ day: string; _sum: { count: number | null } }>,
  since: string,
): Array<{ day: string; count: number }> {
  const map = new Map(raw.map((r) => [r.day, r._sum.count ?? 0]));
  const result: Array<{ day: string; count: number }> = [];

  const start = new Date(since + 'T00:00:00Z');
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (let d = new Date(start); d <= today; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    result.push({ day: key, count: map.get(key) ?? 0 });
  }
  return result;
}
