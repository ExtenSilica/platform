import { describe, it, expect } from 'vitest';
import {
  ADOPTION_DAYS_DEFAULT,
  ADOPTION_DAYS_MAX,
  buildFilledDailySeries,
  parseAdoptionDaysQuery,
} from '../src/lib/adoptionStats';

describe('parseAdoptionDaysQuery', () => {
  it('defaults to 30 days', () => {
    expect(parseAdoptionDaysQuery(undefined)).toBe(ADOPTION_DAYS_DEFAULT);
    expect(parseAdoptionDaysQuery('')).toBe(ADOPTION_DAYS_DEFAULT);
    expect(parseAdoptionDaysQuery('nope')).toBe(ADOPTION_DAYS_DEFAULT);
  });

  it('clamps to max', () => {
    expect(parseAdoptionDaysQuery('120')).toBe(ADOPTION_DAYS_MAX);
  });

  it('accepts valid integers', () => {
    expect(parseAdoptionDaysQuery('7')).toBe(7);
  });
});

describe('buildFilledDailySeries', () => {
  it('fills gaps with zero', () => {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 2);
    const sinceDay = since.toISOString().slice(0, 10);

    const series = buildFilledDailySeries(
      [{ day: sinceDay, count: 5 }],
      sinceDay,
    );

    expect(series.length).toBeGreaterThanOrEqual(3);
    expect(series[0].count).toBe(5);
    const zeros = series.filter((p) => p.count === 0);
    expect(zeros.length).toBeGreaterThanOrEqual(1);
  });
});
