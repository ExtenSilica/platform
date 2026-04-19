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
import {
  AuthMethodDivider,
  OauthProviderLinks,
} from "@/components/oauth-entry-buttons";
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
      setError(
        "Username must start with a letter and contain only lowercase letters, digits, hyphens, and underscores (2–64 chars)."
      );
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
          <h1 className="text-2xl font-semibold tracking-tight">Register</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            GitHub or Google provisions an account in one step. Use email only if you want a
            password for <code className="font-mono text-xs">xsil login</code> or local tooling.
          </p>
        </div>

        <div className="rounded-lg border bg-background p-8 shadow-sm">
          {error && (
            <Alert variant="destructive" className="mb-5">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <OauthProviderLinks />

          <AuthMethodDivider className="my-1">or register with email</AuthMethodDivider>

          <p className="mb-4 text-xs text-muted-foreground">
            Email path: you choose username and password. Same registry API token model as OAuth.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field
              label="Username"
              htmlFor="username"
              required
              hint="Lowercase, digits, hyphens, underscores. Shown in URLs."
              error={
                username && !usernameValid ? "Invalid username format." : undefined
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

          <p className="mt-6 text-center text-xs text-muted-foreground">
            By registering you accept the{" "}
            <Link href="/legal/terms" className="underline underline-offset-2 hover:text-foreground">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy" className="underline underline-offset-2 hover:text-foreground">
              Privacy
            </Link>
            .
          </p>
        </div>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Already registered?{" "}
          <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
