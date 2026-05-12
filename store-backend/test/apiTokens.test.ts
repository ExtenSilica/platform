import { describe, it, expect } from 'vitest';
import type { ApiToken } from '@prisma/client';
import {
  generateRawToken,
  normalizeTokenName,
  publicApiToken,
  webSessionNameFromUserAgent,
  MAX_TOKEN_NAME_LEN,
} from '../src/lib/apiTokens';

describe('generateRawToken', () => {
  it('returns a 64-character lowercase hex string', () => {
    const t = generateRawToken();
    expect(t).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns distinct values across calls (cryptographic randomness)', () => {
    const a = generateRawToken();
    const b = generateRawToken();
    expect(a).not.toBe(b);
  });
});

describe('webSessionNameFromUserAgent', () => {
  it('falls back to "Web session" when UA is missing', () => {
    expect(webSessionNameFromUserAgent(undefined)).toBe('Web session');
    expect(webSessionNameFromUserAgent('')).toBe('Web session');
  });

  it('detects Firefox on Linux', () => {
    const ua = 'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0';
    expect(webSessionNameFromUserAgent(ua)).toBe('Web session — Firefox on Linux');
  });

  it('detects Chrome on Windows', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36';
    expect(webSessionNameFromUserAgent(ua)).toBe('Web session — Chrome on Windows');
  });

  it('detects Safari on macOS', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
    expect(webSessionNameFromUserAgent(ua)).toBe('Web session — Safari on macOS');
  });

  it('prefers Edge over Chrome when both tokens are present (Edge UA includes "Chrome/")', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/119.0.0.0 Safari/537.36 Edg/119.0';
    expect(webSessionNameFromUserAgent(ua)).toBe('Web session — Edge on Windows');
  });

  it('omits the OS when the UA does not match a known one', () => {
    const ua = 'Mozilla/5.0 (X11) Firefox/120.0';
    expect(webSessionNameFromUserAgent(ua)).toBe('Web session — Firefox');
  });
});

describe('normalizeTokenName', () => {
  it('accepts a normal name and trims surrounding whitespace', () => {
    expect(normalizeTokenName('  xsil-cli  ')).toEqual({ ok: true, name: 'xsil-cli' });
  });

  it('rejects non-string input', () => {
    expect(normalizeTokenName(123)).toEqual({ ok: false, error: expect.any(String) });
    expect(normalizeTokenName(null)).toEqual({ ok: false, error: expect.any(String) });
    expect(normalizeTokenName(undefined)).toEqual({ ok: false, error: expect.any(String) });
  });

  it('rejects empty / whitespace-only names', () => {
    expect(normalizeTokenName('')).toMatchObject({ ok: false });
    expect(normalizeTokenName('   ')).toMatchObject({ ok: false });
  });

  it(`rejects names longer than ${MAX_TOKEN_NAME_LEN} characters`, () => {
    const tooLong = 'x'.repeat(MAX_TOKEN_NAME_LEN + 1);
    expect(normalizeTokenName(tooLong)).toMatchObject({ ok: false });
  });

  it(`accepts names exactly ${MAX_TOKEN_NAME_LEN} characters long`, () => {
    const justRight = 'x'.repeat(MAX_TOKEN_NAME_LEN);
    expect(normalizeTokenName(justRight)).toEqual({ ok: true, name: justRight });
  });
});

describe('publicApiToken', () => {
  it('never leaks the tokenHash and serialises dates as ISO strings', () => {
    const row: ApiToken = {
      id: 7,
      userId: 1,
      name: 'xsil-cli',
      tokenHash: 'SECRET_HASH_DO_NOT_LEAK',
      lastUsedAt: new Date('2026-05-11T10:20:30Z'),
      createdAt: new Date('2026-05-01T00:00:00Z'),
      revokedAt: null,
    };
    const pub = publicApiToken(row);

    expect(pub).toEqual({
      id: 7,
      name: 'xsil-cli',
      createdAt: '2026-05-01T00:00:00.000Z',
      lastUsedAt: '2026-05-11T10:20:30.000Z',
      revokedAt: null,
    });
    expect(JSON.stringify(pub)).not.toContain('SECRET_HASH');
    expect(JSON.stringify(pub)).not.toContain('tokenHash');
  });

  it('preserves null lastUsedAt and revokedAt', () => {
    const row: ApiToken = {
      id: 1,
      userId: 1,
      name: 'never-used',
      tokenHash: 'h',
      lastUsedAt: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      revokedAt: null,
    };
    expect(publicApiToken(row).lastUsedAt).toBeNull();
    expect(publicApiToken(row).revokedAt).toBeNull();
  });
});
