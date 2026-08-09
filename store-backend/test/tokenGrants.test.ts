import { describe, expect, it } from 'vitest';
import { TOKEN_AMOUNTS } from '../src/lib/tokenGrants';
import { buildWalletLinkMessage, parseWalletLinkMessage } from '../src/lib/walletVerification';

describe('tokenGrants', () => {
  it('defines amounts for all grant reasons', () => {
    expect(TOKEN_AMOUNTS.FIRST_PACKAGE_PUBLISH).toBe(0);
    expect(TOKEN_AMOUNTS.PACKAGE_PUBLISH).toBe(0);
    expect(TOKEN_AMOUNTS.OWNERSHIP_CLAIM_APPROVED).toBe(0);
    expect(TOKEN_AMOUNTS.IMPLEMENTATION_SUBMISSION_ACCEPTED).toBe(0);
    expect(TOKEN_AMOUNTS.VERIFICATION_RUN_COMPLETED).toBe(0);
    expect(TOKEN_AMOUNTS.ADMIN_DISCRETIONARY).toBe(0);
  });
});

describe('wallet link message (grant flow prerequisite)', () => {
  it('round-trips parse', () => {
    const msg = buildWalletLinkMessage('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 7, 'n1');
    expect(parseWalletLinkMessage(msg)?.userId).toBe(7);
  });
});
