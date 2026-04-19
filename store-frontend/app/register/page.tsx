"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiRegister, ApiError } from "@/lib/api";
import {
  setPostLoginRedirect,
  consumePostLoginRedirect,
} from "@/lib/post-login-redirect";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { OauthEntryBlock } from "@/components/oauth-entry-buttons";
import { Check } from "lucide-react";

const USERNAME_RE = /^[a-z][a-z0-9_-]{1,63}$/;

export default function RegisterPage() {
  const { user, login, isLoading } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && user) router.replace("/dashboard");
  }, [user, isLoading, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    if (next) {
      setPostLoginRedirect(next);
      window.history.replaceState({}, "", "/register");
    }
  }, []);

  const usernameValid = USERNAME_RE.test(username);
  const passwordStrong = password.length >= 8;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!usernameValid) {
      setError("Username must start with a letter and contain only lowercase letters, digits, hyphens, and underscores (2–64 chars).");
      return;
    }
    if (!passwordStrong) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const { token, user: me } = await apiRegister(
        username.trim(),
        email.trim(),
        password
      );
      login(token, me);
      router.push(consumePostLoginRedirect());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed.");
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
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Free and open. No credit card required.
          </p>
        </div>

        <div className="rounded-xl border bg-background p-8 shadow-sm">
          {error && (
            <Alert variant="destructive" className="mb-5">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field
              label="Username"
              htmlFor="username"
              required
              hint="Lowercase letters, digits, hyphens, underscores. Used in your profile URL."
              error={
                username && !usernameValid
                  ? "Invalid username format."
                  : undefined
              }
            >
              <div className="relative">
                <Input
                  id="username"
                  type="text"
                  placeholder="alice"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  required
                  className={username && usernameValid ? "pr-9" : ""}
                />
                {username && usernameValid && (
                  <Check className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                )}
              </div>
            </Field>

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

            <Field
              label="Password"
              htmlFor="password"
              required
              hint="Minimum 8 characters."
              error={
                password && !passwordStrong
                  ? "Password must be at least 8 characters."
                  : undefined
              }
            >
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Creating account…" : "Create account"}
            </Button>
          </form>

          <OauthEntryBlock className="mt-6" />

          <p className="mt-6 text-center text-xs text-muted-foreground">
            By registering, you agree to the{" "}
            <Link href="/legal/terms" className="underline hover:text-foreground">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy" className="underline hover:text-foreground">
              Privacy Policy
            </Link>
            .
          </p>
        </div>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
