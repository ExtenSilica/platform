import crypto from "crypto";

type PendingPayload = {
  token: string;
  user: {
    id: number;
    username: string;
    email: string;
    bio: string | null;
    avatarUrl: string | null;
    createdAt: string;
  };
  expiresAt: number;
};

const TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 2000;

const store = new Map<string, PendingPayload>();

function prune(): void {
  const now = Date.now();
  for (const [k, v] of store) {
    if (v.expiresAt <= now) store.delete(k);
  }
  if (store.size > MAX_ENTRIES) {
    const sorted = [...store.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    while (store.size > MAX_ENTRIES && sorted.length) {
      store.delete(sorted.shift()![0]);
    }
  }
}

/**
 * One-time browser handoff: callback redirects with ?oauth_code=…; frontend POSTs code here for { token, user }.
 */
export function createPendingExchange(token: string, user: PendingPayload["user"]): string {
  prune();
  const code = crypto.randomBytes(24).toString("base64url");
  store.set(code, { token, user, expiresAt: Date.now() + TTL_MS });
  return code;
}

export function consumePendingExchange(code: string): PendingPayload | null {
  prune();
  const key = String(code ?? "").trim();
  if (!key) return null;
  const row = store.get(key);
  if (!row || row.expiresAt <= Date.now()) {
    if (row) store.delete(key);
    return null;
  }
  store.delete(key);
  return row;
}
