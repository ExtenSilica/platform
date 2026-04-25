"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiLogin, apiResendVerification, ApiError, EMAIL_NOT_VERIFIED_CODE } from "@/lib/api";
import {
  setPostLoginRedirect,
  consumePostLoginRedirect,
} from "@/lib/post-login-redirect";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AuthMethodDivider,
  OauthProviderLinks,
} from "@/components/oauth-entry-buttons";

export default function LoginPage() {
  const { user, login, isLoading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [showResend, setShowResend] = useState(false);

  useEffect(() => {
    if (!isLoading && user) router.replace("/dashboard");
  }, [user, isLoading, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    if (next) {
      setPostLoginRedirect(next);
      window.history.replaceState({}, "", "/login");
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setShowResend(false);
    setSubmitting(true);
    try {
      const { token, user: me } = await apiLogin(email.trim(), password);
      login(token, me);
      router.push(consumePostLoginRedirect());
    } catch (err) {
      if (err instanceof ApiError && err.code === EMAIL_NOT_VERIFIED_CODE) {
        setError(err.message);
        setShowResend(true);
      } else {
        setError(err instanceof ApiError ? err.message : "Login failed.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendVerification() {
    if (!email.trim()) return;
    setResendBusy(true);
    setInfo("");
    try {
      const r = await apiResendVerification(email.trim());
      setInfo(r.message);
    } catch {
      setInfo("If that address has an unverified account, a new verification email was sent.");
    } finally {
      setResendBusy(false);
    }
  }

  if (isLoading) return null;

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src="/logo.svg" alt="ExtenSilica" className="mx-auto mb-3 h-12 w-12" />
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Registry for <code className="font-mono text-xs">.xsil</code> packages. GitHub and
            Google are optional; email and password stay supported.
          </p>
        </div>

        <div className="rounded-lg border bg-background p-8 shadow-sm">
          {error && (
            <Alert variant="destructive" className="mb-5">
              <AlertDescription className="space-y-2">
                <span className="block">{error}</span>
                {showResend && (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resendBusy}
                    className="text-sm font-medium underline underline-offset-2 hover:no-underline"
                  >
                    {resendBusy ? "Sending…" : "Resend verification email"}
                  </button>
                )}
              </AlertDescription>
            </Alert>
          )}
          {info && (
            <Alert className="mb-5 border-primary/30 bg-primary/5">
              <AlertDescription>{info}</AlertDescription>
            </Alert>
          )}

          <OauthProviderLinks />

          <AuthMethodDivider className="my-1">or continue with email</AuthMethodDivider>

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

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 border-t pt-4 text-center text-xs leading-relaxed text-muted-foreground">
            CLI: use{" "}
            <code className="rounded border bg-muted/50 px-1.5 py-0.5 font-mono text-[11px] text-foreground">
              xsil login
            </code>{" "}
            with the same Bearer token—no browser OAuth required.
          </p>
        </div>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link href="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
