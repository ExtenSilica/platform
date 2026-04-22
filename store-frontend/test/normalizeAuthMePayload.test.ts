import { describe, it, expect } from "vitest";
import { normalizeAuthMePayload } from "@/lib/api";

describe("normalizeAuthMePayload", () => {
  it("returns null for non-objects", () => {
    expect(normalizeAuthMePayload(null)).toBeNull();
    expect(normalizeAuthMePayload(undefined)).toBeNull();
    expect(normalizeAuthMePayload("string")).toBeNull();
    expect(normalizeAuthMePayload(42)).toBeNull();
  });

  it("unwraps GET /auth/me response with nested user and oauthProviders", () => {
    const body = {
      user: {
        id: 1,
        username: "alice",
        email: "alice@example.com",
        bio: null,
        avatarUrl: null,
        createdAt: "2020-01-01T00:00:00.000Z",
      },
      oauthProviders: { hasGithub: true, hasGoogle: false },
    };
    expect(normalizeAuthMePayload(body)).toEqual({
      id: 1,
      username: "alice",
      email: "alice@example.com",
      bio: null,
      avatarUrl: null,
      createdAt: "2020-01-01T00:00:00.000Z",
    });
  });

  it("accepts legacy flat user object", () => {
    const flat = {
      id: 2,
      username: "bob",
      email: "bob@example.com",
      bio: "Builder",
      avatarUrl: null,
      createdAt: "2021-05-05T12:00:00.000Z",
    };
    expect(normalizeAuthMePayload(flat)).toEqual(flat);
  });

  it("returns null when nested user is missing required fields", () => {
    expect(normalizeAuthMePayload({ user: { id: 1, username: "x" } })).toBeNull();
    expect(normalizeAuthMePayload({ user: {} })).toBeNull();
  });

  it("serializes createdAt from Date when present", () => {
    const d = new Date("2022-06-15T08:00:00.000Z");
    const body = {
      user: {
        id: 3,
        username: "carol",
        email: "carol@example.com",
        bio: null,
        avatarUrl: null,
        createdAt: d,
      },
    };
    expect(normalizeAuthMePayload(body)?.createdAt).toBe(d.toISOString());
  });
});
