import type { OAuthCanonicalIdentity } from "./oauthTypes";

const EMAIL_MAX = 254;
const PROVIDER_ACCOUNT_ID_MAX = 255;
/** Practical upper bound for the username seed coming from IdP normalization. */
const USERNAME_BASE_MAX = 32;

/** RFC 5322 simplified: one @, no spaces, local + domain parts. */
const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type OAuthIdentityValidationResult =
  | { ok: true; identity: OAuthCanonicalIdentity }
  | {
      ok: false;
      reason: "invalid_email" | "invalid_provider_account_id" | "invalid_username_base";
    };

/**
 * Reject malformed or oversized IdP claims before any DB access.
 * Does not decide account-linking policy (see `signInOrRegisterOAuthUser`).
 */
export function validateAndNormalizeOAuthIdentity(
  raw: OAuthCanonicalIdentity,
): OAuthIdentityValidationResult {
  const providerAccountId = raw.providerAccountId.trim();
  if (
    !providerAccountId ||
    providerAccountId.length > PROVIDER_ACCOUNT_ID_MAX ||
    /[\r\n\0]/.test(providerAccountId)
  ) {
    return { ok: false, reason: "invalid_provider_account_id" };
  }

  const email = raw.email.trim().toLowerCase();
  if (!email || email.length > EMAIL_MAX || !EMAIL_PATTERN.test(email)) {
    return { ok: false, reason: "invalid_email" };
  }

  const usernameBase = raw.usernameBase.trim().slice(0, USERNAME_BASE_MAX);
  if (!usernameBase) {
    return { ok: false, reason: "invalid_username_base" };
  }

  const accountLabel =
    raw.accountLabel === null || raw.accountLabel === undefined
      ? null
      : raw.accountLabel.trim().slice(0, 500) || null;

  const avatarUrl =
    raw.avatarUrl === null || raw.avatarUrl === undefined
      ? null
      : raw.avatarUrl.trim().slice(0, 2000) || null;

  return {
    ok: true,
    identity: {
      provider: raw.provider,
      providerAccountId,
      email,
      accountLabel,
      avatarUrl,
      usernameBase,
    },
  };
}
