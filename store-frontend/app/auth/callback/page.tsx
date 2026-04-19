"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiOAuthExchange, apiFetchMe } from "@/lib/api";
import { consumePostLoginRedirect } from "@/lib/post-login-redirect";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function CallbackFallback() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <p className="text-sm text-muted-foreground">Completing sign-in…</p>
    </div>
  );
}

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isLoading, user } = useAuth();
  const oauthCode = useMemo(
    () => searchParams.get("oauth_code")?.trim() ?? "",
    [searchParams]
  );
  const [message, setMessage] = useState<string | null>(null);
  const [fatal, setFatal] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (user) {
      router.replace("/dashboard");
      return;
    }

    if (!oauthCode) {
      setMessage("Missing sign-in code. Start again from the login page.");
      setFatal(true);
      return;
    }

    const ac = new AbortController();
    (async () => {
      try {
        const { token } = await apiOAuthExchange(oauthCode, { signal: ac.signal });
        const me = await apiFetchMe(token, { signal: ac.signal });
        if (!me) {
          setMessage("Could not verify your session. Please sign in again.");
          setFatal(true);
          return;
        }
        login(token, me);
        router.replace(consumePostLoginRedirect());
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setMessage(
          "OAuth sign-in could not be completed. The link may have expired; try again from the login page."
        );
        setFatal(true);
      }
    })();

    return () => ac.abort();
  }, [oauthCode, isLoading, user, login, router]);

  if (isLoading) return <CallbackFallback />;

  if (fatal && message) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm space-y-4 rounded-xl border bg-background p-8 shadow-sm">
          <Alert variant="destructive">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
          <Link href="/login" className={cn(buttonVariants(), "w-full")}>
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <p className="text-sm text-muted-foreground">Completing sign-in…</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<CallbackFallback />}>
      <AuthCallbackInner />
    </Suspense>
  );
}
