"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { apiResetPassword, ApiError } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Terminal, CheckCircle2, AlertTriangle } from "lucide-react";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) setError("No reset token found. Please request a new link.");
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await apiResetPassword(token, newPassword);
      setDone(true);
      // Redirect to login after a short pause.
      setTimeout(() => router.push("/login"), 3000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Reset failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-56px)] items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full border bg-muted">
            <Terminal className="h-5 w-5 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Set a new password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a password you&apos;ll remember.
          </p>
        </div>

        <div className="rounded-xl border bg-background p-8 shadow-sm">
          {done ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <p className="font-medium">Password updated!</p>
              <p className="text-sm text-muted-foreground">
                Redirecting you to the sign-in page…
              </p>
            </div>
          ) : !token ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <AlertTriangle className="h-10 w-10 text-destructive" />
              <p className="font-medium">Invalid link</p>
              <p className="text-sm text-muted-foreground">
                This reset link is missing a token.
              </p>
              <Link href="/forgot-password">
                <Button variant="outline" size="sm">Request a new link</Button>
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <Alert variant="destructive" className="mb-5">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <Field label="New password" htmlFor="new-password" required>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </Field>

                <Field label="Confirm new password" htmlFor="confirm-password" required>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </Field>

                <Button type="submit" className="w-full" disabled={submitting || !token}>
                  {submitting ? "Updating…" : "Update password"}
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          <Link href="/forgot-password" className="font-medium text-primary hover:underline">
            Request a new reset link
          </Link>
        </p>
      </div>
    </div>
  );
}
