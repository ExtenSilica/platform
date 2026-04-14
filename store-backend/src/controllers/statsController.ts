import { Request, Response } from 'express';
import { prisma } from '../db';
import { refreshWeeklyDownloads } from '../analytics';

function dayOffset(days: number): string {
  const d = new Date(Date.now() - days * 86_400_000);
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
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
