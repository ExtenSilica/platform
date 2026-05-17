import { describe, it, expect } from 'vitest';
import {
  DEFAULT_STALE_OPEN_DAYS,
  openReferenceDate,
  isStaleOpenRequest,
  filterStaleOpenRequests,
} from '../src/lib/staleOpenImplementationRequests';

describe('openReferenceDate', () => {
  it('prefers openedAt when set', () => {
    const opened = new Date('2026-01-15T00:00:00Z');
    const created = new Date('2026-01-01T00:00:00Z');
    expect(
      openReferenceDate({ openedAt: opened, createdAt: created }).toISOString(),
    ).toBe(opened.toISOString());
  });

  it('falls back to createdAt when openedAt is null', () => {
    const created = new Date('2026-01-01T00:00:00Z');
    expect(
      openReferenceDate({ openedAt: null, createdAt: created }).toISOString(),
    ).toBe(created.toISOString());
  });
});

describe('isStaleOpenRequest', () => {
  const now = new Date('2026-02-20T00:00:00Z');

  it('is stale when open longer than threshold', () => {
    const openedAt = new Date('2026-01-01T00:00:00Z');
    expect(
      isStaleOpenRequest(
        { id: 1, title: 't', openedAt, createdAt: openedAt },
        now,
        DEFAULT_STALE_OPEN_DAYS,
      ),
    ).toBe(true);
  });

  it('is not stale when recently opened', () => {
    const openedAt = new Date('2026-02-10T00:00:00Z');
    expect(
      isStaleOpenRequest(
        { id: 1, title: 't', openedAt, createdAt: openedAt },
        now,
        DEFAULT_STALE_OPEN_DAYS,
      ),
    ).toBe(false);
  });
});

describe('filterStaleOpenRequests', () => {
  it('returns only stale rows', () => {
    const now = new Date('2026-03-01T00:00:00Z');
    const rows = [
      {
        id: 1,
        title: 'old',
        openedAt: new Date('2026-01-01T00:00:00Z'),
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
      {
        id: 2,
        title: 'fresh',
        openedAt: new Date('2026-02-20T00:00:00Z'),
        createdAt: new Date('2026-02-20T00:00:00Z'),
      },
    ];
    const stale = filterStaleOpenRequests(rows, now, 30);
    expect(stale.map((r) => r.id)).toEqual([1]);
  });
});
