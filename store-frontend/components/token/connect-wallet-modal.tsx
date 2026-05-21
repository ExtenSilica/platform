"use client";

import { useCallback, useEffect, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSignMessage } from "wagmi";
import { X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  apiGetWalletMessage,
  apiPostWallet,
  type WalletLinkResult,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLinked?: (result: WalletLinkResult) => void;
};

export function ConnectWalletModal({ open, onOpenChange, onLinked }: Props) {
  const { token } = useAuth();
  const { address, isConnected } = useAccount();
  const { signMessageAsync, isPending: signing } = useSignMessage();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"connect" | "sign">("connect");

  const reset = useCallback(() => {
    setError(null);
    setBusy(false);
    setStep("connect");
  }, []);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    setStep(isConnected && address ? "sign" : "connect");
  }, [open, isConnected, address, reset]);

  async function verifyAndLink() {
    if (!token || !address) return;
    setBusy(true);
    setError(null);
    try {
      const { message } = await apiGetWalletMessage(token, address);
      const signature = await signMessageAsync({ message });
      const result = await apiPostWallet(token, {
        address,
        message,
        signature,
      });
      onLinked?.(result);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to verify wallet.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="connect-wallet-title"
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

        <h2 id="connect-wallet-title" className="text-lg font-semibold pr-8">
          Connect your wallet to claim XSIL tokens
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your earned tokens will be linked to your connected wallet for future on-chain claim.
        </p>

        <div className="mt-6 flex flex-col items-stretch gap-3">
          {step === "connect" ? (
            <ConnectButton.Custom>
              {({ openConnectModal, mounted }) => {
                if (!mounted) return null;
                return (
                  <Button type="button" className="w-full" onClick={openConnectModal}>
                    Connect Wallet
                  </Button>
                );
              }}
            </ConnectButton.Custom>
          ) : (
            <>
              <p className="text-center font-mono text-sm text-muted-foreground">{address}</p>
              <Button
                type="button"
                className="w-full"
                disabled={busy || signing || !token}
                onClick={() => void verifyAndLink()}
              >
                {busy || signing ? "Signing…" : "Sign to verify ownership"}
              </Button>
            </>
          )}
        </div>

        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          Signing is free — no gas required. This only verifies wallet ownership. No transaction is
          submitted.
        </p>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    </div>
  );
}
