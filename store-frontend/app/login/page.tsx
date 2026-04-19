"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiLogin, apiOAuthExchange, ApiError } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { OauthEntryBlock } from "@/components/oauth-entry-buttons";
import { oauthCallbackErrorMessage } from "@/lib/oauth-callback-messages";

export default function LoginPage() {
  const { user, login, isLoading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [oauthFinishing, setOauthFinishing] = useState(false);

  useEffect(() => {
    if (!isLoading && user) router.replace("/dashboard");
  }, [user, isLoading, router]);

  useEffect(() => {
    if (typeof window === "undefined" || isLoading || user) return;

    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("oauth_error");
    if (oauthError) {
      setError(oauthCallbackErrorMessage(oauthError));
      window.history.replaceState({}, "", "/login");
      return;
    }

    const oauthCode = params.get("oauth_code")?.trim();
    if (!oauthCode) return;

    const ac = new AbortController();
    setOauthFinishing(true);
    setError("");
    (async () => {
      try {
        const { token, user: me } = await apiOAuthExchange(oauthCode, { signal: ac.signal });
        window.history.replaceState({}, "", "/login");
        login(token, me);
        router.replace("/dashboard");
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError("OAuth sign-in could not be completed. The link may have expired; try again.");
        window.history.replaceState({}, "", "/login");
      } finally {
        setOauthFinishing(false);
      }
    })();

    return () => ac.abort();
  }, [isLoading, user, login, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { token, user: me } = await apiLogin(email.trim(), password);
      login(token, me);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) return null;

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src="/logo.svg" alt="ExtenSilica" className="mx-auto mb-3 h-12 w-12" />
          <h1 className="text-2xl font-bold">Sign in to ExtenSilica</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The public registry for{" "}
            <code className="font-mono text-xs">.xsil</code> packages
          </p>
        </div>

        <div className="rounded-xl border bg-background p-8 shadow-sm">
          {oauthFinishing && (
            <Alert className="mb-5 border-border bg-muted/40">
              <AlertDescription>Completing sign-in…</AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive" className="mb-5">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Email" htmlFor="email" required>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={oauthFinishing}
              />
            </Field>

            <Field label="Password" htmlFor="password" required>
              <div className="space-y-1">
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={oauthFinishing}
                />
                <div className="text-right">
                  <Link
                    href="/forgot-password"
                    className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
              </div>
            </Field>

            <Button type="submit" className="w-full" disabled={submitting || oauthFinishing}>
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <OauthEntryBlock className="mt-6" />

          <div className="mt-6 border-t pt-5">
            <p className="text-center text-sm text-muted-foreground">
              CLI users can also authenticate with:
            </p>
            <div className="mt-2 rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs text-muted-foreground">
              xsil login
            </div>
          </div>
        </div>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Create one free
          </Link>
        </p>
      </div>
    </div>
  );
}
