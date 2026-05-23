"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  apiAdminApproveTokenGrant,
  apiAdminCreateManualTokenGrant,
  apiAdminListTokenGrants,
  apiAdminRejectTokenGrant,
  apiAdminUsers,
  ApiError,
  type AdminUserRow,
  type TokenGrantRow,
} from "@/lib/api";
import {
  formatGrantReference,
  formatRelativeTime,
  grantReasonLabel,
  basescanTxUrl,
} from "@/lib/xsil-grant-display";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Coins, ExternalLink, Plus, RefreshCcw, XCircle } from "lucide-react";

type Props = {
  token: string;
  onMessage: (msg: string) => void;
  onError: (msg: string) => void;
};

export function AdminTokenGrantsTab({ token, onMessage, onError }: Props) {
  const [pending, setPending] = useState<TokenGrantRow[]>([]);
  const [approved, setApproved] = useState<TokenGrantRow[]>([]);
  const [claimed, setClaimed] = useState<TokenGrantRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [manualBusy, setManualBusy] = useState(false);

  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState<AdminUserRow[]>([]);
  const [userSearchBusy, setUserSearchBusy] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);
  const [manualAmount, setManualAmount] = useState("");
  const [manualNote, setManualNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    onError("");
    try {
      const [p, a, c] = await Promise.all([
        apiAdminListTokenGrants(token, "PENDING"),
        apiAdminListTokenGrants(token, "APPROVED"),
        apiAdminListTokenGrants(token, "CLAIMED"),
      ]);
      setPending(p.grants);
      setApproved(a.grants);
      setClaimed(c.grants);
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Failed to load token grants.");
    } finally {
      setLoading(false);
    }
  }, [token, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const q = userQuery.trim().toLowerCase();
    if (q.length < 2) {
      setUserResults([]);
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        setUserSearchBusy(true);
        try {
          const { users } = await apiAdminUsers(token, { limit: 100, skip: 0 });
          setUserResults(
            users.filter(
              (u) =>
                u.username.toLowerCase().includes(q) ||
                u.email.toLowerCase().includes(q) ||
                String(u.id) === q,
            ),
          );
        } catch {
          setUserResults([]);
        } finally {
          setUserSearchBusy(false);
        }
      })();
    }, 250);
    return () => window.clearTimeout(t);
  }, [userQuery, token]);

  const showUserPicker = useMemo(
    () => userQuery.trim().length >= 2 && !selectedUser,
    [userQuery, selectedUser],
  );

  async function handleApprove(grant: TokenGrantRow) {
    setBusyId(grant.id);
    onError("");
    onMessage("");
    try {
      await apiAdminApproveTokenGrant(token, grant.id);
      onMessage(`Approved grant ${grant.id.slice(0, 8)}… for @${grant.user?.username ?? grant.userId}.`);
      await load();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Approve failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(grant: TokenGrantRow) {
    // eslint-disable-next-line no-alert
    const reason = window.prompt("Rejection reason (optional):", "");
    if (reason === null) return;
    setBusyId(grant.id);
    onError("");
    onMessage("");
    try {
      await apiAdminRejectTokenGrant(token, grant.id, reason.trim() || undefined);
      onMessage(`Rejected grant ${grant.id.slice(0, 8)}….`);
      await load();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Reject failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleManualGrant(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) {
      onError("Select a user first.");
      return;
    }
    const amount = Number.parseInt(manualAmount, 10);
    if (!Number.isInteger(amount) || amount <= 0) {
      onError("Amount must be a positive integer.");
      return;
    }
    setManualBusy(true);
    onError("");
    onMessage("");
    try {
      await apiAdminCreateManualTokenGrant(token, {
        userId: selectedUser.id,
        amount,
        reason: "ADMIN_DISCRETIONARY",
        note: manualNote.trim() || undefined,
      });
      onMessage(`Created manual grant of ${amount} XSIL for @${selectedUser.username}.`);
      setManualAmount("");
      setManualNote("");
      setSelectedUser(null);
      setUserQuery("");
      await load();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Create grant failed.");
    } finally {
      setManualBusy(false);
    }
  }

  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Coins className="h-5 w-5 text-riscv-accent" aria-hidden />
            Token grants
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Review pending XSIL accruals, approve discretionary grants, and track on-chain claims.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={loading}
          onClick={() => void load()}
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create manual grant</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={(e) => void handleManualGrant(e)}>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="grant-user-search">User</Label>
              {selectedUser ? (
                <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  <span className="font-mono font-medium">@{selectedUser.username}</span>
                  <span className="text-muted-foreground">{selectedUser.email}</span>
                  <span className="text-xs text-muted-foreground">#{selectedUser.id}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-7 text-xs"
                    onClick={() => {
                      setSelectedUser(null);
                      setUserQuery("");
                    }}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <>
                  <Input
                    id="grant-user-search"
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    placeholder="Search username or email (min 2 chars)"
                    className="font-mono"
                    autoComplete="off"
                  />
                  {showUserPicker && (
                    <ul className="max-h-40 overflow-y-auto rounded-md border bg-background text-sm">
                      {userSearchBusy ? (
                        <li className="px-3 py-2 text-muted-foreground">Searching…</li>
                      ) : userResults.length === 0 ? (
                        <li className="px-3 py-2 text-muted-foreground">No users found.</li>
                      ) : (
                        userResults.slice(0, 12).map((u) => (
                          <li key={u.id}>
                            <button
                              type="button"
                              className="flex w-full flex-wrap items-baseline gap-x-2 px-3 py-2 text-left hover:bg-muted/50"
                              onClick={() => {
                                setSelectedUser(u);
                                setUserQuery(u.username);
                                setUserResults([]);
                              }}
                            >
                              <span className="font-mono font-medium">@{u.username}</span>
                              <span className="text-xs text-muted-foreground">{u.email}</span>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="grant-reason">Reason</Label>
              <Input
                id="grant-reason"
                value="ADMIN_DISCRETIONARY"
                readOnly
                className="font-mono text-muted-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="grant-amount">Amount (XSIL)</Label>
              <Input
                id="grant-amount"
                type="number"
                min={1}
                step={1}
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
                placeholder="e.g. 500"
                className="font-mono"
                required
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="grant-note">Note</Label>
              <Textarea
                id="grant-note"
                rows={3}
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                placeholder="Why this grant was issued (stored on the grant record)."
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" className="gap-2" disabled={manualBusy || !selectedUser}>
                <Plus className="h-4 w-4" />
                Create grant
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <div className="rounded-lg border border-dashed bg-muted/20 py-12 text-center text-sm text-muted-foreground">
          Loading grants…
        </div>
      ) : (
        <>
          <GrantTable
            title={`Pending grants (${pending.length})`}
            grants={pending}
            emptyMessage="No grants awaiting review."
            busyId={busyId}
            onApprove={handleApprove}
            onReject={handleReject}
            showActions
          />

          <GrantTable
            title={`Approved (not claimed) (${approved.length})`}
            grants={approved}
            emptyMessage="No approved grants waiting for user claim."
          />

          <GrantTable
            title={`Claimed (on-chain) (${claimed.length})`}
            grants={claimed}
            emptyMessage="No on-chain claims yet."
            showTx
          />
        </>
      )}
    </section>
  );
}

function GrantTable({
  title,
  grants,
  emptyMessage,
  busyId,
  onApprove,
  onReject,
  showActions,
  showTx,
}: {
  title: string;
  grants: TokenGrantRow[];
  emptyMessage: string;
  busyId?: string | null;
  onApprove?: (g: TokenGrantRow) => void;
  onReject?: (g: TokenGrantRow) => void;
  showActions?: boolean;
  showTx?: boolean;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {grants.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                <th className="p-3">User</th>
                <th className="p-3">Action</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Reference</th>
                <th className="p-3">Date</th>
                {showTx ? <th className="p-3">Tx</th> : null}
                {showActions ? <th className="p-3 text-right">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {grants.map((g) => (
                <tr key={g.id} className="border-b last:border-0 align-top">
                  <td className="p-3 text-xs">
                    {g.user ? (
                      <Link
                        href={`/users/${encodeURIComponent(g.user.username)}`}
                        className="font-mono font-medium hover:underline"
                      >
                        @{g.user.username}
                      </Link>
                    ) : (
                      <span className="font-mono">#{g.userId}</span>
                    )}
                  </td>
                  <td className="max-w-[200px] p-3 text-xs">
                    <div className="font-mono text-[10px] text-muted-foreground">{g.reason}</div>
                    <div>{grantReasonLabel(g.reason)}</div>
                    {g.note ? (
                      <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{g.note}</p>
                    ) : null}
                  </td>
                  <td className="p-3 font-mono text-xs tabular-nums">{g.amount}</td>
                  <td className="max-w-[220px] break-all p-3 text-xs">
                    {g.referenceId.startsWith("http") ? (
                      <a
                        href={g.referenceId}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        {g.referenceId}
                      </a>
                    ) : (
                      formatGrantReference(g.referenceId)
                    )}
                  </td>
                  <td className="whitespace-nowrap p-3 text-xs text-muted-foreground">
                    {formatRelativeTime(g.createdAt)}
                    <div className="text-[10px]">{new Date(g.createdAt).toLocaleDateString()}</div>
                  </td>
                  {showTx ? (
                    <td className="p-3 text-xs">
                      {g.claimTxHash ? (
                        <a
                          href={basescanTxUrl(g.claimTxHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-primary hover:underline"
                        >
                          {g.claimTxHash.slice(0, 10)}…
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  ) : null}
                  {showActions && onApprove && onReject ? (
                    <td className="p-3 text-right">
                      <div className="inline-flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="gap-1"
                          disabled={busyId === g.id}
                          onClick={() => void onApprove(g)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Approve
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          disabled={busyId === g.id}
                          onClick={() => void onReject(g)}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
                        </Button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showActions && grants.some((g) => g.status === "PENDING") ? (
        <p className="text-xs text-muted-foreground">
          Approving moves XSIL to the user&apos;s pending claim balance. Rejected grants are not
          payable.
        </p>
      ) : null}
    </div>
  );
}
