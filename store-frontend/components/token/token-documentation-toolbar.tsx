"use client";

import Link from "next/link";
import { Printer } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function TokenDocumentationToolbar() {
  return (
    <div className="no-print mb-8 flex flex-wrap items-center gap-3 border-b pb-6">
      <Link href="/token" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
        ← Back to token page
      </Link>
      <button
        type="button"
        className={cn(buttonVariants({ variant: "default", size: "sm" }), "gap-2")}
        onClick={() => window.print()}
      >
        <Printer className="h-4 w-4" aria-hidden />
        Save as PDF / Print
      </button>
      <p className="w-full text-xs text-muted-foreground sm:w-auto sm:ml-auto">
        Use your browser&apos;s print dialog and choose &quot;Save as PDF&quot;.
      </p>
    </div>
  );
}
