import { describe, expect, it } from 'vitest';
import { xsilAmountToWei, XSIL_DECIMALS } from '../src/lib/xsilAbi';

describe('xsilAbi', () => {
  it('converts whole XSIL to wei', () => {
    expect(xsilAmountToWei(500)).toBe(500n * 10n ** BigInt(XSIL_DECIMALS));
  });

  it('rejects non-integer amounts', () => {
    expect(() => xsilAmountToWei(1.5)).toThrow();
  });
});
