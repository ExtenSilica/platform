import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import type { ApiToken } from '@prisma/client';

// ── Prisma + helper mocks ────────────────────────────────────────────────────
//
// We mock the Prisma client AND `lib/apiTokens` so we can assert exactly how
// the controller composes them. Production behaviour of the helpers is locked
// down by `test/apiTokens.test.ts`.

const prismaMock = vi.hoisted(() => ({
  apiToken: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
}));

vi.mock('../src/db', () => ({
  prisma: prismaMock,
}));

const countLiveTokensForUserMock = vi.hoisted(() => vi.fn());
const createApiTokenMock = vi.hoisted(() => vi.fn());
const revokeApiTokenByIdMock = vi.hoisted(() => vi.fn());

vi.mock('../src/lib/apiTokens', async () => {
  const actual = await vi.importActual<typeof import('../src/lib/apiTokens')>(
    '../src/lib/apiTokens',
  );
  return {
    ...actual,
    countLiveTokensForUser: countLiveTokensForUserMock,
    createApiToken: createApiTokenMock,
    revokeApiTokenById: revokeApiTokenByIdMock,
  };
});

import {
  listMyTokens,
  createMyToken,
  revokeMyToken,
} from '../src/controllers/apiTokensController';
import { MAX_LIVE_TOKENS_PER_USER } from '../src/lib/apiTokens';

// ── Test plumbing ────────────────────────────────────────────────────────────

class MockResponse {
  statusCode = 200;
  body: unknown = undefined;
  status(code: number) {
    this.statusCode = code;
    return this;
  }
  json(payload: unknown) {
    this.body = payload;
    return this;
  }
}

function asRes(r: MockResponse): Response {
  return r as unknown as Response;
}

function authedRequest(userId: number, overrides: Partial<Request> = {}): Request {
  return {
    user: { id: userId } as Express.Request['user'],
    body: {},
    params: {},
    ...overrides,
  } as unknown as Request;
}

function fakeRow(over: Partial<ApiToken> = {}): ApiToken {
  return {
    id: 1,
    userId: 1,
    name: 'test',
    tokenHash: 'h',
    lastUsedAt: null,
    createdAt: new Date('2026-05-01T00:00:00Z'),
    revokedAt: null,
    ...over,
  };
}

beforeEach(() => {
  prismaMock.apiToken.findMany.mockReset();
  prismaMock.apiToken.findUnique.mockReset();
  countLiveTokensForUserMock.mockReset();
  createApiTokenMock.mockReset();
  revokeApiTokenByIdMock.mockReset();
});

// ── listMyTokens ─────────────────────────────────────────────────────────────

describe('GET /auth/me/tokens (listMyTokens)', () => {
  it('returns all tokens for the authenticated user, newest first, without hashes', async () => {
    prismaMock.apiToken.findMany.mockResolvedValue([
      fakeRow({ id: 3, name: 'newest', tokenHash: 'SECRET_HASH_3' }),
      fakeRow({ id: 1, name: 'oldest', tokenHash: 'SECRET_HASH_1', revokedAt: new Date('2026-04-01T00:00:00Z') }),
    ]);

    const res = new MockResponse();
    await listMyTokens(authedRequest(42), asRes(res));

    expect(res.statusCode).toBe(200);
    expect(prismaMock.apiToken.findMany).toHaveBeenCalledWith({
      where: { userId: 42 },
      orderBy: { id: 'desc' },
    });

    const payload = res.body as { tokens: Array<Record<string, unknown>> };
    expect(payload.tokens).toHaveLength(2);
    expect(payload.tokens[0]).toEqual({
      id: 3,
      name: 'newest',
      createdAt: '2026-05-01T00:00:00.000Z',
      lastUsedAt: null,
      revokedAt: null,
    });
    expect(payload.tokens[1].revokedAt).toBe('2026-04-01T00:00:00.000Z');

    // Hash must never leak.
    const serialised = JSON.stringify(payload);
    expect(serialised).not.toContain('SECRET_HASH');
    expect(serialised).not.toContain('tokenHash');
  });

  it('returns 500 when Prisma errors out', async () => {
    prismaMock.apiToken.findMany.mockRejectedValue(new Error('boom'));
    const res = new MockResponse();
    await listMyTokens(authedRequest(1), asRes(res));
    expect(res.statusCode).toBe(500);
  });
});

// ── createMyToken ────────────────────────────────────────────────────────────

describe('POST /auth/me/tokens (createMyToken)', () => {
  it('mints a token and returns the raw value once', async () => {
    countLiveTokensForUserMock.mockResolvedValue(2);
    createApiTokenMock.mockResolvedValue({
      rawToken: 'fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0',
      row: fakeRow({ id: 9, userId: 7, name: 'xsil-cli' }),
    });

    const req = authedRequest(7, { body: { name: 'xsil-cli' } });
    const res = new MockResponse();
    await createMyToken(req, asRes(res));

    expect(res.statusCode).toBe(201);
    expect(createApiTokenMock).toHaveBeenCalledWith({ userId: 7, name: 'xsil-cli' });
    expect(res.body).toMatchObject({
      token: 'fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0',
      apiToken: { id: 9, name: 'xsil-cli' },
    });
  });

  it('trims whitespace in the name before persisting', async () => {
    countLiveTokensForUserMock.mockResolvedValue(0);
    createApiTokenMock.mockResolvedValue({
      rawToken: 'a'.repeat(64),
      row: fakeRow({ id: 1, name: 'trimmed' }),
    });

    const req = authedRequest(1, { body: { name: '   trimmed   ' } });
    const res = new MockResponse();
    await createMyToken(req, asRes(res));

    expect(createApiTokenMock).toHaveBeenCalledWith({ userId: 1, name: 'trimmed' });
    expect(res.statusCode).toBe(201);
  });

  it('rejects missing or empty name with 400', async () => {
    const cases = [{}, { name: '' }, { name: '   ' }, { name: 123 }];
    for (const body of cases) {
      const res = new MockResponse();
      await createMyToken(authedRequest(1, { body: body as Record<string, unknown> }), asRes(res));
      expect(res.statusCode).toBe(400);
      expect(createApiTokenMock).not.toHaveBeenCalled();
    }
  });

  it('rejects names longer than the limit with 400', async () => {
    const tooLong = 'x'.repeat(81);
    const res = new MockResponse();
    await createMyToken(authedRequest(1, { body: { name: tooLong } }), asRes(res));
    expect(res.statusCode).toBe(400);
  });

  it('rejects creation when the user is at the live-token cap with 409', async () => {
    countLiveTokensForUserMock.mockResolvedValue(MAX_LIVE_TOKENS_PER_USER);

    const res = new MockResponse();
    await createMyToken(authedRequest(1, { body: { name: 'one-more' } }), asRes(res));

    expect(res.statusCode).toBe(409);
    expect(createApiTokenMock).not.toHaveBeenCalled();
  });

  it('returns 500 when the helper throws', async () => {
    countLiveTokensForUserMock.mockResolvedValue(0);
    createApiTokenMock.mockRejectedValue(new Error('db down'));
    const res = new MockResponse();
    await createMyToken(authedRequest(1, { body: { name: 'x' } }), asRes(res));
    expect(res.statusCode).toBe(500);
  });
});

// ── revokeMyToken ────────────────────────────────────────────────────────────

describe('DELETE /auth/me/tokens/:id (revokeMyToken)', () => {
  it('revokes a live token owned by the caller', async () => {
    prismaMock.apiToken.findUnique.mockResolvedValue(
      fakeRow({ id: 5, userId: 1, revokedAt: null }),
    );

    const req = authedRequest(1, { params: { id: '5' } as Record<string, string> });
    const res = new MockResponse();
    await revokeMyToken(req, asRes(res));

    expect(res.statusCode).toBe(200);
    expect(revokeApiTokenByIdMock).toHaveBeenCalledWith(5);
    expect(res.body).toEqual({ ok: true });
  });

  it('returns `alreadyRevoked: true` for an idempotent revoke', async () => {
    prismaMock.apiToken.findUnique.mockResolvedValue(
      fakeRow({ id: 5, userId: 1, revokedAt: new Date('2026-04-01T00:00:00Z') }),
    );

    const req = authedRequest(1, { params: { id: '5' } as Record<string, string> });
    const res = new MockResponse();
    await revokeMyToken(req, asRes(res));

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, alreadyRevoked: true });
    expect(revokeApiTokenByIdMock).not.toHaveBeenCalled();
  });

  it('returns 404 if the token belongs to another user (no information leak)', async () => {
    prismaMock.apiToken.findUnique.mockResolvedValue(
      fakeRow({ id: 5, userId: 999, revokedAt: null }),
    );

    const req = authedRequest(1, { params: { id: '5' } as Record<string, string> });
    const res = new MockResponse();
    await revokeMyToken(req, asRes(res));

    expect(res.statusCode).toBe(404);
    expect(revokeApiTokenByIdMock).not.toHaveBeenCalled();
  });

  it('returns 404 if the token does not exist', async () => {
    prismaMock.apiToken.findUnique.mockResolvedValue(null);

    const req = authedRequest(1, { params: { id: '5' } as Record<string, string> });
    const res = new MockResponse();
    await revokeMyToken(req, asRes(res));

    expect(res.statusCode).toBe(404);
  });

  it('rejects non-numeric id params with 400', async () => {
    const req = authedRequest(1, { params: { id: 'not-a-number' } as Record<string, string> });
    const res = new MockResponse();
    await revokeMyToken(req, asRes(res));
    expect(res.statusCode).toBe(400);
  });

  it('rejects negative / zero ids with 400', async () => {
    for (const id of ['0', '-1']) {
      const req = authedRequest(1, { params: { id } as Record<string, string> });
      const res = new MockResponse();
      await revokeMyToken(req, asRes(res));
      expect(res.statusCode).toBe(400);
    }
  });
});
