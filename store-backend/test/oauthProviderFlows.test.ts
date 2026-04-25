import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response } from "express";
import type { User } from "@prisma/client";
import { OAuthProvider, Prisma } from "@prisma/client";
import * as oauthPending from "../src/lib/oauthPendingExchange";

const prismaMock = vi.hoisted(() => ({
  oAuthAccount: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("../src/db", () => ({
  prisma: prismaMock,
}));

vi.mock("../src/controllers/authController", () => ({
  generateToken: () =>
    "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  sanitizeUser: (user: {
    id: number;
    username: string;
    email: string;
    bio: string | null;
    avatarUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) => ({
    id: user.id,
    username: user.username,
    email: user.email,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
  }),
}));

import { githubOAuthStart, githubOAuthCallback } from "../src/controllers/oauthGithubController";
import { googleOAuthStart, googleOAuthCallback } from "../src/controllers/oauthGoogleController";

class MockResponse {
  statusCode = 200;
  headers: Record<string, string | string[]> = {};
  redirectUrl = "";
  setHeader(name: string, value: string | string[]) {
    this.headers[name] = value;
  }
  redirect(status: number, url: string) {
    this.statusCode = status;
    this.redirectUrl = url;
  }
}

function asRes(r: MockResponse): Response {
  return r as unknown as Response;
}

function firstSetCookieHeader(res: MockResponse): string {
  const v = res.headers["Set-Cookie"];
  if (typeof v !== "string") throw new Error("expected Set-Cookie string");
  return v.split(";")[0] ?? "";
}

function githubProfile(email: string) {
  return {
    id: 999001,
    login: "octocat",
    email,
    avatar_url: null as string | null,
  };
}

function googleProfile(email: string, sub = "google-sub-1") {
  return {
    sub,
    email,
    email_verified: true,
    name: "Test User",
    picture: null as string | null,
  };
}

function mockGithubFetch(profile: ReturnType<typeof githubProfile>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("github.com/login/oauth/access_token")) {
        return new Response(JSON.stringify({ access_token: "mock_gh_at" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("api.github.com/user") && !url.includes("/emails")) {
        return new Response(JSON.stringify(profile), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("not found", { status: 404 });
    }),
  );
}

function mockGoogleFetch(profile: ReturnType<typeof googleProfile>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "mock_g_at" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("openidconnect.googleapis.com/v1/userinfo")) {
        return new Response(JSON.stringify(profile), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("not found", { status: 404 });
    }),
  );
}

function baseUser(over: Partial<User> = {}): User {
  return {
    id: 1,
    username: "legacyuser",
    email: "oauthuser@example.com",
    passwordHash: "hashed",
    apiToken: "previous_api_token_hex_64_chars________________________________",
    bio: null,
    avatarUrl: null,
    createdAt: new Date("2020-01-01"),
    updatedAt: new Date("2020-01-01"),
    ...over,
  } as User;
}

describe("GitHub OAuth flow (mocked HTTP + DB)", () => {
  let handoffSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.unstubAllGlobals();
    prismaMock.oAuthAccount.findUnique.mockReset();
    prismaMock.oAuthAccount.create.mockReset();
    prismaMock.oAuthAccount.update.mockReset();
    prismaMock.user.findUnique.mockReset();
    prismaMock.user.create.mockReset();
    prismaMock.user.update.mockReset();
    prismaMock.$transaction.mockReset();
    prismaMock.$transaction.mockImplementation(async (fn: (t: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock),
    );
    handoffSpy = vi.spyOn(oauthPending, "createPendingExchange").mockReturnValue("test_handoff_code");
  });

  afterEach(() => {
    handoffSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("start returns 302 redirect to GitHub authorize URL", async () => {
    const res = new MockResponse();
    await githubOAuthStart({} as Request, asRes(res));
    expect(res.statusCode).toBe(302);
    expect(res.redirectUrl).toContain("https://github.com/login/oauth/authorize");
    expect(res.redirectUrl).toContain("client_id=vitest_github_client");
    expect(res.redirectUrl).toContain("state=");
    expect(firstSetCookieHeader(res)).toContain("xsil_oauth_github_state=");
  });

  it("callback with invalid state redirects to auth error", async () => {
    mockGithubFetch(githubProfile("x@y.com"));
    const res = new MockResponse();
    const req = {
      query: { code: "abc", state: "wrong" },
      headers: { cookie: "" },
    } as unknown as Request;
    await githubOAuthCallback(req, asRes(res));
    expect(res.statusCode).toBe(302);
    expect(res.redirectUrl).toContain("/auth/error");
    expect(res.redirectUrl).toContain("oauth_error=invalid_state");
  });

  it("callback with valid mocked provider creates user and issues handoff (api token)", async () => {
    mockGithubFetch(githubProfile("newgithub@example.com"));
    const startRes = new MockResponse();
    await githubOAuthStart({} as Request, asRes(startRes));
    const cookiePair = firstSetCookieHeader(startRes);
    const state = new URL(startRes.redirectUrl).searchParams.get("state");
    expect(state).toBeTruthy();

    prismaMock.oAuthAccount.findUnique.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue(
      baseUser({
        id: 42,
        username: "octocat",
        email: "newgithub@example.com",
        apiToken:
          "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      }),
    );
    prismaMock.oAuthAccount.create.mockResolvedValue({});

    const cbRes = new MockResponse();
    const req = {
      query: { code: "gh_auth_code", state },
      headers: { cookie: cookiePair },
    } as unknown as Request;
    await githubOAuthCallback(req, asRes(cbRes));

    expect(cbRes.redirectUrl).toContain("/auth/callback");
    expect(cbRes.redirectUrl).toContain("oauth_code=test_handoff_code");
    expect(handoffSpy).toHaveBeenCalledWith(
      "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      expect.objectContaining({
        email: "newgithub@example.com",
        username: "octocat",
      }),
      false,
    );
  });

  it("callback signs in existing OAuth account and rotates token", async () => {
    mockGithubFetch(githubProfile("oauthuser@example.com"));
    const startRes = new MockResponse();
    await githubOAuthStart({} as Request, asRes(startRes));
    const cookiePair = firstSetCookieHeader(startRes);
    const state = new URL(startRes.redirectUrl).searchParams.get("state")!;

    const linked = baseUser({
      apiToken: "old_token____________________________________________________",
    });
    prismaMock.oAuthAccount.findUnique.mockResolvedValue({
      id: 7,
      userId: linked.id,
      provider: OAuthProvider.github,
      providerAccountId: "999001",
      email: "oauthuser@example.com",
      username: "octocat",
      avatarUrl: null,
      user: linked,
    });
    prismaMock.user.update.mockResolvedValue({
      ...linked,
      apiToken: "rotated_token_______________________________________________",
    });
    prismaMock.oAuthAccount.update.mockResolvedValue({});

    const cbRes = new MockResponse();
    await githubOAuthCallback(
      {
        query: { code: "code2", state },
        headers: { cookie: cookiePair },
      } as unknown as Request,
      asRes(cbRes),
    );

    expect(cbRes.redirectUrl).toContain("oauth_code=test_handoff_code");
    expect(handoffSpy).toHaveBeenCalledWith(
      "rotated_token_______________________________________________",
      expect.any(Object),
      false,
    );
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("callback rejects email already used by local account", async () => {
    mockGithubFetch(githubProfile("taken@example.com"));
    const startRes = new MockResponse();
    await githubOAuthStart({} as Request, asRes(startRes));
    const state = new URL(startRes.redirectUrl).searchParams.get("state")!;

    prismaMock.oAuthAccount.findUnique.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue({ id: 99 } as User);

    const cbRes = new MockResponse();
    await githubOAuthCallback(
      {
        query: { code: "c3", state },
        headers: { cookie: firstSetCookieHeader(startRes) },
      } as unknown as Request,
      asRes(cbRes),
    );
    expect(cbRes.redirectUrl).toContain("oauth_error=email_exists");
  });

  it("providerAccountId race: P2002 on OAuthAccount create resolves as existing sign-in", async () => {
    mockGithubFetch(githubProfile("race@example.com"));
    const startRes = new MockResponse();
    await githubOAuthStart({} as Request, asRes(startRes));
    const state = new URL(startRes.redirectUrl).searchParams.get("state")!;

    prismaMock.oAuthAccount.findUnique.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue(null);

    const winner = baseUser({
      id: 50,
      email: "race@example.com",
      username: "octocat",
      apiToken: "winner_tok____________________________________________________",
    });

    const p2002 = new Prisma.PrismaClientKnownRequestError("dup", {
      code: "P2002",
      clientVersion: "test",
      meta: { target: ["provider", "providerAccountId"] },
    });

    prismaMock.user.create.mockResolvedValue(winner);
    prismaMock.oAuthAccount.create.mockRejectedValueOnce(p2002);
    prismaMock.oAuthAccount.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 1,
      userId: winner.id,
      provider: OAuthProvider.github,
      providerAccountId: "999001",
      email: "race@example.com",
      username: "octocat",
      avatarUrl: null,
      user: winner,
    });

    prismaMock.user.update.mockResolvedValue({
      ...winner,
      apiToken: "after_race_tok______________________________________________",
    });
    prismaMock.oAuthAccount.update.mockResolvedValue({});

    const cbRes = new MockResponse();
    await githubOAuthCallback(
      {
        query: { code: "c4", state },
        headers: { cookie: firstSetCookieHeader(startRes) },
      } as unknown as Request,
      asRes(cbRes),
    );

    expect(cbRes.redirectUrl).toContain("/auth/callback");
    expect(handoffSpy).toHaveBeenCalledWith(
      "after_race_tok______________________________________________",
      expect.any(Object),
      false,
    );
  });

  it("username collision: allocateUniqueUsername suffix before create", async () => {
    mockGithubFetch(githubProfile("collide@example.com"));
    const startRes = new MockResponse();
    await githubOAuthStart({} as Request, asRes(startRes));
    const state = new URL(startRes.redirectUrl).searchParams.get("state")!;

    prismaMock.oAuthAccount.findUnique.mockResolvedValue(null);
    prismaMock.user.findUnique.mockImplementation(async (args: { where: { username?: string; email?: string } }) => {
      const w = args.where;
      if (w.email) return null;
      if (w.username === "octocat") return { id: 1 } as User;
      return null;
    });

    prismaMock.user.create.mockImplementation(async (args: { data: { username: string } }) =>
      baseUser({
        id: 60,
        username: args.data.username,
        email: "collide@example.com",
        apiToken: "suffix_user_token___________________________________________",
      }),
    );
    prismaMock.oAuthAccount.create.mockResolvedValue({});

    const cbRes = new MockResponse();
    await githubOAuthCallback(
      {
        query: { code: "c5", state },
        headers: { cookie: firstSetCookieHeader(startRes) },
      } as unknown as Request,
      asRes(cbRes),
    );

    expect(prismaMock.user.create).toHaveBeenCalled();
    const createdUsername = vi.mocked(prismaMock.user.create).mock.calls[0][0].data.username;
    expect(createdUsername).not.toBe("octocat");
    expect(createdUsername.startsWith("octocat")).toBe(true);
    expect(cbRes.redirectUrl).toContain("oauth_code=test_handoff_code");
  });
});

describe("Google OAuth flow (mocked HTTP + DB)", () => {
  let handoffSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.unstubAllGlobals();
    prismaMock.oAuthAccount.findUnique.mockReset();
    prismaMock.oAuthAccount.create.mockReset();
    prismaMock.oAuthAccount.update.mockReset();
    prismaMock.user.findUnique.mockReset();
    prismaMock.user.create.mockReset();
    prismaMock.user.update.mockReset();
    prismaMock.$transaction.mockReset();
    prismaMock.$transaction.mockImplementation(async (fn: (t: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock),
    );
    handoffSpy = vi.spyOn(oauthPending, "createPendingExchange").mockReturnValue("google_handoff");
  });

  afterEach(() => {
    handoffSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("start returns 302 to Google authorization URL", async () => {
    const res = new MockResponse();
    await googleOAuthStart({} as Request, asRes(res));
    expect(res.statusCode).toBe(302);
    expect(res.redirectUrl).toContain("accounts.google.com/o/oauth2/v2/auth");
    expect(res.redirectUrl).toContain("client_id=vitest_google_client");
    expect(firstSetCookieHeader(res)).toContain("xsil_oauth_google_state=");
  });

  it("callback invalid state fails", async () => {
    mockGoogleFetch(googleProfile("g@example.com"));
    const res = new MockResponse();
    await googleOAuthCallback(
      { query: { code: "x", state: "bad" }, headers: { cookie: "" } } as unknown as Request,
      asRes(res),
    );
    expect(res.redirectUrl).toContain("oauth_error=invalid_state");
  });

  it("callback creates user and passes api token to handoff", async () => {
    mockGoogleFetch(googleProfile("goognew@example.com", "sub-abc"));
    const startRes = new MockResponse();
    await googleOAuthStart({} as Request, asRes(startRes));
    const state = new URL(startRes.redirectUrl).searchParams.get("state")!;

    prismaMock.oAuthAccount.findUnique.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue(
      baseUser({
        id: 77,
        username: "goognew",
        email: "goognew@example.com",
        apiToken:
          "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      }),
    );
    prismaMock.oAuthAccount.create.mockResolvedValue({});

    const cbRes = new MockResponse();
    await googleOAuthCallback(
      {
        query: { code: "gcode", state },
        headers: { cookie: firstSetCookieHeader(startRes) },
      } as unknown as Request,
      asRes(cbRes),
    );

    expect(handoffSpy).toHaveBeenCalledWith(
      "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      expect.objectContaining({ email: "goognew@example.com" }),
      false,
    );
  });

  it("callback signs in existing Google OAuth user", async () => {
    mockGoogleFetch(googleProfile("goognew@example.com", "sub-abc"));
    const startRes = new MockResponse();
    await googleOAuthStart({} as Request, asRes(startRes));
    const state = new URL(startRes.redirectUrl).searchParams.get("state")!;

    const u = baseUser({
      id: 77,
      email: "goognew@example.com",
      apiToken: "before______________________________________________________",
    });
    prismaMock.oAuthAccount.findUnique.mockResolvedValue({
      id: 2,
      userId: u.id,
      provider: OAuthProvider.google,
      providerAccountId: "sub-abc",
      email: "goognew@example.com",
      username: "Test User",
      avatarUrl: null,
      user: u,
    });
    prismaMock.user.update.mockResolvedValue({
      ...u,
      apiToken: "after_google________________________________________________",
    });
    prismaMock.oAuthAccount.update.mockResolvedValue({});

    const cbRes = new MockResponse();
    await googleOAuthCallback(
      {
        query: { code: "g2", state },
        headers: { cookie: firstSetCookieHeader(startRes) },
      } as unknown as Request,
      asRes(cbRes),
    );

    expect(handoffSpy).toHaveBeenCalledWith(
      "after_google________________________________________________",
      expect.any(Object),
      false,
    );
  });
});
