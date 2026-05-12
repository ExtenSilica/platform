"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  apiListMyTokens,
  apiCreateMyToken,
  apiRevokeMyToken,
  ApiError,
  type ApiTokenRow,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Copy,
  KeyRound,
  Plus,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "—";
  const diffMs = Date.now() - then;
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} d ago`;
  const mon = Math.round(day / 30);
  if (mon < 12) return `${mon} mo ago`;
  const yr = Math.round(mon / 12);
  return `${yr} y ago`;
}

export default function TokensPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  const [tokens, setTokens] = useState<ApiTokenRow[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Create-form state
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  // Once-only display of a freshly minted raw token. Cleared when the user
  // confirms they've copied it (or navigates away).
  const [revealedToken, setRevealedToken] = useState<{ name: string; raw: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Pending revoke (so we can show a confirmation step in-line).
  const [confirmRevokeId, setConfirmRevokeId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const rows = await apiListMyTokens(token);
      setTokens(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tokens.");
    } finally {
      setBusy(false);
    }
  }, [token]);

  useEffect(() => {
    if (isLoading) return;
    if (!user || !token) {
      router.replace("/login?redirect=/dashboard/tokens");
      return;
    }
    void refresh();
  }, [isLoading, user, token, router, refresh]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    const name = newName.trim();
    if (!name) {
      setError("Give the token a recognisable name (e.g. 'xsil-cli @ laptop').");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const result = await apiCreateMyToken(token, name);
      setRevealedToken({ name: result.apiToken.name, raw: result.token });
      setNewName("");
      setCopied(false);
      await refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || `Failed to create token (${err.status}).`);
      } else {
        setError(err instanceof Error ? err.message : "Failed to create token.");
      }
    } finally {
      setCreating(false);
    }
  }

  async function onRevoke(id: number) {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      await apiRevokeMyToken(token, id);
      setConfirmRevokeId(null);
      await refresh();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // We just revoked our own session. Bounce to /login cleanly.
        router.replace("/login?revoked=1");
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to revoke token.");
    } finally {
      setBusy(false);
    }
  }

  async function copyRawToken() {
    if (!revealedToken) return;
    try {
      await navigator.clipboard.writeText(revealedToken.raw);
      setCopied(true);
    } catch {
      // navigator.clipboard may be unavailable on http:// — the textarea below
      // still lets the user select + copy manually.
      setCopied(false);
    }
  }

  if (isLoading || !user || !token) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const liveTokens = tokens?.filter((t) => t.revokedAt === null) ?? [];
  const revokedTokens = tokens?.filter((t) => t.revokedAt !== null) ?? [];

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <KeyRound className="h-6 w-6" />
          API tokens
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          One credential per device, CLI install, or bot. Each token is named so
          you remember what uses it, and revoking one does not affect the
          others. Tokens are sensitive — the registry only stores their hash, so
          you can only see the raw value at the moment of creation.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {revealedToken && (
        <Card className="mb-6 border-green-500/40 bg-green-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-5 w-5 text-green-600" />
              Token <span className="font-mono">&quot;{revealedToken.name}&quot;</span> created
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              <strong>Copy it now.</strong> This value is shown only once — if
              you lose it, revoke this token and create a new one.
            </p>
            <div className="flex items-stretch gap-2">
              <Input
                readOnly
                value={revealedToken.raw}
                className="font-mono text-xs"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button
                type="button"
                variant="outline"
                onClick={copyRawToken}
                className="shrink-0 gap-2"
              >
                <Copy className="h-4 w-4" />
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <div className="rounded-md bg-muted/40 p-3 font-mono text-xs">
              <p className="mb-1 text-muted-foreground">Use it with the CLI:</p>
              <pre className="overflow-x-auto">
{`xsil config set-token ${revealedToken.raw}`}
              </pre>
            </div>
            <div className="flex justify-end pt-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setRevealedToken(null);
                  setCopied(false);
                }}
              >
                I&apos;ve saved it — dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-5 w-5" />
            Create a new token
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="space-y-3">
            <div>
              <Label htmlFor="token-name">Token name</Label>
              <Input
                id="token-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="xsil-cli @ felipe-precision"
                maxLength={80}
                disabled={creating}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Pick something descriptive — that&apos;s how you&apos;ll
                recognise this token later. 1–80 characters.
              </p>
            </div>
            <Button type="submit" disabled={creating || !newName.trim()} className="gap-2">
              <Plus className="h-4 w-4" />
              {creating ? "Creating…" : "Create token"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            Active tokens
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({liveTokens.length})
            </span>
          </CardTitle>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void refresh()}
            disabled={busy}
            className="gap-2"
          >
            <RefreshCcw className={busy ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {tokens === null ? (
            <p className="text-sm text-muted-foreground">Loading tokens…</p>
          ) : liveTokens.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active tokens. Create one above to grant a device or CLI
              install access to your account.
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {liveTokens.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{t.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      created {formatDateTime(t.createdAt)} · last used{" "}
                      <span title={formatDateTime(t.lastUsedAt)}>{relativeTime(t.lastUsedAt)}</span>
                    </p>
                  </div>
                  <Badge variant="outline" className="border-green-500/40 text-green-700 dark:text-green-400">
                    active
                  </Badge>
                  {confirmRevokeId === t.id ? (
                    <div className="flex w-full items-center gap-2 rounded-md border border-red-500/40 bg-red-500/5 p-2 sm:w-auto">
                      <ShieldAlert className="h-4 w-4 shrink-0 text-red-600" />
                      <span className="text-xs">
                        Revoke this token? If it&apos;s your current session,
                        you&apos;ll be signed out.
                      </span>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busy}
                        onClick={() => void onRevoke(t.id)}
                      >
                        Revoke
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => setConfirmRevokeId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2 text-red-700 hover:bg-red-500/10 dark:text-red-400"
                      onClick={() => setConfirmRevokeId(t.id)}
                      disabled={busy}
                    >
                      <Trash2 className="h-4 w-4" />
                      Revoke
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {revokedTokens.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">
              Revoked tokens
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({revokedTokens.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y rounded-md border opacity-70">
              {revokedTokens.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{t.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      revoked {formatDateTime(t.revokedAt)} · created{" "}
                      {formatDateTime(t.createdAt)}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-muted-foreground">
                    revoked
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
