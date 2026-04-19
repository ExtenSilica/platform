import { describe, it, expect } from "vitest";
import { OAuthProvider } from "@prisma/client";
import { validateAndNormalizeOAuthIdentity } from "../src/services/oauthIdentityValidation";

describe("validateAndNormalizeOAuthIdentity", () => {
  const base = {
    provider: OAuthProvider.github,
    providerAccountId: "12345",
    email: "User@Example.com",
    accountLabel: "octocat",
    avatarUrl: " https://avatars.githubusercontent.com/u/1 ",
    usernameBase: "octocat",
  };

  it("normalizes email and trims fields", () => {
    const r = validateAndNormalizeOAuthIdentity(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.identity.email).toBe("user@example.com");
    expect(r.identity.providerAccountId).toBe("12345");
    expect(r.identity.avatarUrl).toBe("https://avatars.githubusercontent.com/u/1");
  });

  it("rejects empty provider account id", () => {
    const r = validateAndNormalizeOAuthIdentity({ ...base, providerAccountId: "   " });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("invalid_provider_account_id");
  });

  it("rejects newlines in provider account id", () => {
    const r = validateAndNormalizeOAuthIdentity({ ...base, providerAccountId: "12\n34" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("invalid_provider_account_id");
  });

  it("rejects malformed email (no silent linking vector via bad claims)", () => {
    const r = validateAndNormalizeOAuthIdentity({ ...base, email: "not-an-email" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("invalid_email");
  });

  it("rejects empty username base", () => {
    const r = validateAndNormalizeOAuthIdentity({ ...base, usernameBase: "  " });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("invalid_username_base");
  });

  it("allows null account label and avatar", () => {
    const r = validateAndNormalizeOAuthIdentity({
      ...base,
      accountLabel: null,
      avatarUrl: null,
    });
    expect(r.ok).toBe(true);
  });
});
