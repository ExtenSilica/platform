"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Coins, ExternalLink, Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  apiGetTokenBalance,
  apiPostTokenClaim,
  type TokenBalanceResponse,
  ApiError,
} from "@/lib/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  basescanAddressUrl,
  formatGrantReference,
  formatRelativeTime,
  grantReasonLabel,
} from "@/lib/xsil-grant-display";
import { ConnectWalletModal } from "@/components/token/connect-wallet-modal";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { XsilDisclaimerNotice } from "@/components/xsil-disclaimer-notice";

export function DashboardXsilPanel() {
  const { token } = useAuth();
  const [data, setData] = useState<TokenBalanceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setData(null);
      return;
    }
    setError(null);
    try {
      const bal = await apiGetTokenBalance(token);
      setData(bal);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load XSIL balance.");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleClaim() {
    if (!token) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await apiPostTokenClaim(token);
      setMessage(`Claimed ${result.amount} XSIL on-chain.`);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Claim failed.");
    } finally {
      setBusy(false);
    }
  }

  const pending = data?.pendingXsil ?? 0;
  const claimed = data?.claimedXsil ?? 0;
  const earned = data?.totalEarned ?? 0;
  const wallet = data?.walletAddress ?? null;

  const recent = (data?.recentGrants ?? []).filter(
    (g) => g.status === "APPROVED" || g.status === "CLAIMED" || g.status === "PENDING",
  );

  return (
    <div className="mb-8 rounded-xl border bg-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <Coins className="h-5 w-5 text-riscv-accent" aria-hidden />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Contribution tokens
        </h2>
      </div>

      <XsilDisclaimerNotice variant="box" className="mb-4" />
      <p className="mb-4 text-xs text-muted-foreground">
        <Link href="/token" className="text-primary underline">
          XSIL token documentation
        </Link>
      </p>

      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-md border bg-muted/30 px-4 py-3">
          <dt className="text-muted-foreground">Earned (total)</dt>
          <dd className="font-mono text-xl font-semibold tabular-nums text-riscv-accent">
            {earned} XSIL
          </dd>
        </div>
        <div className="rounded-md border bg-muted/30 px-4 py-3">
          <dt className="text-muted-foreground">Claimed (on-chain)</dt>
          <dd className="font-mono text-xl font-semibold tabular-nums">{claimed} XSIL</dd>
        </div>
        <div className="rounded-md border bg-muted/30 px-4 py-3">
          <dt className="text-muted-foreground">Pending claim</dt>
          <dd className="font-mono text-xl font-semibold tabular-nums">{pending} XSIL</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-3">
        {!wallet ? (
          <Button type="button" className="gap-2" onClick={() => setWalletOpen(true)}>
            <Wallet className="h-4 w-4" />
            Connect wallet to claim
          </Button>
        ) : pending > 0 ? (
          <Button type="button" disabled={busy} onClick={() => void handleClaim()}>
            Claim {pending} XSIL
          </Button>
        ) : null}
        {wallet && claimed > 0 ? (
          <a
            href={basescanAddressUrl(wallet)}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
          >
            View on Basescan
            <ExternalLink className="h-4 w-4" />
          </a>
        ) : null}
        {wallet ? (
          <p className="w-full font-mono text-xs text-muted-foreground sm:w-auto sm:ml-auto">
            {wallet.slice(0, 6)}…{wallet.slice(-4)}
          </p>
        ) : null}
      </div>

      {recent.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Recent activity
          </h3>
          <ul className="mt-3 space-y-2 text-sm">
            {recent.slice(0, 8).map((g) => (
              <li key={g.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-mono font-semibold text-riscv-accent">+{g.amount}</span>
                <span className="text-foreground">{grantReasonLabel(g.reason)}</span>
                <span className="text-muted-foreground">· {formatGrantReference(g.referenceId)}</span>
                <span className="text-xs text-muted-foreground">· {formatRelativeTime(g.createdAt)}</span>
                {g.status === "PENDING" ? (
                  <span className="text-xs text-amber-600 dark:text-amber-400">(pending review)</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          No grants yet. Verified package or registry contributions may earn XSIL after review.
        </p>
      )}

      {error ? (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {message ? <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{message}</p> : null}

      <ConnectWalletModal
        open={walletOpen}
        onOpenChange={setWalletOpen}
        onLinked={() => void load()}
      />
    </div>
  );
}
