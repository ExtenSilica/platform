"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import {
  apiGetGovernanceMe,
  apiGetGovernanceClaim,
  apiPatchGovernanceAddress,
  type GovernanceMe,
  type GovernanceClaimStatus,
} from "@/lib/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

function truncateAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function TokenClaimSection() {
  const { user, token, isLoading: authLoading } = useAuth();
  const [me, setMe] = useState<GovernanceMe | null>(null);
  const [claim, setClaim] = useState<GovernanceClaimStatus | null>(null);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [addressInput, setAddressInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) {
      setMe(null);
      setClaim(null);
      return;
    }
    const [m, c] = await Promise.all([apiGetGovernanceMe(token), apiGetGovernanceClaim(token)]);
    setMe(m);
    setClaim(c);
    if (m.linkedEvmAddress) setAddressInput(m.linkedEvmAddress);
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

  async function connectBrowserProvider() {
    setError(null);
    setMessage(null);
    const eth = (
      window as unknown as {
        ethereum?: { request: (args: { method: string }) => Promise<string[]> };
      }
    ).ethereum;
    if (!eth) {
      setError("No browser Ethereum provider found. Paste a 0x address below instead.");
      return;
    }
    setBusy(true);
    try {
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      const addr = accounts[0];
      if (!addr) throw new Error("No account returned.");
      setAddressInput(addr);
      if (token) {
        await apiPatchGovernanceAddress(token, addr);
        await refresh();
        setMessage("Wallet connected.");
        setWalletModalOpen(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect provider.");
    } finally {
      setBusy(false);
    }
  }

  async function savePastedAddress() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await apiPatchGovernanceAddress(token, addressInput.trim());
      await refresh();
      setMessage("Wallet linked.");
      setWalletModalOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to link address.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnectWallet() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await apiPatchGovernanceAddress(token, null);
      setAddressInput("");
      await refresh();
      setMessage("Wallet disconnected.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to disconnect.");
    } finally {
      setBusy(false);
    }
  }

  const pending = me?.pendingPoints ?? me?.totalPoints ?? 0;
  const onChain = me?.onChainPoints ?? 0;
  const hasWallet = Boolean(me?.linkedEvmAddress);
  const hasBalance = (me?.totalPoints ?? 0) > 0;

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
            <span className="text-foreground">{truncateAddress(me!.linkedEvmAddress!)}</span>
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
              disabled={busy || pending === 0 || claim?.phase === "pending"}
              onClick={() =>
                setMessage(
                  claim?.message ??
                    "On-chain mint will be available when Aragon claim is enabled.",
                )
              }
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
            No tokens earned yet. Start by publishing a package or claiming an extension.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/search" className={cn(buttonVariants({ variant: "outline" }))}>
              Browse registry
            </Link>
            <Link href="/wizard" className={cn(buttonVariants())}>
              Publish
            </Link>
          </div>
        </div>
      )}

      {walletModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setWalletModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">Connect wallet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              For governance claim only — not for payments on ExtenSilica.
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <Button type="button" variant="outline" disabled={busy} onClick={connectBrowserProvider}>
                Use browser provider (MetaMask, etc.)
              </Button>
              <Input
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                placeholder="0x…"
                className="font-mono text-sm"
                spellCheck={false}
              />
              <Button type="button" disabled={busy || !addressInput.trim()} onClick={savePastedAddress}>
                Save address
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {message ? <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{message}</p> : null}
    </section>
  );
}
