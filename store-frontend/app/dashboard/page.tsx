"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  fetchMyPackages,
  apiUpdateProfile,
  apiChangePassword,
  apiUploadAvatar,
  apiGetMyOrgs,
  apiCreateOrg,
  apiAddOrgMember,
  apiRemoveOrgMember,
  apiDeleteAccount,
  ApiError,
} from "@/lib/api";
import { passwordPolicyError } from "@/lib/passwordPolicy";
import type { RegistryPackage, MyOrg } from "@/lib/types";
import {
  computeCapabilityBadges,
  executionIndicatesTests,
} from "@/lib/xsil-parser";
import { PackageCapabilityChips } from "@/components/package-capability-chips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Package,
  Download,
  Settings,
  Users,
  ChevronRight,
  RefreshCcw,
  WifiOff,
  ExternalLink,
  CheckCircle2,
  UserCircle,
  Camera,
  Building2,
  BarChart3,
  Trash2,
  Linkedin,
  Shield,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

function fmtNum(n: number) {
  return n.toLocaleString();
}

const DASHBOARD_TABS = ["stats", "packages", "account", "orgs"] as const;
type DashboardTab = (typeof DASHBOARD_TABS)[number];

function isDashboardTab(v: string | null): v is DashboardTab {
  return v !== null && (DASHBOARD_TABS as readonly string[]).includes(v);
}

export default function DashboardPage() {
  const { user, token, isLoading, updateUser, login, logout } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<DashboardTab>("stats");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search).get("tab");
    if (isDashboardTab(q)) setTab(q);
  }, []);

  function goTab(next: DashboardTab) {
    setTab(next);
    const path = `/dashboard?tab=${next}`;
    router.replace(path, { scroll: false });
  }

  const [packages, setPackages] = useState<RegistryPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Profile edit state
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);

  // Avatar upload state
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [avatarSaved, setAvatarSaved] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(false);

  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmUsername, setDeleteConfirmUsername] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Organizations
  const [orgs, setOrgs] = useState<MyOrg[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(true);
  const [orgError, setOrgError] = useState("");
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgDisplayName, setNewOrgDisplayName] = useState("");
  const [newOrgDesc, setNewOrgDesc] = useState("");
  const [newOrgLinkedin, setNewOrgLinkedin] = useState("");
  const [newOrgCreating, setNewOrgCreating] = useState(false);
  const [newOrgError, setNewOrgError] = useState("");
  const [newOrgSuccess, setNewOrgSuccess] = useState("");
  // { [orgSlug]: { username, adding, error } }
  const [addMemberInputs, setAddMemberInputs] = useState<
    Record<string, { username: string; busy: boolean; error: string }>
  >({});

  useEffect(() => {
    if (user) {
      setBio(user.bio ?? "");
      setAvatarUrl(user.avatarUrl ?? "");
    }
  }, [user]);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login?next=/dashboard");
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetchMyPackages(token)
      .then(setPackages)
      .catch((e) =>
        setError(e instanceof ApiError ? e.message : "Failed to load packages.")
      )
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setOrgsLoading(true);
    apiGetMyOrgs(token)
      .then(setOrgs)
      .catch((e) =>
        setOrgError(e instanceof ApiError ? e.message : "Failed to load organizations.")
      )
      .finally(() => setOrgsLoading(false));
  }, [token]);

  async function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setNewOrgError("");
    setNewOrgSuccess("");
    setNewOrgCreating(true);
    try {
      const org = await apiCreateOrg(token, {
        name: newOrgName.trim(),
        displayName: newOrgDisplayName.trim(),
        description: newOrgDesc.trim() || undefined,
        linkedinUrl: newOrgLinkedin.trim() || undefined,
      });
      setOrgs((prev) => [
        ...prev,
        { ...org, role: "owner" as const, joinedAt: org.createdAt, _count: { members: 1, packages: 0 } },
      ]);
      setNewOrgName("");
      setNewOrgDisplayName("");
      setNewOrgDesc("");
      setNewOrgLinkedin("");
      setNewOrgSuccess(`Organization @${org.slug} created.`);
      setTimeout(() => setNewOrgSuccess(""), 3000);
    } catch (err) {
      setNewOrgError(err instanceof ApiError ? err.message : "Failed to create organization.");
    } finally {
      setNewOrgCreating(false);
    }
  }

  async function handleAddMember(orgSlug: string) {
    if (!token) return;
    const state = addMemberInputs[orgSlug];
    if (!state?.username.trim()) return;
    setAddMemberInputs((prev) => ({
      ...prev,
      [orgSlug]: { ...prev[orgSlug], busy: true, error: "" },
    }));
    try {
      await apiAddOrgMember(token, orgSlug, state.username.trim());
      setAddMemberInputs((prev) => ({
        ...prev,
        [orgSlug]: { username: "", busy: false, error: "" },
      }));
      // Refresh orgs to reflect new member count
      const updated = await apiGetMyOrgs(token);
      setOrgs(updated);
    } catch (err) {
      setAddMemberInputs((prev) => ({
        ...prev,
        [orgSlug]: {
          ...prev[orgSlug],
          busy: false,
          error: err instanceof ApiError ? err.message : "Failed to add member.",
        },
      }));
    }
  }

  async function handleRemoveMember(orgSlug: string, username: string) {
    if (!token) return;
    try {
      await apiRemoveOrgMember(token, orgSlug, username);
      const updated = await apiGetMyOrgs(token);
      setOrgs(updated);
    } catch (err) {
      setOrgError(err instanceof ApiError ? err.message : "Failed to remove member.");
    }
  }

  function handleAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError("");
    setAvatarSaved(false);
    if (!file.type.startsWith("image/")) {
      setAvatarError("Please select an image file (JPEG, PNG, WebP, or GIF).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError("Image must be 2 MB or smaller.");
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleAvatarUpload() {
    if (!token || !avatarFile) return;
    setAvatarUploading(true);
    setAvatarError("");
    setAvatarSaved(false);
    try {
      const { user: updated } = await apiUploadAvatar(token, avatarFile);
      updateUser(updated);
      setAvatarSaved(true);
      setAvatarFile(null);
      // Keep the preview showing the new avatar.
      setTimeout(() => setAvatarSaved(false), 3000);
    } catch (err) {
      setAvatarError(err instanceof ApiError ? err.message : "Upload failed.");
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setProfileSaving(true);
    setProfileError("");
    setProfileSaved(false);
    try {
      const { user: updated } = await apiUpdateProfile(token, {
        bio: bio.trim() || null,
        avatarUrl: avatarUrl.trim() || null,
      });
      updateUser(updated);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err) {
      setProfileError(
        err instanceof ApiError ? err.message : "Profile update failed."
      );
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setPasswordError("");
    setPasswordSaved(false);

    const pwErr = passwordPolicyError(newPassword);
    if (pwErr) {
      setPasswordError(pwErr);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setPasswordSaving(true);
    try {
      const { token: newToken, user: updated } = await apiChangePassword(
        token,
        currentPassword,
        newPassword
      );
      // Rotate the stored token and update the auth context user.
      login(newToken, updated);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 4000);
    } catch (err) {
      setPasswordError(
        err instanceof ApiError ? err.message : "Password change failed."
      );
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user) return;
    setDeleteError("");
    if (deleteConfirmUsername.trim().toLowerCase() !== user.username.toLowerCase()) {
      setDeleteError(`Type your username exactly (${user.username}) to confirm.`);
      return;
    }
    setDeleteBusy(true);
    try {
      await apiDeleteAccount(token, deletePassword, deleteConfirmUsername.trim());
      setDeletePassword("");
      setDeleteConfirmUsername("");
      await logout();
      router.replace("/");
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Failed to delete account.");
    } finally {
      setDeleteBusy(false);
    }
  }

  if (isLoading || !user) {
    return (
      <div className="container max-w-5xl px-4 py-10">
        <div className="space-y-4 animate-pulse">
          <div className="h-8 w-48 rounded bg-muted" />
          <div className="grid grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 rounded-lg bg-muted" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const totalDownloads = packages.reduce((s, p) => s + p.totalDownloads, 0);
  const totalVersions = packages.reduce(
    (s, p) => s + (p.versions?.length ?? 0),
    0
  );

  const tabNav: { id: DashboardTab; label: string; icon: typeof BarChart3 }[] = [
    { id: "stats", label: "Stats", icon: BarChart3 },
    { id: "packages", label: "Packages", icon: Package },
    { id: "account", label: "Account", icon: UserCircle },
    { id: "orgs", label: "Organizations", icon: Building2 },
  ];

  return (
    <div className="container max-w-5xl px-4 py-10">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Dashboard
          </h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            @{user.username}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {user.isPlatformAdmin && (
            <Link href="/dashboard/admin">
              <Button variant="outline" className="gap-2" size="sm">
                <Shield className="h-4 w-4" />
                Platform
              </Button>
            </Link>
          )}
          <Link href="/publish/new">
            <Button className="gap-2" size="sm">
              <Plus className="h-4 w-4" />
              Publish
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs — single row avoids layout jump when labels wrap */}
      <nav
        className="-mx-1 mb-0 flex flex-nowrap gap-1 overflow-x-auto overflow-y-hidden border-b border-border px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Dashboard sections"
      >
        {tabNav.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => goTab(id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors -mb-px",
              tab === id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            {label}
          </button>
        ))}
      </nav>

      <section className="pt-6" aria-label="Dashboard content">
      {tab === "stats" && (
      <div className="mb-2 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-background p-5">
          <Package className="mb-2 h-5 w-5 text-muted-foreground" />
          <p className="text-3xl font-bold">{packages.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            package{packages.length !== 1 ? "s" : ""} published
          </p>
        </div>
        <div className="rounded-lg border bg-background p-5">
          <Download className="mb-2 h-5 w-5 text-muted-foreground" />
          <p className="text-3xl font-bold">{fmtNum(totalDownloads)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">total downloads</p>
        </div>
        <div className="hidden rounded-lg border bg-background p-5 sm:block">
          <ChevronRight className="mb-2 h-5 w-5 text-muted-foreground" />
          <p className="text-3xl font-bold">{totalVersions}</p>
          <p className="text-xs text-muted-foreground mt-0.5">versions published</p>
        </div>
      </div>
      )}

      {tab === "packages" && (
      <div className="mb-2">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Your packages
          </h2>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <WifiOff className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription className="flex items-center gap-3">
              {error}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.refresh()}
                className="gap-1.5"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-lg border bg-muted/30"
              />
            ))}
          </div>
        ) : packages.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-muted/20 py-20 text-center">
            <Package className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No packages yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Publish your first{" "}
              <code className="font-mono text-xs">.xsil</code> package to get
              started.
            </p>
            <Link href="/publish/new" className="mt-4 inline-block">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Publish a Package
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {packages.map((pkg) => {
              const latest = pkg.versions?.[0];
              const maturity = computeCapabilityBadges({
                isa: latest?.isa ?? null,
                toolchain: latest?.toolchain ?? null,
                targetsRaw: latest?.targets ?? null,
                resolutionMode: latest?.resolutionMode ?? null,
                dependenciesRaw: latest?.dependencies ?? null,
                hasTests: executionIndicatesTests(latest?.execution ?? null),
              });
              return (
                <div
                  key={pkg.id}
                  className="flex flex-col gap-3 rounded-xl border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{pkg.name}</span>
                      {pkg.latestVersion && (
                        <span className="rounded-full border bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                          {pkg.latestVersion}
                        </span>
                      )}
                      {pkg.isDeprecated && (
                        <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive">
                          deprecated
                        </span>
                      )}
                    </div>
                    {pkg.org && (
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        <span className="font-mono">@{pkg.org.slug}</span>
                        <span className="mx-1">·</span>
                        <span>{pkg.org.displayName}</span>
                      </p>
                    )}
                    <PackageCapabilityChips
                      level={maturity.level}
                      badges={maturity.badges}
                      maxBadges={5}
                    />
                    <p className="mt-0.5 text-sm text-muted-foreground line-clamp-1">
                      {pkg.description || "No description."}
                    </p>
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Download className="h-3 w-3" />
                        {fmtNum(pkg.totalDownloads)} downloads
                      </span>
                      <span>
                        {pkg.versions?.length ?? 0} version
                        {(pkg.versions?.length ?? 0) !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Link
                      href={`/package/${pkg.slug}`}
                      className="flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View
                    </Link>
                    <Link
                      href={`/publish/${pkg.slug}/version`}
                      className="flex h-8 items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-3 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      New version
                    </Link>
                    <Link
                      href={`/publish/${pkg.slug}/settings`}
                      className="flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      Settings
                    </Link>
                    <Link
                      href={`/publish/${pkg.slug}/maintainers`}
                      className="flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <Users className="h-3.5 w-3.5" />
                      Maintainers
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {tab === "account" && (
      <div>
        <div className="mb-5 flex items-center gap-2">
          <UserCircle className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Profile &amp; security
          </h2>
        </div>

        {/* Avatar */}
        <div className="mb-8 flex items-center gap-5">
          <div className="relative shrink-0">
            {avatarPreview || user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarPreview ?? user.avatarUrl ?? ""}
                alt="Avatar preview"
                className="h-20 w-20 rounded-full border object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full border bg-muted">
                <UserCircle className="h-10 w-10 text-muted-foreground" />
              </div>
            )}
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border bg-background shadow-sm hover:bg-muted transition-colors"
              title="Change avatar"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleAvatarFileChange}
            />
            {avatarFile ? (
              <div className="flex items-center gap-2">
                <span className="truncate text-sm text-muted-foreground max-w-[180px]">
                  {avatarFile.name}
                </span>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAvatarUpload}
                  disabled={avatarUploading}
                >
                  {avatarUploading ? "Uploading…" : "Upload"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => { setAvatarFile(null); setAvatarPreview(null); setAvatarError(""); }}
                  disabled={avatarUploading}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                JPEG, PNG, WebP, or GIF &mdash; max 2 MB
              </p>
            )}
            {avatarError && (
              <p className="text-sm text-destructive">{avatarError}</p>
            )}
            {avatarSaved && (
              <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                Avatar updated
              </span>
            )}
          </div>
        </div>

        <div className="mb-8 max-w-lg rounded-lg border bg-muted/20 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Email
              </p>
              <p className="font-mono text-sm">{user.email}</p>
            </div>
            {user.emailVerified === false && (
              <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                Unverified
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Used for sign-in and notifications. To change it, contact support for now.
          </p>
        </div>

        <form
          onSubmit={handleProfileSave}
          className="max-w-lg space-y-5"
        >
          <div className="space-y-1.5">
            <Label htmlFor="profile-bio">Bio</Label>
            <Textarea
              id="profile-bio"
              placeholder="A short description about yourself (max 300 characters)"
              maxLength={300}
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">
              {bio.length} / 300
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-avatar">Avatar URL</Label>
            <Input
              id="profile-avatar"
              type="url"
              placeholder="https://example.com/your-avatar.png"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Public URL to a square image (HTTPS recommended).
            </p>
          </div>

          {profileError && (
            <p className="text-sm text-destructive">{profileError}</p>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={profileSaving} size="sm">
              {profileSaving ? "Saving…" : "Save profile"}
            </Button>
            {profileSaved && (
              <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                Saved
              </span>
            )}
          </div>
        </form>

        {/* Change password */}
        <div className="mt-10 border-t pt-8">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Change password
          </h3>
          <form onSubmit={handlePasswordChange} className="max-w-lg space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                placeholder="Letters and digits, 8+ characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {passwordError && (
              <p className="text-sm text-destructive">{passwordError}</p>
            )}

            <p className="text-xs text-muted-foreground">
              Use at least 8 characters with at least one letter and one digit.
            </p>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={passwordSaving} size="sm" variant="outline">
                {passwordSaving ? "Updating…" : "Update password"}
              </Button>
              {passwordSaved && (
                <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Password updated — all other sessions signed out
                </span>
              )}
            </div>
          </form>
        </div>

        <div className="mt-12 max-w-lg border-t border-destructive/25 pt-8">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-destructive">
            <Trash2 className="h-4 w-4" aria-hidden />
            Danger zone
          </h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Permanently delete your account and registry profile. You cannot delete your account if
            you still own published packages—remove or transfer them first.
          </p>
          <form onSubmit={handleDeleteAccount} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="delete-confirm-user">Type your username to confirm</Label>
              <Input
                id="delete-confirm-user"
                type="text"
                autoComplete="username"
                value={deleteConfirmUsername}
                onChange={(e) => setDeleteConfirmUsername(e.target.value)}
                placeholder={user.username}
                aria-describedby="delete-confirm-hint"
              />
              <p id="delete-confirm-hint" className="text-xs text-muted-foreground">
                Enter <span className="font-mono font-medium">{user.username}</span> (same as in the dashboard header). This cannot be undone.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="delete-password">Your password</Label>
              <Input
                id="delete-password"
                type="password"
                autoComplete="current-password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Current password"
              />
            </div>
            {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={
                deleteBusy ||
                !deletePassword ||
                deleteConfirmUsername.trim().toLowerCase() !== user.username.toLowerCase()
              }
            >
              {deleteBusy ? "Deleting…" : "Delete my account"}
            </Button>
          </form>
        </div>
      </div>
      )}

      {tab === "orgs" && (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Organizations
          </h2>
        </div>

        {/* My orgs list */}
        {orgsLoading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/30" />
            ))}
          </div>
        ) : orgError ? (
          <p className="text-sm text-destructive">{orgError}</p>
        ) : orgs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You are not a member of any organization yet.
          </p>
        ) : (
          <div className="divide-y border rounded-lg">
            {orgs.map((org) => (
              <div key={org.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    {org.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={org.avatarUrl}
                        alt={org.displayName}
                        className="w-9 h-9 rounded-lg border object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-lg border bg-muted flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <a
                        href={`/orgs/${org.slug}`}
                        className="font-medium text-sm hover:underline"
                      >
                        {org.displayName}
                      </a>
                      <p className="text-xs text-muted-foreground font-mono">@{org.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs border rounded px-1.5 py-0.5 font-medium ${
                        org.role === "owner"
                          ? "bg-amber-100 text-amber-800 border-amber-200"
                          : org.role === "admin"
                          ? "bg-blue-100 text-blue-800 border-blue-200"
                          : "bg-slate-100 text-slate-700 border-slate-200"
                      }`}
                    >
                      {org.role}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {org._count.members} member{org._count.members !== 1 ? "s" : ""}
                      {" · "}
                      {org._count.packages} pkg{org._count.packages !== 1 ? "s" : ""}
                    </span>
                    {org.linkedinUrl && (
                      <a
                        href={org.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        title="LinkedIn"
                      >
                        <Linkedin className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <a
                      href={`/orgs/${org.slug}`}
                      className="text-xs text-muted-foreground hover:text-foreground"
                      title="View org page"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* Add member (owners & admins only) */}
                {(org.role === "owner" || org.role === "admin") && (
                  <div className="flex items-center gap-2 pt-1">
                    <Input
                      placeholder="Add member by username"
                      className="h-8 text-sm max-w-xs"
                      value={addMemberInputs[org.slug]?.username ?? ""}
                      onChange={(e) =>
                        setAddMemberInputs((prev) => ({
                          ...prev,
                          [org.slug]: {
                            username: e.target.value,
                            busy: prev[org.slug]?.busy ?? false,
                            error: prev[org.slug]?.error ?? "",
                          },
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddMember(org.slug);
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleAddMember(org.slug)}
                      disabled={
                        addMemberInputs[org.slug]?.busy ||
                        !addMemberInputs[org.slug]?.username?.trim()
                      }
                    >
                      <Users className="w-3.5 h-3.5 mr-1" />
                      {addMemberInputs[org.slug]?.busy ? "Adding…" : "Add"}
                    </Button>
                    {addMemberInputs[org.slug]?.error && (
                      <span className="text-xs text-destructive">
                        {addMemberInputs[org.slug].error}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Create new org form */}
        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Create an organization
          </h3>
          <form onSubmit={handleCreateOrg} className="space-y-4 max-w-md">
            <div className="space-y-1.5">
              <Label htmlFor="orgName">Organization name (slug)</Label>
              <Input
                id="orgName"
                placeholder="e.g. risc-v-foundation"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Lowercase letters, digits, and hyphens only. Used in URLs as{" "}
                <code className="font-mono">@{newOrgName || "org-name"}</code>.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="orgDisplayName">Display name</Label>
              <Input
                id="orgDisplayName"
                placeholder="e.g. RISC-V Foundation"
                value={newOrgDisplayName}
                onChange={(e) => setNewOrgDisplayName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="orgDesc">Description (optional)</Label>
              <Textarea
                id="orgDesc"
                placeholder="What does this organization do?"
                rows={2}
                value={newOrgDesc}
                onChange={(e) => setNewOrgDesc(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="orgLinkedin">LinkedIn company profile (optional)</Label>
              <Input
                id="orgLinkedin"
                type="url"
                placeholder="https://www.linkedin.com/company/your-org"
                value={newOrgLinkedin}
                onChange={(e) => setNewOrgLinkedin(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                HTTPS link to your organization&apos;s LinkedIn company page.
              </p>
            </div>
            {newOrgError && (
              <p className="text-sm text-destructive">{newOrgError}</p>
            )}
            {newOrgSuccess && (
              <p className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                {newOrgSuccess}
              </p>
            )}
            <Button type="submit" disabled={newOrgCreating} className="gap-2">
              <Building2 className="h-4 w-4" />
              {newOrgCreating ? "Creating…" : "Create organization"}
            </Button>
          </form>
        </div>
      </div>
      )}
      </section>
    </div>
  );
}
