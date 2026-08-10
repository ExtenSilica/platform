import { afterEach, describe, expect, it } from 'vitest';
import {
  ARAGON_DAO_DESCRIPTION_DEFAULT,
  XSIL_NOTICE,
  XSIL_NOTICE_LINES,
  aragonDaoDescription,
} from '../src/lib/xsilDisclaimer';

const originalAragonDescription = process.env.ARAGON_DAO_DESCRIPTION;

afterEach(() => {
  if (originalAragonDescription === undefined) {
    delete process.env.ARAGON_DAO_DESCRIPTION;
  } else {
    process.env.ARAGON_DAO_DESCRIPTION = originalAragonDescription;
  }
});

describe('XSIL notice', () => {
  it('states current conduct without declaring a legal classification', () => {
    expect(XSIL_NOTICE_LINES).toHaveLength(5);
    expect(XSIL_NOTICE).toContain('no established market price or liquidity');
    expect(XSIL_NOTICE).toContain('does not sell XSIL');
    expect(XSIL_NOTICE).toContain('may never develop a market or market value');
    expect(XSIL_NOTICE).not.toMatch(/no monetary value|not securities|not a security/i);
  });

  it('does not allow an incomplete environment override to remove the notice', () => {
    process.env.ARAGON_DAO_DESCRIPTION = 'Custom DAO description without the canonical notice.';
    expect(aragonDaoDescription()).toBe(ARAGON_DAO_DESCRIPTION_DEFAULT);
  });

  it('accepts a custom description that carries the canonical notice', () => {
    const custom = `Custom DAO description.\n\n${XSIL_NOTICE}`;
    process.env.ARAGON_DAO_DESCRIPTION = custom;
    expect(aragonDaoDescription()).toBe(custom);
  });
});
