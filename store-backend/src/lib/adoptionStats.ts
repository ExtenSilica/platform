/**
 * Helpers for GET /stats/adoption (PR-G1).
 */

export const ADOPTION_DAYS_DEFAULT = 30;
export const ADOPTION_DAYS_MAX = 90;

export function parseAdoptionDaysQuery(raw: unknown): number {
  if (raw === undefined || raw === null || raw === '') {
    return ADOPTION_DAYS_DEFAULT;
  }
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    return ADOPTION_DAYS_DEFAULT;
  }
  return Math.min(n, ADOPTION_DAYS_MAX);
}

export function dayOffsetUtc(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

/** Fill missing UTC days with zero counts for continuous charts. */
export function buildFilledDailySeries(
  raw: Array<{ day: string; count: number }>,
  sinceDay: string,
): Array<{ day: string; count: number }> {
  const map = new Map(raw.map((r) => [r.day, r.count]));
  const result: Array<{ day: string; count: number }> = [];

  const start = new Date(sinceDay + 'T00:00:00Z');
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (let d = new Date(start); d <= today; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    result.push({ day: key, count: map.get(key) ?? 0 });
  }
  return result;
}
