"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiGetGovernanceMe, type GovernanceMe } from "@/lib/api";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TokenBalanceModal({ open, onOpenChange }: Props) {
  const { user, token } = useAuth();
  const [me, setMe] = useState<GovernanceMe | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setMe(null);
      return;
    }
    const data = await apiGetGovernanceMe(token);
    setMe(data);
  }, [token]);

  useEffect(() => {
    if (!open) return;
    if (!user || !token) {
      setMe(null);
      return;
    }
    setError(null);
    load().catch((e) => setError(e instanceof Error ? e.message : "Failed to load balance"));
  }, [open, user, token, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="xsil-balance-title"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="relative w-full max-w-md rounded-lg border bg-background p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted"
          aria-label="Close"
          onClick={() => onOpenChange(false)}
        >
          <X className="h-4 w-4" />
        </button>
        <h2 id="xsil-balance-title" className="text-lg font-semibold">
          Your XSIL balance
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Off-chain contribution points earned on ExtenSilica. Not a payment balance.
        </p>
        {!user ? (
          <div className="mt-6 space-y-4 text-center">
            <p className="text-sm text-muted-foreground">Sign in to view your earned XSIL.</p>
            <Link href="/login" className={cn(buttonVariants())}>
              Sign in
            </Link>
          </div>
        ) : error ? (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        ) : (
          <div className="mt-6 space-y-4">
            <p className="font-mono text-4xl font-bold tabular-nums text-riscv-accent">
              {me?.totalPoints ?? "…"}
              <span className="ml-2 text-base font-normal text-muted-foreground">XSIL</span>
            </p>
            {me && me.pendingPoints > 0 ? (
              <p className="text-sm text-muted-foreground">
                {me.pendingPoints} XSIL pending on-chain claim
                {me.linkedEvmAddress ? "" : " — connect a wallet below to claim when available"}.
              </p>
            ) : null}
            {me?.recentLedger && me.recentLedger.length > 0 ? (
              <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                {me.recentLedger.map((row) => (
                  <li key={row.id} className="flex justify-between gap-2">
                    <span className="truncate">{row.referenceKey}</span>
                    <span className="shrink-0 font-mono text-foreground">+{row.points}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No accruals yet. Publish or claim to earn XSIL.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
