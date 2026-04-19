import { OAuthProvider } from "@prisma/client";
import { prisma } from "../db";

/** Booleans for known IdPs; extend when new `OAuthProvider` values are added. */
export type OAuthProviderSummary = {
  hasGithub: boolean;
  hasGoogle: boolean;
};

export async function getOAuthProviderSummaryForUser(userId: number): Promise<OAuthProviderSummary> {
  const rows = await prisma.oAuthAccount.findMany({
    where: { userId },
    distinct: ["provider"],
    select: { provider: true },
  });
  const connected = new Set(rows.map((r) => r.provider));
  return {
    hasGithub: connected.has(OAuthProvider.github),
    hasGoogle: connected.has(OAuthProvider.google),
  };
}
