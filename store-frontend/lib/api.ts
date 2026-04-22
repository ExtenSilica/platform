import type {
  RegistryPackage,
  RegistryVersion,
  UserProfile,
  Review,
  PackageStats,
  Organization,
  MyOrg,
  OrgMember,
} from "@/lib/types";
import type { AuthUser } from "@/lib/auth";

/** Registry HTTP origin without a trailing `/api` segment (same base as `/auth/login`, `/auth/github/start`, …). */
export function getRegistryOrigin(): string {
  return (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api").replace(
    /\/api\/?$/,
    ""
  );
}

const API_BASE = getRegistryOrigin();

/** `GET /auth/me` returns `{ user, oauthProviders? }`. Accept legacy flat `user` shape too. */
export function normalizeAuthMePayload(body: unknown): AuthUser | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const inner = o.user;
  if (inner && typeof inner === "object") {
    const u = inner as Record<string, unknown>;
    if (
      typeof u.id === "number" &&
      typeof u.username === "string" &&
      typeof u.email === "string"
    ) {
      return {
        id: u.id,
        username: u.username,
        email: u.email,
        bio: (u.bio as string | null | undefined) ?? null,
        avatarUrl: (u.avatarUrl as string | null | undefined) ?? null,
        createdAt:
          typeof u.createdAt === "string"
            ? u.createdAt
            : u.createdAt instanceof Date
              ? u.createdAt.toISOString()
              : "",
      };
    }
  }
  if (
    typeof o.id === "number" &&
    typeof o.username === "string" &&
    typeof o.email === "string"
  ) {
    return body as AuthUser;
  }
  return null;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public errors?: Record<string, string>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiFetch<T>(path: string, token?: string | null): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    headers,
  });
  if (!res.ok) throw new ApiError(res.statusText, res.status);
  return res.json() as Promise<T>;
}

async function apiWrite<T>(
  method: string,
  path: string,
  token: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({})) as { error?: string; errors?: Record<string, string> };
    throw new ApiError(payload.error ?? res.statusText, res.status, payload.errors);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

/* ─── Auth / profile ───────────────────────────────────────────────────── */

export async function apiUpdateProfile(
  token: string,
  patch: { bio?: string | null; avatarUrl?: string | null }
): Promise<{ user: import("@/lib/auth").AuthUser }> {
  return apiWrite<{ user: import("@/lib/auth").AuthUser }>(
    "PATCH",
    "/auth/me",
    token,
    patch
  );
}

export async function apiChangePassword(
  token: string,
  currentPassword: string,
  newPassword: string
): Promise<{ token: string; user: import("@/lib/auth").AuthUser }> {
  return apiWrite<{ token: string; user: import("@/lib/auth").AuthUser }>(
    "PATCH",
    "/auth/me/password",
    token,
    { currentPassword, newPassword }
  );
}

export async function apiUploadAvatar(
  token: string,
  file: File
): Promise<{ user: import("@/lib/auth").AuthUser }> {
  const body = new FormData();
  body.append("avatar", file);
  const res = await fetch(`${API_BASE}/auth/me/avatar`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  const payload = await res.json().catch(() => ({})) as { user?: import("@/lib/auth").AuthUser; error?: string };
  if (!res.ok) throw new ApiError(payload.error ?? res.statusText, res.status);
  return payload as { user: import("@/lib/auth").AuthUser };
}

export async function apiForgotPassword(email: string): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new ApiError(res.statusText, res.status);
  return res.json();
}

export async function apiResetPassword(
  token: string,
  newPassword: string
): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, newPassword }),
  });
  const payload = await res.json().catch(() => ({})) as { ok?: boolean; message?: string; error?: string };
  if (!res.ok) throw new ApiError(payload.error ?? res.statusText, res.status);
  return payload as { ok: boolean; message: string };
}

/* ─── Public read ──────────────────────────────────────────────────────── */

export async function fetchPackages(
  query?: string,
  limit?: number
): Promise<RegistryPackage[]> {
  const qs = new URLSearchParams();
  if (query) qs.set("q", query);
  if (limit) qs.set("limit", String(limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<RegistryPackage[]>(`/packages${suffix}`);
}

export async function fetchPackage(
  slug: string
): Promise<RegistryPackage | null> {
  const res = await fetch(`${API_BASE}/packages/${slug}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiError(res.statusText, res.status);
  return res.json() as Promise<RegistryPackage>;
}

export async function fetchPackageReviews(slug: string): Promise<Review[]> {
  const res = await fetch(`${API_BASE}/packages/${slug}/reviews`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json() as Promise<Review[]>;
}

export async function fetchPackageStats(
  slug: string
): Promise<PackageStats | null> {
  const res = await fetch(`${API_BASE}/stats/packages/${slug}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json() as Promise<PackageStats>;
}

export async function fetchUser(
  username: string
): Promise<UserProfile | null> {
  const res = await fetch(`${API_BASE}/users/${username}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiError(res.statusText, res.status);
  return res.json() as Promise<UserProfile>;
}

export async function fetchMaintainers(slug: string): Promise<Maintainer[]> {
  return apiFetch<Maintainer[]>(`/packages/${slug}/maintainers`);
}

/* ─── Auth ──────────────────────────────────────────────────────────────── */

export interface LoginResult {
  token: string;
  user: AuthUser;
}

export async function apiLogin(
  email: string,
  password: string
): Promise<LoginResult> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const payload = await res.json() as { token?: string; user?: AuthUser; error?: string };
  if (!res.ok) throw new ApiError(payload.error ?? "Login failed", res.status);
  return payload as LoginResult;
}

export async function apiRegister(
  username: string,
  email: string,
  password: string
): Promise<LoginResult> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });
  const payload = await res.json() as { token?: string; user?: AuthUser; error?: string };
  if (!res.ok)
    throw new ApiError(payload.error ?? "Registration failed", res.status);
  return payload as LoginResult;
}

/** Current user from `GET /auth/me` (Bearer token). */
export async function apiFetchMe(
  token: string,
  init?: { signal?: AbortSignal }
): Promise<AuthUser | null> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: init?.signal,
  });
  if (!res.ok) return null;
  const body = await res.json();
  return normalizeAuthMePayload(body);
}

/** Exchange one-time `oauth_code` query param after browser OAuth redirect. */
export async function apiOAuthExchange(
  code: string,
  init?: { signal?: AbortSignal }
): Promise<LoginResult> {
  const res = await fetch(`${API_BASE}/auth/oauth/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
    signal: init?.signal,
  });
  const payload = (await res.json().catch(() => ({}))) as {
    token?: string;
    user?: AuthUser;
    error?: string;
  };
  if (!res.ok) {
    throw new ApiError(payload.error ?? "OAuth exchange failed", res.status);
  }
  return payload as LoginResult;
}

/* ─── My packages ───────────────────────────────────────────────────────── */

export async function fetchMyPackages(
  token: string
): Promise<RegistryPackage[]> {
  return apiFetch<RegistryPackage[]>("/packages/me/packages", token);
}

/* ─── Package write ─────────────────────────────────────────────────────── */

export interface CreatePackageInput {
  name: string;
  description: string;
  shortDescription?: string;
  longDescription?: string;
  keywords?: string;
  license?: string;
  repositoryUrl?: string;
  homepageUrl?: string;
}

export async function apiCreatePackage(
  token: string,
  data: CreatePackageInput
): Promise<RegistryPackage> {
  return apiWrite<RegistryPackage>("POST", "/packages", token, data);
}

export interface UpdatePackageInput {
  description?: string;
  shortDescription?: string;
  longDescription?: string;
  keywords?: string;
  license?: string;
  repositoryUrl?: string;
  homepageUrl?: string;
  iconUrl?: string;
  isDeprecated?: boolean;
  deprecationMessage?: string | null;
}

export async function apiUpdatePackage(
  token: string,
  slug: string,
  data: UpdatePackageInput
): Promise<RegistryPackage> {
  return apiWrite<RegistryPackage>("PATCH", `/packages/${slug}`, token, data);
}

export async function apiPublishVersion(
  token: string,
  slug: string,
  formData: FormData
): Promise<RegistryVersion> {
  const res = await fetch(`${API_BASE}/packages/${slug}/versions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const payload = await res.json() as { error?: string } & Partial<RegistryVersion>;
  if (!res.ok) throw new ApiError(payload.error ?? "Publish failed", res.status);
  return payload as RegistryVersion;
}

/* ─── Reviews ───────────────────────────────────────────────────────────── */

export async function apiSubmitReview(
  token: string,
  slug: string,
  rating: number,
  comment?: string
): Promise<Review> {
  return apiWrite<Review>("POST", `/packages/${slug}/reviews`, token, { rating, comment });
}

export async function apiDeleteReview(token: string, slug: string): Promise<void> {
  return apiWrite<void>("DELETE", `/packages/${slug}/reviews/me`, token);
}

/* ─── Maintainers ───────────────────────────────────────────────────────── */

export interface Maintainer {
  id: number;
  userId: number;
  username: string;
  avatarUrl?: string | null;
  role: string;
  addedAt: string;
}

export async function apiAddMaintainer(
  token: string,
  slug: string,
  username: string
): Promise<Maintainer> {
  return apiWrite<Maintainer>(
    "POST",
    `/packages/${slug}/maintainers`,
    token,
    { username }
  );
}

export async function apiRemoveMaintainer(
  token: string,
  slug: string,
  userId: number
): Promise<void> {
  return apiWrite<void>(
    "DELETE",
    `/packages/${slug}/maintainers/${userId}`,
    token
  );
}

export async function apiYankVersion(
  token: string,
  slug: string,
  version: string,
  yanked: boolean,
  reason?: string
): Promise<{ version: string; isYanked: boolean; yankReason: string | null; latestVersion: string | null }> {
  return apiWrite(
    "PATCH",
    `/packages/${slug}/versions/${version}`,
    token,
    { yanked, reason: reason ?? null }
  );
}

// ── Organizations ─────────────────────────────────────────────────────────────

export async function apiGetMyOrgs(token: string): Promise<MyOrg[]> {
  return apiFetch<MyOrg[]>("/auth/me/orgs", token);
}

export async function apiGetOrg(slug: string): Promise<Organization> {
  return apiFetch<Organization>(`/orgs/${slug}`);
}

export async function apiCreateOrg(
  token: string,
  data: { name: string; displayName: string; description?: string; websiteUrl?: string }
): Promise<Organization> {
  return apiWrite<Organization>("POST", "/orgs", token, data);
}

export async function apiUpdateOrg(
  token: string,
  slug: string,
  data: { displayName?: string; description?: string | null; avatarUrl?: string | null; websiteUrl?: string | null }
): Promise<Organization> {
  return apiWrite<Organization>("PATCH", `/orgs/${slug}`, token, data);
}

export async function apiDeleteOrg(token: string, slug: string): Promise<void> {
  return apiWrite<void>("DELETE", `/orgs/${slug}`, token);
}

export async function apiAddOrgMember(
  token: string,
  orgSlug: string,
  username: string,
  role: "owner" | "admin" | "member" = "member"
): Promise<OrgMember> {
  return apiWrite<OrgMember>("POST", `/orgs/${orgSlug}/members`, token, { username, role });
}

export async function apiUpdateOrgMemberRole(
  token: string,
  orgSlug: string,
  username: string,
  role: "owner" | "admin" | "member"
): Promise<OrgMember> {
  return apiWrite<OrgMember>("PATCH", `/orgs/${orgSlug}/members/${username}`, token, { role });
}

export async function apiRemoveOrgMember(
  token: string,
  orgSlug: string,
  username: string
): Promise<void> {
  return apiWrite<void>("DELETE", `/orgs/${orgSlug}/members/${username}`, token);
}
