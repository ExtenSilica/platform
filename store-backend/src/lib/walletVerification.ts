import { randomBytes } from 'crypto';
import { verifyMessage } from 'viem';
import { normalizeEvmAddress } from './governancePoints';

export function newWalletLinkNonce(): string {
  return randomBytes(16).toString('hex');
}

export function buildWalletLinkMessage(
  address: string,
  userId: number,
  nonce: string,
): string {
  const normalized = normalizeEvmAddress(address) ?? address.trim().toLowerCase();
  return [
    'Sign this message to verify wallet ownership for ExtenSilica.',
    `Address: ${normalized}`,
    `User: ${userId}`,
    `Nonce: ${nonce}`,
  ].join('\n');
}

export function parseWalletLinkMessage(message: string): {
  address: string;
  userId: number;
  nonce: string;
} | null {
  const lines = message.split('\n');
  if (lines[0]?.trim() !== 'Sign this message to verify wallet ownership for ExtenSilica.') {
    return null;
  }
  const addressLine = lines.find((l) => l.startsWith('Address: '));
  const userLine = lines.find((l) => l.startsWith('User: '));
  const nonceLine = lines.find((l) => l.startsWith('Nonce: '));
  if (!addressLine || !userLine || !nonceLine) return null;

  const address = addressLine.slice('Address: '.length).trim();
  const userId = Number.parseInt(userLine.slice('User: '.length).trim(), 10);
  const nonce = nonceLine.slice('Nonce: '.length).trim();
  if (!address || !Number.isInteger(userId) || userId <= 0 || !nonce) return null;
  return { address, userId, nonce };
}

export async function verifyWalletOwnershipSignature(
  address: string,
  message: string,
  signature: string,
): Promise<boolean> {
  const normalized = normalizeEvmAddress(address);
  if (!normalized) return false;
  const sig = signature.trim();
  if (!sig.startsWith('0x')) return false;

  try {
    return await verifyMessage({
      address: normalized as `0x${string}`,
      message,
      signature: sig as `0x${string}`,
    });
  } catch {
    return false;
  }
}
