import crypto from "crypto";
import bcrypt from "bcryptjs";
import { OAuthProvider, Prisma, type User } from "@prisma/client";
import { prisma } from "../db";
import { generateToken } from "../controllers/authController";

const BCRYPT_ROUNDS = 12;

const USERNAME_RE = /^[a-z0-9_-]{2,32}$/;

/**
 * Provider-neutral identity after HTTP/profile steps.
 * `accountLabel` is stored on `OAuthAccount.username` (GitHub login, Google display name).
 * `usernameBase` seeds local `User.username` before collision suffixes.
 */
export type OAuthCanonicalIdentity = {
  provider: OAuthProvider;
  providerAccountId: string;
  email: string;
  accountLabel: string | null;
  avatarUrl: string | null;
  usernameBase: string;
};

export type OAuthSignInResult =
  | { ok: true; user: User }
  | { ok: false; error: "email_exists" | "server_error" };

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
 * Find or create `User` + `OAuthAccount`, rotate `apiToken` (same semantics as password login).
 * Does not perform HTTP or redirects.
 */
export async function signInOrRegisterOAuthUser(identity: OAuthCanonicalIdentity): Promise<OAuthSignInResult> {
  const { provider, providerAccountId, email, accountLabel, avatarUrl } = identity;

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

    let user = existingLink?.user ?? null;

    if (!user) {
      const emailOwner = await prisma.user.findUnique({ where: { email } });
      if (emailOwner) {
        return { ok: false, error: "email_exists" };
      }

      const fallbackPrefix = provider === OAuthProvider.github ? "gh" : "g";
      const username = await allocateUniqueUsername(identity.usernameBase, fallbackPrefix);
      const passwordHash = await randomOAuthOnlyPasswordHash();
      const apiToken = generateToken();

      const created = await prisma.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: {
            username,
            email,
            passwordHash,
            apiToken,
            avatarUrl,
          },
        });
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
        return u;
      });
      user = created;
    } else {
      const apiToken = generateToken();
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          apiToken,
          avatarUrl: user.avatarUrl ?? avatarUrl ?? undefined,
        },
      });
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
    }

    return { ok: true, user };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = (e.meta?.target as string[] | undefined) ?? [];
      return { ok: false, error: target.includes("email") ? "email_exists" : "server_error" };
    }
    console.error("[oauthUserService] signInOrRegisterOAuthUser", e);
    return { ok: false, error: "server_error" };
  }
}
