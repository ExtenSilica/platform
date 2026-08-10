"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import {
  apiGetTokenBalance,
  apiGetGovernanceClaim,
  apiDeleteWallet,
  apiPostTokenClaim,
  type TokenBalanceResponse,
  type GovernanceClaimStatus,
} from "@/lib/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConnectWalletModal } from "@/components/token/connect-wallet-modal";
import { XsilDisclaimerNotice } from "@/components/xsil-disclaimer-notice";

function truncateAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function TokenClaimSection() {
  const { user, token, isLoading: authLoading } = useAuth();
  const [me, setMe] = useState<TokenBalanceResponse | null>(null);
  const [claim, setClaim] = useState<GovernanceClaimStatus | null>(null);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) {
      setMe(null);
      setClaim(null);
      return;
    }
    const [m, c] = await Promise.all([apiGetTokenBalance(token), apiGetGovernanceClaim(token)]);
    setMe(m);
    setClaim(c);
  }, [token]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !token) {
      setMe(null);
      setClaim(null);
      return;
    }
    refresh().catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [authLoading, user, token, refresh]);

  async function disconnectWallet() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await apiDeleteWallet(token);
      await refresh();
      setMessage("Wallet disconnected.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to disconnect.");
    } finally {
      setBusy(false);
    }
  }

  const pending = me?.pendingXsil ?? 0;
  const onChain = me?.claimedXsil ?? 0;
  const hasWallet = Boolean(me?.walletAddress);
  const hasBalance = pending + onChain > 0;

  async function claimTokens() {
    if (!token) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await apiPostTokenClaim(token);
      setMessage(`Claim submitted (${result.amount} XSIL). Tx: ${result.txHash.slice(0, 14)}…`);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Claim failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="claim" className="scroll-mt-24 rounded-lg border bg-card p-6 md:p-8">
      <h2 className="text-2xl font-semibold tracking-tight">
        Connect your wallet to claim earned tokens
      </h2>

      {!user ? (
        <div className="mt-6 space-y-4">
          <p className="text-muted-foreground">Sign in to see your earned XSIL balance.</p>
          <Link href="/login" className={cn(buttonVariants())}>
            Sign in
          </Link>
        </div>
      ) : hasWallet ? (
        <div className="mt-6 space-y-4">
          <p className="font-mono text-sm">
            Wallet:{" "}
            <span className="text-foreground">{truncateAddress(me!.walletAddress!)}</span>
          </p>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-md border bg-muted/30 px-4 py-3">
              <dt className="text-muted-foreground">On-chain balance</dt>
              <dd className="font-mono text-xl font-semibold tabular-nums text-riscv-accent">
                {onChain} XSIL
              </dd>
            </div>
            <div className="rounded-md border bg-muted/30 px-4 py-3">
              <dt className="text-muted-foreground">Pending (not claimed)</dt>
              <dd className="font-mono text-xl font-semibold tabular-nums text-riscv-accent">
                {pending} XSIL
              </dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              disabled={busy || pending === 0}
              onClick={() => void claimTokens()}
            >
              Claim pending tokens
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={disconnectWallet}>
              Disconnect wallet
            </Button>
          </div>
          {claim ? (
            <p className="text-xs text-muted-foreground">{claim.message}</p>
          ) : null}
        </div>
      ) : hasBalance ? (
        <div className="mt-6 space-y-4">
          <p className="text-muted-foreground">
            You have <span className="font-mono font-semibold text-foreground">{pending}</span> XSIL
            tokens waiting to be claimed.
          </p>
          <Button type="button" onClick={() => setWalletModalOpen(true)}>
            Connect Wallet
          </Button>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <p className="text-muted-foreground">
            No tokens earned yet. Contribute verified engineering work to an extension package or
            to the registry itself.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/search" className={cn(buttonVariants({ variant: "outline" }))}>
              Browse registry
            </Link>
            <Link href="/contributing" className={cn(buttonVariants())}>
              Contributing guide
            </Link>
          </div>
        </div>
      )}

      <ConnectWalletModal
        open={walletModalOpen}
        onOpenChange={setWalletModalOpen}
        onLinked={() => {
          setMessage("Wallet connected and verified.");
          void refresh();
        }}
      />

      {error ? (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {message ? <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{message}</p> : null}

      <XsilDisclaimerNotice variant="box" className="mt-6" title="Before you claim" />
    </section>
  );
}
