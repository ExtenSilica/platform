"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiVerifyEmail, ApiError } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function VerifyEmailClient({ token }: { token: string }) {
  const router = useRouter();
  const { login, user, isLoading } = useAuth();
  const [status, setStatus] = useState<"working" | "ok" | "err">("working");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (isLoading) return;

    if (user?.emailVerified) {
      router.replace("/dashboard");
      return;
    }

    if (!token) {
      setStatus("err");
      setMessage("Missing verification token. Open the full link from your email.");
      return;
    }

    let alive = true;
    (async () => {
      try {
        const { token: apiToken, user: me } = await apiVerifyEmail(token);
        if (!alive) return;
        login(apiToken, me);
        setStatus("ok");
        setMessage("Email verified. Redirecting…");
        router.replace("/dashboard");
      } catch (e) {
        if (!alive) return;
        setStatus("err");
        setMessage(e instanceof ApiError ? e.message : "Verification failed.");
      }
    })();

    return () => {
      alive = false;
    };
  }, [token, login, router, user, isLoading]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm space-y-4 text-center">
          <img src="/logo.svg" alt="" className="mx-auto h-12 w-12" />
          <h1 className="text-2xl font-semibold tracking-tight">Verify email</h1>
          <p className="text-sm text-muted-foreground">Confirming your address…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-4 text-center">
        <img src="/logo.svg" alt="" className="mx-auto h-12 w-12" />
        <h1 className="text-2xl font-semibold tracking-tight">Verify email</h1>
        {status === "working" && (
          <p className="text-sm text-muted-foreground">Confirming your address…</p>
        )}
        {status === "ok" && (
          <p className="text-sm text-muted-foreground">{message}</p>
        )}
        {status === "err" && (
          <>
            <Alert variant="destructive">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
            <Link
              href="/login"
              className="inline-flex h-10 w-full items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-muted"
            >
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
