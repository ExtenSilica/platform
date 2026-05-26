import { afterEach, describe, expect, it } from 'vitest';
import {
  XsilTreasuryAllowanceError,
  assertTreasuryAllowanceSufficient,
  distributeXsilFromTreasury,
  isOnChainClaimConfigured,
} from '../src/lib/blockchain';
import { xsilAmountToWei } from '../src/lib/xsilAbi';

const ENV_KEYS = [
  'XSIL_CLAIM_STUB',
  'XSIL_CONTRACT_ADDRESS',
  'XSIL_BACKEND_PRIVATE_KEY',
  'XSIL_BACKEND_ADDRESS',
  'XSIL_TREASURY_ADDRESS',
] as const;

function clearXsilEnv(): void {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

describe('isOnChainClaimConfigured', () => {
  afterEach(() => {
    clearXsilEnv();
  });

  it('is true when stub mode is enabled', () => {
    process.env.XSIL_CLAIM_STUB = 'true';
    expect(isOnChainClaimConfigured()).toBe(true);
  });

  it('is true when contract, backend key, and treasury are set', () => {
    process.env.XSIL_CONTRACT_ADDRESS = '0xCD64A7A8AB098Cd16E9b31E1139d8dD83530c0D8';
    process.env.XSIL_BACKEND_PRIVATE_KEY = '0x' + '11'.repeat(32);
    process.env.XSIL_TREASURY_ADDRESS = '0x1FcE7Ae8B7c2fB4bf756801A270c1de237BF7c33';
    expect(isOnChainClaimConfigured()).toBe(true);
  });

  it('is false when backend key is missing', () => {
    process.env.XSIL_CONTRACT_ADDRESS = '0xCD64A7A8AB098Cd16E9b31E1139d8dD83530c0D8';
    expect(isOnChainClaimConfigured()).toBe(false);
  });
});

describe('assertTreasuryAllowanceSufficient', () => {
  it('passes when allowance covers the transfer', () => {
    expect(() =>
      assertTreasuryAllowanceSufficient(xsilAmountToWei(500), xsilAmountToWei(100)),
    ).not.toThrow();
  });

  it('throws when allowance is below the transfer amount', () => {
    expect(() =>
      assertTreasuryAllowanceSufficient(xsilAmountToWei(50), xsilAmountToWei(100)),
    ).toThrow(XsilTreasuryAllowanceError);
    try {
      assertTreasuryAllowanceSufficient(xsilAmountToWei(50), xsilAmountToWei(100));
    } catch (err) {
      expect(err).toBeInstanceOf(XsilTreasuryAllowanceError);
      expect((err as XsilTreasuryAllowanceError).message).toBe(
        'Allowance insuficiente — criar proposta na DAO',
      );
    }
  });
});

describe('distributeXsilFromTreasury', () => {
  afterEach(() => {
    clearXsilEnv();
  });

  it('returns a stub tx hash in stub mode', async () => {
    process.env.XSIL_CLAIM_STUB = 'true';
    const txHash = await distributeXsilFromTreasury(
      '0x0000000000000000000000000000000000000001',
      100,
      ['grant-1'],
    );
    expect(txHash).toMatch(/^stub:\d+$/);
  });
});
