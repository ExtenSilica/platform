import type { OAuthProvider } from "@prisma/client";
import type { User } from "@prisma/client";

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
  | { ok: true; user: User; token: string }
  | { ok: false; error: "email_exists" | "server_error" | "invalid_identity" };
