import { describe, expect, it } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import {
  buildWalletLinkMessage,
  parseWalletLinkMessage,
  verifyWalletOwnershipSignature,
} from '../src/lib/walletVerification';

describe('walletVerification', () => {
  const account = privateKeyToAccount(
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  );

  it('builds and parses wallet link message', () => {
    const message = buildWalletLinkMessage(account.address, 42, 'abc123');
    expect(parseWalletLinkMessage(message)).toEqual({
      address: account.address.toLowerCase(),
      userId: 42,
      nonce: 'abc123',
    });
  });

  it('verifies a valid EIP-191 signature', async () => {
    const message = buildWalletLinkMessage(account.address, 1, 'nonce1');
    const signature = await account.signMessage({ message });
    const ok = await verifyWalletOwnershipSignature(account.address, message, signature);
    expect(ok).toBe(true);
  });

  it('rejects invalid signature', async () => {
    const message = buildWalletLinkMessage(account.address, 1, 'nonce1');
    const ok = await verifyWalletOwnershipSignature(
      account.address,
      message,
      '0x' + '11'.repeat(65),
    );
    expect(ok).toBe(false);
  });
});
