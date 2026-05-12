import crypto from "crypto";
import bcrypt from "bcryptjs";
import { OAuthProvider, Prisma, type User } from "@prisma/client";
import { prisma } from "../db";
import { createApiToken } from "../lib/apiTokens";
import { validateAndNormalizeOAuthIdentity } from "./oauthIdentityValidation";
import type { OAuthCanonicalIdentity, OAuthSignInResult } from "./oauthTypes";

export type { OAuthCanonicalIdentity, OAuthSignInResult } from "./oauthTypes";

const BCRYPT_ROUNDS = 12;

const USERNAME_RE = /^[a-z0-9_-]{2,32}$/;

/**
 * Allocate a unique `User.username` from a normalized base; `fallbackPrefix` seeds random names (e.g. `gh`, `g`).
 */
export async function allocateUniqueUsername(base: string, fallbackPrefix: string): Promise<string> {
  const prefix = fallbackPrefix.replace(/[^a-z0-9]/g, "").slice(0, 4) || "u";
  let candidate = base;
  if (!USERNAME_RE.test(candidate)) {
    candidate = `${prefix}${crypto.randomBytes(4).toString("hex")}`.slice(0, 32);
  }
  for (let i = 0; i < 64; i++) {
    const tryName =
      i === 0
        ? candidate
        : `${candidate.replace(/-+$/, "").slice(0, 24)}-${i.toString(36)}`.slice(0, 32);
    const exists = await prisma.user.findUnique({ where: { username: tryName } });
    if (!exists) return tryName;
  }
  return `${prefix}${crypto.randomBytes(8).toString("hex")}`.slice(0, 32);
}

export async function randomOAuthOnlyPasswordHash(): Promise<string> {
  const raw = crypto.randomBytes(32).toString("hex");
  return bcrypt.hash(raw, BCRYPT_ROUNDS);
}

/**
 * Default token name used for OAuth-originated sessions. Distinct from the
 * password-login path's User-Agent–derived name so the dashboard can show the
 * user *how* a session was created.
 */
function oauthSessionName(provider: OAuthProvider): string {
  return provider === OAuthProvider.github ? "GitHub sign-in" : "Google sign-in";
}

/**
 * Refresh the `OAuthAccount` row with the freshest profile fields from the
 * provider so the dashboard never drifts. Optionally bumps `User.avatarUrl`
 * the first time the user has no avatar of their own.
 */
async function syncOAuthProfile(params: {
  user: User;
  provider: OAuthProvider;
  providerAccountId: string;
  email: string;
  accountLabel: string | null;
  avatarUrl: string | null;
}): Promise<User> {
  const { user, provider, providerAccountId, email, accountLabel, avatarUrl } = params;
  const needsAvatar = !user.avatarUrl && avatarUrl;
  const updatedUser = needsAvatar
    ? await prisma.user.update({
        where: { id: user.id },
        data: { avatarUrl },
      })
    : user;
  await prisma.oAuthAccount.update({
    where: {
      provider_providerAccountId: {
        provider,
        providerAccountId,
      },
    },
    data: {
      email,
      username: accountLabel ?? undefined,
      avatarUrl: avatarUrl ?? undefined,
    },
  });
  return updatedUser;
}

/**
 * Find or create `User` + `OAuthAccount` and mint a fresh `ApiToken` for the
 * resulting session (the OAuth flow is the moral equivalent of a password
 * login, but other tokens for this user are NOT touched). Does not perform
 * HTTP or redirects.
 */
export async function signInOrRegisterOAuthUser(identity: OAuthCanonicalIdentity): Promise<OAuthSignInResult> {
  const validated = validateAndNormalizeOAuthIdentity(identity);
  if (!validated.ok) {
    return { ok: false, error: "invalid_identity" };
  }

  const { provider, providerAccountId, email, accountLabel, avatarUrl } = validated.identity;

  try {
    const existingLink = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId,
        },
      },
      include: { user: true },
    });

    if (existingLink?.user) {
      const user = await syncOAuthProfile({
        user: existingLink.user,
        provider,
        providerAccountId,
        email,
        accountLabel,
        avatarUrl,
      });
      const { rawToken } = await createApiToken({ userId: user.id, name: oauthSessionName(provider) });
      return { ok: true, user, token: rawToken };
    }

    const emailOwner = await prisma.user.findUnique({ where: { email } });
    if (emailOwner) {
      return { ok: false, error: "email_exists" };
    }

    const fallbackPrefix = provider === OAuthProvider.github ? "gh" : "g";
    const username = await allocateUniqueUsername(validated.identity.usernameBase, fallbackPrefix);
    const passwordHash = await randomOAuthOnlyPasswordHash();

    const txnResult = await prisma.$transaction(async (tx) => {
      const raced = await tx.oAuthAccount.findUnique({
        where: {
          provider_providerAccountId: {
            provider,
            providerAccountId,
          },
        },
        include: { user: true },
      });
      if (raced?.user) {
        return { kind: "raced_existing" as const, user: raced.user };
      }

      const emailAgain = await tx.user.findUnique({ where: { email } });
      if (emailAgain) {
        return { kind: "email_exists" as const };
      }

      const u = await tx.user.create({
        data: {
          username,
          email,
          passwordHash,
          avatarUrl,
          emailVerifiedAt: new Date(),
        },
      });
      try {
        await tx.oAuthAccount.create({
          data: {
            userId: u.id,
            provider,
            providerAccountId,
            email,
            username: accountLabel,
            avatarUrl,
          },
        });
      } catch (inner) {
        if (inner instanceof Prisma.PrismaClientKnownRequestError && inner.code === "P2002") {
          const again = await tx.oAuthAccount.findUnique({
            where: {
              provider_providerAccountId: { provider, providerAccountId },
            },
            include: { user: true },
          });
          if (again?.user) {
            return { kind: "raced_existing" as const, user: again.user };
          }
          return { kind: "email_exists" as const };
        }
        throw inner;
      }
      return { kind: "new" as const, user: u };
    });

    if (txnResult.kind === "email_exists") {
      return { ok: false, error: "email_exists" };
    }

    if (txnResult.kind === "raced_existing") {
      const user = await syncOAuthProfile({
        user: txnResult.user,
        provider,
        providerAccountId,
        email,
        accountLabel,
        avatarUrl,
      });
      const { rawToken } = await createApiToken({ userId: user.id, name: oauthSessionName(provider) });
      return { ok: true, user, token: rawToken };
    }

    const { rawToken } = await createApiToken({
      userId: txnResult.user.id,
      name: oauthSessionName(provider),
    });
    return { ok: true, user: txnResult.user, token: rawToken };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = (e.meta?.target as string[] | undefined) ?? [];
      return { ok: false, error: target.includes("email") ? "email_exists" : "server_error" };
    }
    console.error("[oauthUserService] signInOrRegisterOAuthUser", e);
    return { ok: false, error: "server_error" };
  }
}
