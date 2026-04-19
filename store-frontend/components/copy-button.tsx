"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface CopyButtonProps {
  text: string;
  className?: string;
}

export function CopyButton({ text, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // fallback: ignore
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copy to clipboard"
      className={`shrink-0 rounded border border-transparent p-1 text-muted-foreground transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-riscv-accent/35 hover:bg-riscv-accent/[0.06] hover:text-riscv-accent hover:shadow-sm ${className ?? ""}`}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
