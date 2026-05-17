"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import {
  apiOwnershipEligibility,
  apiCreateOwnershipRequest,
  apiGetMyOrgs,
  ApiError,
} from "@/lib/api";
import type { MyOrg, OwnershipEligibility } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { CheckCircle2, ShieldQuestion, Send, Info } from "lucide-react";

const REASON_MIN = 50;
const REASON_MAX = 2000;

/**
 * Sidebar card on a package page that lets a signed-in non-owner request
 * authorship of the package. Hidden for owners, maintainers, org members,
 * and users who already have a pending request.
 */
export function ClaimOwnershipCard({ slug }: { slug: string }) {
  const { token, user } = useAuth();
  const [eligibility, setEligibility] = useState<OwnershipEligibility | null>(
    null,
  );
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [claimantOrgId, setClaimantOrgId] = useState("");
  const [myOrgs, setMyOrgs] = useState<MyOrg[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiOwnershipEligibility(slug, token ?? null)
      .then((res) => {
        if (!cancelled) setEligibility(res);
      })
      .catch(() => {
        if (!cancelled)
          setEligibility({ eligible: false, reason: "Could not check eligibility." });
      });
    return () => {
      cancelled = true;
    };
  }, [slug, token, user?.id]);

  useEffect(() => {
    if (!open || !token) return;
    let cancelled = false;
    apiGetMyOrgs(token)
      .then((orgs) => {
        if (!cancelled) setMyOrgs(orgs);
      })
      .catch(() => {
        if (!cancelled) setMyOrgs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, token]);

  if (!eligibility) return null;

  if (submitted) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div className="text-sm">
            <p className="font-semibold text-foreground">Request submitted</p>
            <p className="mt-1 text-muted-foreground">
              A platform admin will review it. You can track the status in your{" "}
              <Link
                href="/dashboard?tab=requests"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                dashboard
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!eligibility.eligible && eligibility.requiresAuth) {
    return (
      <div className="rounded-lg border border-border bg-muted/40 p-4">
        <div className="flex items-start gap-3">
          <ShieldQuestion className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="text-sm">
            <p className="font-semibold text-foreground">Are you the author?</p>
            <p className="mt-1 text-muted-foreground">
              <Link
                href={`/login?next=/package/${encodeURIComponent(slug)}`}
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Sign in
              </Link>{" "}
              to request ownership of this package.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!eligibility.eligible) {
    return null;
  }

  const trimmedLen = reason.trim().length;
  const canSubmit =
    !submitting &&
    trimmedLen >= REASON_MIN &&
    trimmedLen <= REASON_MAX &&
    (evidenceUrl.trim() === "" || /^https?:\/\/.+/i.test(evidenceUrl.trim()));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await apiCreateOwnershipRequest(token, slug, {
        reason: reason.trim(),
        evidenceUrl: evidenceUrl.trim() || null,
        claimantOrgId: claimantOrgId ? Number(claimantOrgId) : null,
      });
      setSubmitted(true);
      setOpen(false);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : "Could not submit your request.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-start gap-3">
        <ShieldQuestion className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            Are you the author?
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Request ownership and a platform admin will review.
          </p>
          {!open && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setOpen(true)}
            >
              Request ownership
            </Button>
          )}
        </div>
      </div>

      {open && (
        <form onSubmit={submit} className="mt-4 space-y-3">
          {myOrgs.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="claim-org" className="text-xs font-semibold">
                Claiming as
              </Label>
              <select
                id="claim-org"
                value={claimantOrgId}
                onChange={(e) => setClaimantOrgId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Myself (personal account)</option>
                {myOrgs.map((o) => (
                  <option key={o.id} value={String(o.id)}>
                    Organization @{o.slug} — {o.displayName}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                If approved, the package may be linked to the selected organization.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="claim-reason" className="text-xs font-semibold">
              Why are you the rightful owner?{" "}
              <span className="font-normal text-muted-foreground">
                ({REASON_MIN}–{REASON_MAX} chars)
              </span>
            </Label>
            <Textarea
              id="claim-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain your relationship to the project: are you the upstream author, a maintainer of the linked GitHub repo, the original publisher, etc.? Include enough detail for an admin to verify."
              rows={5}
              maxLength={REASON_MAX}
              className="text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              {trimmedLen}/{REASON_MAX}
              {trimmedLen < REASON_MIN && (
                <span className="ml-2 text-destructive/80">
                  needs {REASON_MIN - trimmedLen} more
                </span>
              )}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="claim-evidence" className="text-xs font-semibold">
              Evidence URL{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="claim-evidence"
              type="url"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              placeholder="https://github.com/your-org/repo/commit/abc123"
              className="text-sm"
            />
          </div>

          <Alert className="bg-muted/40">
            <Info className="h-4 w-4" />
            <AlertTitle className="text-xs">How review works</AlertTitle>
            <AlertDescription className="text-xs text-muted-foreground">
              Your request is visible to platform admins only. If approved, you
              become the package owner; if rejected, you can resubmit later.
            </AlertDescription>
          </Alert>

          {submitError && (
            <p className="text-xs text-destructive">{submitError}</p>
          )}

          <div className="flex items-center gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={!canSubmit}
              className="gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              {submitting ? "Submitting…" : "Submit request"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
