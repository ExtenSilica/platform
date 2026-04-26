"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  apiAdminHealth,
  apiAdminUsers,
  apiAdminPackages,
  apiAdminCreateUser,
  apiAdminUpdateUser,
  apiAdminResetUserPassword,
  apiAdminDeleteUser,
  apiAdminVerifyUserEmail,
  apiAdminCreatePackage,
  apiAdminUpdatePackage,
  apiAdminDeletePackage,
  ApiError,
  type AdminHealthResponse,
  type AdminUserRow,
  type AdminPackageRow,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ArrowLeft,
  RefreshCcw,
  Shield,
  Activity,
  Database,
  HardDrive,
  Users,
  Package,
  Plus,
  Trash2,
  Pencil,
  KeyRound,
  CheckCircle2,
} from "lucide-react";
import { PackageCapabilityChips } from "@/components/package-capability-chips";

const PAGE_SIZE = 50;

type AdminTab = "health" | "users" | "packages";

export default function PlatformAdminPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  const [health, setHealth] = useState<AdminHealthResponse | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [userSkip, setUserSkip] = useState(0);
  const [packages, setPackages] = useState<AdminPackageRow[]>([]);
  const [pkgTotal, setPkgTotal] = useState(0);
  const [pkgSkip, setPkgSkip] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [tab, setTab] = useState<AdminTab>("health");

  // Create user form
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newVerified, setNewVerified] = useState(true);

  // Edit user form (single-row inline editor)
  const [editUserId, setEditUserId] = useState<number | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [editVerified, setEditVerified] = useState(false);
  const [resetPw, setResetPw] = useState("");

  // Create package form
  const [pkgSlug, setPkgSlug] = useState("");
  const [pkgName, setPkgName] = useState("");
  const [pkgDesc, setPkgDesc] = useState("");
  const [pkgAuthor, setPkgAuthor] = useState("");
  const [pkgOwner, setPkgOwner] = useState("");
  const [pkgOrg, setPkgOrg] = useState("");

  // Edit package inline
  const [editPkgSlug, setEditPkgSlug] = useState<string | null>(null);
  const [editPkgName, setEditPkgName] = useState("");
  const [editPkgDesc, setEditPkgDesc] = useState("");
  const [editPkgKeywords, setEditPkgKeywords] = useState("");
  const [editPkgOwner, setEditPkgOwner] = useState("");
  const [editPkgOrg, setEditPkgOrg] = useState("");
  const [editPkgDeprecated, setEditPkgDeprecated] = useState(false);
  const [editPkgDeprecationMessage, setEditPkgDeprecationMessage] = useState("");

  const loadAll = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    setError("");
    setActionMsg("");
    try {
      const [h, u, p] = await Promise.all([
        apiAdminHealth(token),
        apiAdminUsers(token, { limit: PAGE_SIZE, skip: userSkip }),
        apiAdminPackages(token, { limit: PAGE_SIZE, skip: pkgSkip }),
      ]);
      setHealth(h);
      setUsers(u.users);
      setUsersTotal(u.total);
      setPackages(p.packages);
      setPkgTotal(p.total);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load admin data.");
    } finally {
      setBusy(false);
    }
  }, [token, userSkip, pkgSkip]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!user.isPlatformAdmin) {
      router.replace("/dashboard");
      return;
    }
    void loadAll();
  }, [isLoading, user, router, loadAll]);

  async function verifyUser(id: number) {
    if (!token) return;
    setError("");
    setActionMsg("");
    try {
      await apiAdminVerifyUserEmail(token, id);
      setActionMsg(`User #${id} marked verified.`);
      await loadAll();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Verify failed.");
    }
  }

  function statusBadge(ok: boolean, labelOk: string, labelBad: string) {
    return (
      <Badge variant="outline" className={ok ? "border-green-200 text-green-700" : "border-red-200 text-red-700"}>
        {ok ? labelOk : labelBad}
      </Badge>
    );
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError("");
    setActionMsg("");
    setBusy(true);
    try {
      await apiAdminCreateUser(token, {
        username: newUsername.trim().toLowerCase(),
        email: newEmail.trim(),
        password: newPassword,
        emailVerified: newVerified,
      });
      setActionMsg("User created.");
      setNewUsername("");
      setNewEmail("");
      setNewPassword("");
      setNewVerified(true);
      await loadAll();
    } catch (e2) {
      setError(e2 instanceof ApiError ? e2.message : "Create user failed.");
    } finally {
      setBusy(false);
    }
  }

  function beginEditUser(u: AdminUserRow) {
    setEditUserId(u.id);
    setEditEmail(u.email);
    setEditBio("");
    setEditAvatarUrl("");
    setEditVerified(u.emailVerified);
    setResetPw("");
  }

  async function saveUserEdits() {
    if (!token || editUserId == null) return;
    setError("");
    setActionMsg("");
    setBusy(true);
    try {
      await apiAdminUpdateUser(token, editUserId, {
        email: editEmail.trim(),
        bio: editBio.trim() === "" ? null : editBio,
        avatarUrl: editAvatarUrl.trim() === "" ? null : editAvatarUrl,
        emailVerified: editVerified,
      });
      setActionMsg(`User #${editUserId} updated.`);
      setEditUserId(null);
      await loadAll();
    } catch (e2) {
      setError(e2 instanceof ApiError ? e2.message : "Update user failed.");
    } finally {
      setBusy(false);
    }
  }

  async function resetUserPassword() {
    if (!token || editUserId == null) return;
    setError("");
    setActionMsg("");
    setBusy(true);
    try {
      await apiAdminResetUserPassword(token, editUserId, resetPw);
      setActionMsg(`Password reset for user #${editUserId}.`);
      setResetPw("");
    } catch (e2) {
      setError(e2 instanceof ApiError ? e2.message : "Password reset failed.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteUser(id: number) {
    if (!token) return;
    // eslint-disable-next-line no-alert
    if (!confirm(`Delete user #${id}? This cannot be undone.`)) return;
    setError("");
    setActionMsg("");
    setBusy(true);
    try {
      await apiAdminDeleteUser(token, id);
      setActionMsg(`User #${id} deleted.`);
      await loadAll();
    } catch (e2) {
      setError(e2 instanceof ApiError ? e2.message : "Delete user failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreatePackage(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError("");
    setActionMsg("");
    setBusy(true);
    try {
      await apiAdminCreatePackage(token, {
        slug: pkgSlug.trim(),
        name: pkgName.trim(),
        description: pkgDesc.trim(),
        author: pkgAuthor.trim(),
        ownerUsername: pkgOwner.trim() || undefined,
        orgSlug: pkgOrg.trim() || undefined,
      });
      setActionMsg("Package created.");
      setPkgSlug("");
      setPkgName("");
      setPkgDesc("");
      setPkgAuthor("");
      setPkgOwner("");
      setPkgOrg("");
      await loadAll();
    } catch (e2) {
      setError(e2 instanceof ApiError ? e2.message : "Create package failed.");
    } finally {
      setBusy(false);
    }
  }

  function beginEditPackage(p: AdminPackageRow) {
    setEditPkgSlug(p.slug);
    setEditPkgName(p.name);
    setEditPkgDesc("");
    setEditPkgKeywords("");
    setEditPkgOwner(p.owner?.username ?? "");
    setEditPkgOrg(p.org?.slug ?? "");
    setEditPkgDeprecated(p.isDeprecated);
    setEditPkgDeprecationMessage("");
  }

  async function savePackageEdits() {
    if (!token || !editPkgSlug) return;
    setError("");
    setActionMsg("");
    setBusy(true);
    try {
      await apiAdminUpdatePackage(token, editPkgSlug, {
        name: editPkgName.trim(),
        ...(editPkgDesc.trim() ? { description: editPkgDesc.trim() } : {}),
        ...(editPkgKeywords.trim() ? { keywords: editPkgKeywords.trim() } : {}),
        ownerUsername: editPkgOwner.trim() === "" ? null : editPkgOwner.trim().toLowerCase(),
        orgSlug: editPkgOrg.trim() === "" ? null : editPkgOrg.trim(),
        isDeprecated: editPkgDeprecated,
        deprecationMessage: editPkgDeprecationMessage.trim() === "" ? null : editPkgDeprecationMessage,
      });
      setActionMsg(`Package ${editPkgSlug} updated.`);
      setEditPkgSlug(null);
      await loadAll();
    } catch (e2) {
      setError(e2 instanceof ApiError ? e2.message : "Update package failed.");
    } finally {
      setBusy(false);
    }
  }

  async function deletePackage(slug: string) {
    if (!token) return;
    // eslint-disable-next-line no-alert
    if (!confirm(`Delete package ${slug}? This deletes all versions and reviews.`)) return;
    setError("");
    setActionMsg("");
    setBusy(true);
    try {
      await apiAdminDeletePackage(token, slug);
      setActionMsg(`Package ${slug} deleted.`);
      await loadAll();
    } catch (e2) {
      setError(e2 instanceof ApiError ? e2.message : "Delete package failed.");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading || !user?.isPlatformAdmin) {
    return (
      <div className="container max-w-6xl px-4 py-10">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Shield className="h-6 w-6 text-primary" aria-hidden />
              Platform admin
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Registry health, users, and packages. Configure access with{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                PLATFORM_ADMIN_USER_IDS
              </code>{" "}
              /{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                PLATFORM_ADMIN_EMAILS
              </code>{" "}
              on the API.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={busy}
          onClick={() => void loadAll()}
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <nav className="mb-6 flex flex-wrap gap-2">
        {(
          [
            { id: "health", label: "Health", icon: Activity },
            { id: "users", label: "Users", icon: Users },
            { id: "packages", label: "Packages", icon: Package },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            type="button"
            variant={tab === id ? "default" : "outline"}
            size="sm"
            className="gap-2"
            onClick={() => setTab(id)}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Button>
        ))}
      </nav>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {actionMsg && !error && (
        <Alert className="mb-4 border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100">
          <AlertTitle>Done</AlertTitle>
          <AlertDescription>{actionMsg}</AlertDescription>
        </Alert>
      )}

      {tab === "health" && (
        <section className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overall</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">
                  {health?.ok ? "Healthy" : "Degraded"}
                </div>
                <div className="mt-2">{statusBadge(Boolean(health?.ok), "ok", "error")}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Database</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{health?.database ?? "—"}</div>
                <div className="mt-2">
                  {statusBadge(health?.database === "ok", "reachable", "down")}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Storage</CardTitle>
                <HardDrive className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{health?.storage.driver ?? "—"}</div>
                <div className="mt-2">
                  {statusBadge(health?.storage.ok === "ok", "ok", "error")}
                </div>
                {health?.storage.error && (
                  <p className="mt-2 text-xs text-muted-foreground break-words">
                    {health.storage.error}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Latency</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{health ? `${health.latencyMs}ms` : "—"}</div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Uptime {health ? `${health.uptimeSeconds}s` : "—"}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{health?.counts.users ?? "—"}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Packages</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{health?.counts.packages ?? "—"}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Versions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{health?.counts.versions ?? "—"}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Organizations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{health?.counts.organizations ?? "—"}</div>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {tab === "users" && (
        <section className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add user</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateUser}>
                <div className="space-y-2">
                  <Label htmlFor="new-username">Username</Label>
                  <Input
                    id="new-username"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="lowercase, e.g. felipe"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-email">Email</Label>
                  <Input
                    id="new-email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="user@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="min 8 chars, needs letter + digit"
                    className="font-mono"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={newVerified}
                      onCheckedChange={(v) => setNewVerified(Boolean(v))}
                      id="new-verified"
                    />
                    <Label htmlFor="new-verified">Email verified</Label>
                  </div>
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <Button type="submit" className="gap-2" disabled={busy}>
                    <Plus className="h-4 w-4" />
                    Create user
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-medium">
              Users{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({usersTotal} total)
              </span>
            </h2>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={userSkip === 0 || busy}
                onClick={() => setUserSkip((s) => Math.max(0, s - PAGE_SIZE))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={userSkip + PAGE_SIZE >= usersTotal || busy}
                onClick={() => setUserSkip((s) => s + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                  <th className="p-3">ID</th>
                  <th className="p-3">Username</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Verified</th>
                  <th className="p-3">Token</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="p-3 font-mono text-xs">{u.id}</td>
                    <td className="p-3 font-mono text-xs">{u.username}</td>
                    <td className="max-w-[260px] truncate p-3 text-xs">{u.email}</td>
                    <td className="p-3 text-xs">
                      {u.emailVerified ? (
                        <span className="inline-flex items-center gap-1 text-green-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          yes
                        </span>
                      ) : (
                        <span className="text-muted-foreground">no</span>
                      )}
                    </td>
                    <td className="p-3 text-xs">{u.hasActiveToken ? "active" : "—"}</td>
                    <td className="p-3 text-right">
                      <div className="inline-flex flex-wrap justify-end gap-2">
                        {!u.emailVerified && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="gap-2"
                            onClick={() => void verifyUser(u.id)}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Verify
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => beginEditUser(u)}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="gap-2"
                          onClick={() => void deleteUser(u.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {editUserId != null && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Edit user #{editUserId}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={editVerified}
                        onCheckedChange={(v) => setEditVerified(Boolean(v))}
                        id="edit-verified"
                      />
                      <Label htmlFor="edit-verified">Email verified</Label>
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Bio</Label>
                    <Textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Avatar URL</Label>
                    <Input value={editAvatarUrl} onChange={(e) => setEditAvatarUrl(e.target.value)} />
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setEditUserId(null)}>
                    Cancel
                  </Button>
                  <Button type="button" className="gap-2" disabled={busy} onClick={() => void saveUserEdits()}>
                    <Pencil className="h-4 w-4" />
                    Save changes
                  </Button>
                </div>
                <div className="rounded-md border bg-muted/20 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div className="space-y-2">
                      <Label>Reset password</Label>
                      <Input
                        type="password"
                        className="font-mono"
                        placeholder="new password"
                        value={resetPw}
                        onChange={(e) => setResetPw(e.target.value)}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      className="gap-2"
                      disabled={busy || resetPw.trim() === ""}
                      onClick={() => void resetUserPassword()}
                    >
                      <KeyRound className="h-4 w-4" />
                      Reset
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {tab === "packages" && (
        <section className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add package</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreatePackage}>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input value={pkgSlug} onChange={(e) => setPkgSlug(e.target.value)} placeholder="rvx-demo or @org/name" className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={pkgName} onChange={(e) => setPkgName(e.target.value)} placeholder="RVX Demo" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Description</Label>
                  <Textarea value={pkgDesc} onChange={(e) => setPkgDesc(e.target.value)} placeholder="Short package description" />
                </div>
                <div className="space-y-2">
                  <Label>Author</Label>
                  <Input value={pkgAuthor} onChange={(e) => setPkgAuthor(e.target.value)} placeholder="extensilica" className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label>Owner username (optional)</Label>
                  <Input value={pkgOwner} onChange={(e) => setPkgOwner(e.target.value)} placeholder="fpedroni-extensilica" className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label>Org slug (optional)</Label>
                  <Input value={pkgOrg} onChange={(e) => setPkgOrg(e.target.value)} placeholder="org-slug" className="font-mono" />
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <Button type="submit" className="gap-2" disabled={busy}>
                    <Plus className="h-4 w-4" />
                    Create package
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-medium">
              Packages{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({pkgTotal} total)
              </span>
            </h2>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pkgSkip === 0 || busy}
                onClick={() => setPkgSkip((s) => Math.max(0, s - PAGE_SIZE))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pkgSkip + PAGE_SIZE >= pkgTotal || busy}
                onClick={() => setPkgSkip((s) => s + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                  <th className="p-3">Slug</th>
                  <th className="p-3">Name</th>
                  <th className="min-w-[140px] p-3">Maturity</th>
                  <th className="p-3">Owner</th>
                  <th className="p-3">Org</th>
                  <th className="p-3">Deprecated</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="max-w-[160px] break-all p-3 font-mono text-xs">{p.slug}</td>
                    <td className="p-3 text-xs">{p.name}</td>
                    <td className="max-w-[220px] p-3 align-top">
                      <PackageCapabilityChips
                        level={p.maturityLevel}
                        badges={p.capabilityBadges}
                        maxBadges={4}
                      />
                    </td>
                    <td className="p-3 text-xs">{p.owner ? <span className="font-mono">{p.owner.username}</span> : "—"}</td>
                    <td className="p-3 text-xs">{p.org ? <span className="font-mono">{p.org.slug}</span> : "—"}</td>
                    <td className="p-3 text-xs">{p.isDeprecated ? <Badge variant="outline">yes</Badge> : "no"}</td>
                    <td className="p-3 text-right">
                      <div className="inline-flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => beginEditPackage(p)}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="gap-2"
                          onClick={() => void deletePackage(p.slug)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {editPkgSlug && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Edit package {editPkgSlug}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input value={editPkgName} onChange={(e) => setEditPkgName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Keywords (CSV)</Label>
                    <Input className="font-mono" value={editPkgKeywords} onChange={(e) => setEditPkgKeywords(e.target.value)} placeholder="demo,spike,rv64gc" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Description</Label>
                    <Textarea value={editPkgDesc} onChange={(e) => setEditPkgDesc(e.target.value)} placeholder="Leave blank to keep unchanged" />
                  </div>
                  <div className="space-y-2">
                    <Label>Owner username</Label>
                    <Input className="font-mono" value={editPkgOwner} onChange={(e) => setEditPkgOwner(e.target.value)} placeholder="empty to clear" />
                  </div>
                  <div className="space-y-2">
                    <Label>Org slug</Label>
                    <Input className="font-mono" value={editPkgOrg} onChange={(e) => setEditPkgOrg(e.target.value)} placeholder="empty to clear" />
                  </div>
                  <div className="flex items-center gap-2 md:col-span-2">
                    <Checkbox
                      checked={editPkgDeprecated}
                      onCheckedChange={(v) => setEditPkgDeprecated(Boolean(v))}
                      id="pkg-deprecated"
                    />
                    <Label htmlFor="pkg-deprecated">Deprecated</Label>
                  </div>
                  {editPkgDeprecated && (
                    <div className="space-y-2 md:col-span-2">
                      <Label>Deprecation message</Label>
                      <Textarea value={editPkgDeprecationMessage} onChange={(e) => setEditPkgDeprecationMessage(e.target.value)} />
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setEditPkgSlug(null)}>
                    Cancel
                  </Button>
                  <Button type="button" className="gap-2" disabled={busy} onClick={() => void savePackageEdits()}>
                    <Pencil className="h-4 w-4" />
                    Save changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      )}
    </div>
  );
}
