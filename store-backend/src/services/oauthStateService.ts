import crypto from "crypto";

/** Which OAuth IdP this `state` cookie belongs to (separate cookie names, same signing secret). */
export type OAuthStateCookieProvider = "github" | "google";

const COOKIE_NAMES: Record<OAuthStateCookieProvider, string> = {
  github: "xsil_oauth_github_state",
  google: "xsil_oauth_google_state",
};

const COOKIE_MAX_AGE_SEC = 600;

function getSecret(): string | undefined {
  const s = process.env.OAUTH_STATE_SECRET?.trim();
  return s && s.length >= 16 ? s : undefined;
}

/** `OAUTH_STATE_SECRET` present and long enough for HMAC signing. */
export function isOAuthStateSecretConfigured(): boolean {
  return Boolean(getSecret());
}

export function createOAuthStateNonce(): string {
  return crypto.randomBytes(24).toString("hex");
}

export function setOAuthStateCookie(
  res: { setHeader: (n: string, v: string | string[]) => void },
  provider: OAuthStateCookieProvider,
  stateNonce: string,
): void {
  const secret = getSecret();
  if (!secret) throw new Error("OAUTH_STATE_SECRET is not set");
  const name = COOKIE_NAMES[provider];
  const exp = Date.now() + COOKIE_MAX_AGE_SEC * 1000;
  const payload = Buffer.from(JSON.stringify({ n: stateNonce, exp }), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  const cookie = `${name}=${encodeURIComponent(`${sig}.${payload}`)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE_SEC}`;
  res.setHeader("Set-Cookie", cookie);
}

export function clearOAuthStateCookie(
  res: { setHeader: (n: string, v: string | string[]) => void },
  provider: OAuthStateCookieProvider,
): void {
  const name = COOKIE_NAMES[provider];
  res.setHeader("Set-Cookie", `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  }
  return out;
}

/**
 * Verifies signed cookie for `provider` matches `state` query param (timing-safe on inner nonce).
 */
export function verifyOAuthStateCookie(
  req: { headers: { cookie?: string }; query: Record<string, unknown> },
  provider: OAuthStateCookieProvider,
): boolean {
  const secret = getSecret();
  if (!secret) return false;
  const stateQ = typeof req.query.state === "string" ? req.query.state.trim() : "";
  if (!stateQ || stateQ.length > 200) return false;

  const raw = parseCookies(req.headers.cookie)[COOKIE_NAMES[provider]];
  if (!raw) return false;
  const dot = raw.indexOf(".");
  if (dot < 1) return false;
  const sig = raw.slice(0, dot);
  const payload = raw.slice(dot + 1);
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return false;

  let parsed: { n?: string; exp?: number };
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { n?: string; exp?: number };
  } catch {
    return false;
  }
  if (!parsed.n || typeof parsed.exp !== "number") return false;
  if (Date.now() > parsed.exp) return false;
  const nonceBuf = Buffer.from(parsed.n);
  const stateBuf = Buffer.from(stateQ);
  if (nonceBuf.length !== stateBuf.length || !crypto.timingSafeEqual(nonceBuf, stateBuf)) return false;
  return true;
}

export function oauthStateCookieName(provider: OAuthStateCookieProvider): string {
  return COOKIE_NAMES[provider];
}
