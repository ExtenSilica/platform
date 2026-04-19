"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { oauthCallbackErrorMessage } from "@/lib/oauth-callback-messages";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function ErrorFallback() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  );
}

function AuthOAuthErrorInner() {
  const searchParams = useSearchParams();
  const code = searchParams.get("oauth_error")?.trim() ?? "";
  const description =
    code.length > 0
      ? oauthCallbackErrorMessage(code)
      : "Sign-in could not be completed. Try again or use email and password.";

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-background p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-xl font-semibold">Sign-in issue</h1>
          <p className="mt-1 text-sm text-muted-foreground">OAuth did not finish successfully.</p>
        </div>
        <Alert variant="destructive">
          <AlertDescription>{description}</AlertDescription>
        </Alert>
        <div className="flex flex-col gap-2">
          <Link href="/login" className={cn(buttonVariants(), "w-full")}>
            Back to sign in
          </Link>
          <Link
            href="/register"
            className={cn(buttonVariants({ variant: "outline" }), "w-full")}
          >
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AuthOAuthErrorPage() {
  return (
    <Suspense fallback={<ErrorFallback />}>
      <AuthOAuthErrorInner />
    </Suspense>
  );
}
