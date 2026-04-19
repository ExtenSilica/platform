"use client";

import { useState } from "react";
import Link from "next/link";
import { apiForgotPassword, ApiError } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MailCheck } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await apiForgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Request failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 text-center">
          <img src="/logo.svg" alt="ExtenSilica" className="mx-auto mb-3 h-12 w-12" />
          <h1 className="text-2xl font-bold">Forgot your password?</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        <div className="rounded-xl border bg-background p-8 shadow-sm">
          {sent ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <MailCheck className="h-10 w-10 text-green-500" />
              <p className="font-medium">Check your inbox</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                If <strong>{email}</strong> is registered, a reset link has been
                sent. It expires in&nbsp;1&nbsp;hour.
              </p>
              <p className="text-xs text-muted-foreground">
                Don&apos;t see it? Check your spam folder.
              </p>
            </div>
          ) : (
            <>
              {error && (
                <Alert variant="destructive" className="mb-5">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <Field label="Email address" htmlFor="email" required>
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

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Sending…" : "Send reset link"}
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
