"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TokenBalanceModal } from "@/components/token/token-balance-modal";

export function TokenHeroActions() {
  const { user } = useAuth();
  const [balanceOpen, setBalanceOpen] = useState(false);

  function onViewBalance() {
    if (!user) {
      window.location.href = "/login";
      return;
    }
    setBalanceOpen(true);
  }

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Button type="button" size="lg" onClick={onViewBalance}>
          View your balance
        </Button>
        <Link href="#tokenomics" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
          Read documentation
        </Link>
      </div>
      <TokenBalanceModal open={balanceOpen} onOpenChange={setBalanceOpen} />
    </>
  );
}
