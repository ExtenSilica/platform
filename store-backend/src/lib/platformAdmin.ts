/**
 * Platform operators (site owner / staff). Configured only via environment —
 * never stored in the database.
 *
 * Set one or both of:
 *   PLATFORM_ADMIN_USER_IDS="1,2"        — numeric User.id values
 *   PLATFORM_ADMIN_EMAILS="a@b.com"   — comma-separated; matched case-insensitively
 */

function parseIdList(raw: string | undefined): Set<number> {
  const out = new Set<number>();
  if (!raw?.trim()) return out;
  for (const part of raw.split(',')) {
    const n = parseInt(part.trim(), 10);
    if (!Number.isNaN(n) && n > 0) out.add(n);
  }
  return out;
}

function parseEmailList(raw: string | undefined): Set<string> {
  const out = new Set<string>();
  if (!raw?.trim()) return out;
  for (const part of raw.split(',')) {
    const e = part.trim().toLowerCase();
    if (e.includes('@')) out.add(e);
  }
  return out;
}

let cachedIds: Set<number> | null = null;
let cachedEmails: Set<string> | null = null;

function adminIds(): Set<number> {
  if (!cachedIds) cachedIds = parseIdList(process.env.PLATFORM_ADMIN_USER_IDS);
  return cachedIds;
}

function adminEmails(): Set<string> {
  if (!cachedEmails) cachedEmails = parseEmailList(process.env.PLATFORM_ADMIN_EMAILS);
  return cachedEmails;
}

/** True when any platform admin is configured (otherwise no one is elevated). */
export function isPlatformAdminConfigured(): boolean {
  return adminIds().size > 0 || adminEmails().size > 0;
}

export function isPlatformAdminUser(user: { id: number; email: string }): boolean {
  if (!isPlatformAdminConfigured()) return false;
  if (adminIds().has(user.id)) return true;
  return adminEmails().has(user.email.toLowerCase());
}
