/**
 * Platform operators (site owner / staff). Configured only via environment —
 * never stored in the database.
 *
 * Set one or both of:
 *   PLATFORM_ADMIN_USER_IDS="1,2"        — numeric User.id values
 *   PLATFORM_ADMIN_EMAILS="a@b.com"   — comma-separated; matched case-insensitively
 *
 * Separately, the catalog-seed bot accounts are identified by:
 *   PLATFORM_CATALOG_BOT_USER_IDS="3,4"
 *   PLATFORM_CATALOG_BOT_EMAILS="bot@extensilica.com"
 *
 * Packages published by a catalog bot default to `portStatus = "seeded"`
 * so visitors can see at a glance that the upstream maintainer has not
 * (yet) claimed authorship.
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
let cachedBotIds: Set<number> | null = null;
let cachedBotEmails: Set<string> | null = null;

function adminIds(): Set<number> {
  if (!cachedIds) cachedIds = parseIdList(process.env.PLATFORM_ADMIN_USER_IDS);
  return cachedIds;
}

function adminEmails(): Set<string> {
  if (!cachedEmails) cachedEmails = parseEmailList(process.env.PLATFORM_ADMIN_EMAILS);
  return cachedEmails;
}

function catalogBotIds(): Set<number> {
  if (!cachedBotIds) cachedBotIds = parseIdList(process.env.PLATFORM_CATALOG_BOT_USER_IDS);
  return cachedBotIds;
}

function catalogBotEmails(): Set<string> {
  if (!cachedBotEmails) cachedBotEmails = parseEmailList(process.env.PLATFORM_CATALOG_BOT_EMAILS);
  return cachedBotEmails;
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

/**
 * True when the given user account is one of the configured catalog-seed bots.
 * Packages they publish get `portStatus = "seeded"` so the UI shows the
 * "unverified port" badge until an upstream maintainer claims it.
 */
export function isCatalogBotUser(user: { id: number; email: string }): boolean {
  if (catalogBotIds().has(user.id)) return true;
  return catalogBotEmails().has(user.email.toLowerCase());
}
