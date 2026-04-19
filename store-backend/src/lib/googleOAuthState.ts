import crypto from "crypto";

const COOKIE_NAME = "xsil_oauth_google_state";
const COOKIE_MAX_AGE_SEC = 600;

function getSecret(): string | undefined {
  const s = process.env.OAUTH_STATE_SECRET?.trim();
  return s && s.length >= 16 ? s : undefined;
}

/** Same env as GitHub (`OAUTH_STATE_SECRET`); separate cookie name for Google `state`. */
export function isGoogleOAuthStateConfigured(): boolean {
  return Boolean(getSecret());
}

export function setGoogleOAuthStateCookie(res: { setHeader: (n: string, v: string | string[]) => void }, stateNonce: string): void {
  const secret = getSecret();
  if (!secret) throw new Error("OAUTH_STATE_SECRET is not set");
  const exp = Date.now() + COOKIE_MAX_AGE_SEC * 1000;
  const payload = Buffer.from(JSON.stringify({ n: stateNonce, exp }), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  const cookie = `${COOKIE_NAME}=${encodeURIComponent(`${sig}.${payload}`)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE_SEC}`;
  res.setHeader("Set-Cookie", cookie);
}

export function clearGoogleOAuthStateCookie(res: { setHeader: (n: string, v: string | string[]) => void }): void {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
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

export function verifyGoogleOAuthState(req: { headers: { cookie?: string }; query: Record<string, unknown> }): boolean {
  const secret = getSecret();
  if (!secret) return false;
  const stateQ = typeof req.query.state === "string" ? req.query.state.trim() : "";
  if (!stateQ || stateQ.length > 200) return false;

  const raw = parseCookies(req.headers.cookie)[COOKIE_NAME];
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

export { COOKIE_NAME as GOOGLE_OAUTH_STATE_COOKIE_NAME };
