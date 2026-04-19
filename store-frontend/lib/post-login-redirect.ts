const STORAGE_KEY = "xsil_post_login_redirect";

function isSafeInternalPath(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  if (path.includes("://")) return false;
  return true;
}

/** Remember where to send the user after a successful sign-in (OAuth or password). */
export function setPostLoginRedirect(path: string): void {
  if (typeof window === "undefined") return;
  if (!isSafeInternalPath(path)) return;
  sessionStorage.setItem(STORAGE_KEY, path);
}

/**
 * Returns the saved internal path and clears it, or `/dashboard` if unset/invalid.
 */
export function consumePostLoginRedirect(): string {
  if (typeof window === "undefined") return "/dashboard";
  const raw = sessionStorage.getItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
  if (raw && isSafeInternalPath(raw)) return raw;
  return "/dashboard";
}
