/**
 * Stale-open detection for implementation requests (PR-C11).
 * A request in `open` status with no progress for STALE_OPEN_DAYS triggers email once.
 */

export const DEFAULT_STALE_OPEN_DAYS = 30;

export type StaleOpenCandidate = {
  id: number;
  title: string;
  openedAt: Date | null;
  createdAt: Date;
};

/** Reference instant when the request became (or should be treated as) open. */
export function openReferenceDate(row: {
  openedAt: Date | null;
  createdAt: Date;
}): Date {
  return row.openedAt ?? row.createdAt;
}

export function isStaleOpenRequest(
  row: StaleOpenCandidate,
  now: Date,
  staleDays: number = DEFAULT_STALE_OPEN_DAYS,
): boolean {
  if (staleDays <= 0) return false;
  const ref = openReferenceDate(row);
  const ageMs = now.getTime() - ref.getTime();
  return ageMs >= staleDays * 24 * 60 * 60 * 1000;
}

export function filterStaleOpenRequests(
  rows: StaleOpenCandidate[],
  now: Date,
  staleDays: number = DEFAULT_STALE_OPEN_DAYS,
): StaleOpenCandidate[] {
  return rows.filter((r) => isStaleOpenRequest(r, now, staleDays));
}
