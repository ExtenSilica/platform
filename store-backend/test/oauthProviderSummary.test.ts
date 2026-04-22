import { describe, it, expect, vi, beforeEach } from "vitest";
import { OAuthProvider } from "@prisma/client";

const prismaMock = vi.hoisted(() => ({
  oAuthAccount: {
    findMany: vi.fn(),
  },
}));

vi.mock("../src/db", () => ({
  prisma: prismaMock,
}));

import { getOAuthProviderSummaryForUser } from "../src/services/oauthProviderSummary";

describe("getOAuthProviderSummaryForUser", () => {
  beforeEach(() => {
    prismaMock.oAuthAccount.findMany.mockReset();
  });

  it("returns false for both when no OAuth rows", async () => {
    prismaMock.oAuthAccount.findMany.mockResolvedValue([]);
    await expect(getOAuthProviderSummaryForUser(42)).resolves.toEqual({
      hasGithub: false,
      hasGoogle: false,
    });
    expect(prismaMock.oAuthAccount.findMany).toHaveBeenCalledWith({
      where: { userId: 42 },
      distinct: ["provider"],
      select: { provider: true },
    });
  });

  it("sets hasGithub when a GitHub row exists", async () => {
    prismaMock.oAuthAccount.findMany.mockResolvedValue([{ provider: OAuthProvider.github }]);
    await expect(getOAuthProviderSummaryForUser(1)).resolves.toEqual({
      hasGithub: true,
      hasGoogle: false,
    });
  });

  it("sets hasGoogle when a Google row exists", async () => {
    prismaMock.oAuthAccount.findMany.mockResolvedValue([{ provider: OAuthProvider.google }]);
    await expect(getOAuthProviderSummaryForUser(1)).resolves.toEqual({
      hasGithub: false,
      hasGoogle: true,
    });
  });

  it("sets both when distinct providers are linked", async () => {
    prismaMock.oAuthAccount.findMany.mockResolvedValue([
      { provider: OAuthProvider.github },
      { provider: OAuthProvider.google },
    ]);
    await expect(getOAuthProviderSummaryForUser(7)).resolves.toEqual({
      hasGithub: true,
      hasGoogle: true,
    });
  });
});
