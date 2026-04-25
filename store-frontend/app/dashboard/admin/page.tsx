"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  apiAdminHealth,
  apiAdminUsers,
  apiAdminPackages,
  apiAdminSetPackageOwner,
  apiAdminVerifyUserEmail,
  ApiError,
  type AdminHealthResponse,
  type AdminUserRow,
  type AdminPackageRow,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, RefreshCcw, Shield } from "lucide-react";

const PAGE_SIZE = 50;

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
  const [ownerEdits, setOwnerEdits] = useState<Record<string, string>>({});
  const [actionMsg, setActionMsg] = useState("");

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

  async function saveOwner(slug: string) {
    if (!token) return;
    const raw = ownerEdits[slug] ?? "";
    const ownerUsername = raw.trim() === "" ? null : raw.trim().toLowerCase();
    setError("");
    setActionMsg("");
    try {
      await apiAdminSetPackageOwner(token, slug, ownerUsername);
      setActionMsg(`Updated owner for ${slug}.`);
      setOwnerEdits((prev) => {
        const next = { ...prev };
        delete next[slug];
        return next;
      });
      await loadAll();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Owner update failed.");
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

      <section className="mb-10 space-y-3">
        <h2 className="text-lg font-medium">Health</h2>
        {health ? (
          <pre className="max-h-64 overflow-auto rounded-lg border bg-muted/40 p-4 font-mono text-xs leading-relaxed">
            {JSON.stringify(health, null, 2)}
          </pre>
        ) : (
          <p className="text-sm text-muted-foreground">No data yet.</p>
        )}
      </section>

      <section className="mb-10 space-y-3">
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
                  <td className="max-w-[200px] truncate p-3 text-xs">{u.email}</td>
                  <td className="p-3 text-xs">{u.emailVerified ? "yes" : "no"}</td>
                  <td className="p-3 text-xs">
                    {u.hasActiveToken ? "active" : "—"}
                  </td>
                  <td className="p-3 text-right">
                    {!u.emailVerified && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => void verifyUser(u.id)}
                      >
                        Verify email
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
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
                <th className="p-3">Owner</th>
                <th className="min-w-[200px] p-3">Set owner (username)</th>
                <th className="p-3 text-right">Save</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="max-w-[140px] break-all p-3 font-mono text-xs">
                    {p.slug}
                  </td>
                  <td className="p-3 text-xs">{p.name}</td>
                  <td className="p-3 text-xs">
                    {p.owner ? (
                      <span className="font-mono">{p.owner.username}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-3">
                    <Input
                      className="h-8 font-mono text-xs"
                      placeholder="username or empty to clear"
                      value={ownerEdits[p.slug] ?? ""}
                      onChange={(e) =>
                        setOwnerEdits((prev) => ({
                          ...prev,
                          [p.slug]: e.target.value,
                        }))
                      }
                    />
                  </td>
                  <td className="p-3 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => void saveOwner(p.slug)}
                    >
                      Save
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
