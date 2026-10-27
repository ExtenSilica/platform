"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import {
  apiGetImplementationRequest,
  apiPatchImplementationRequest,
  apiCreateImplementationInterest,
  ApiError,
} from "@/lib/api";
import type { ImplementationRequest, ImplementationRequestStatus } from "@/lib/types";
import {
  IMPLEMENTATION_REQUEST_STATUS_INFO,
  IMPLEMENTATION_INTEREST_MESSAGE_MAX,
  isTerminalImplementationRequestStatus,
} from "@/lib/types";
import { ImplementationRequestStatusBadge } from "@/components/implementation-request-status-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  ArrowLeft,
  Calendar,
  ClipboardList,
  ExternalLink,
  Info,
  Layers,
  User,
} from "lucide-react";

function fmtDate(d: string | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

type StatusAction = {
  label: string;
  toStatus: ImplementationRequestStatus;
  variant?: "default" | "secondary" | "outline" | "destructive";
};

export function ImplementationRequestDetail({ id }: { id: string }) {
  const { token, user } = useAuth();
  const requestId = Number.parseInt(id, 10);

  const [request, setRequest] = useState<ImplementationRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [interestMessage, setInterestMessage] = useState("");
  const [interestSent, setInterestSent] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isInteger(requestId) || requestId <= 0) {
      setError("Invalid request id.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { request: row } = await apiGetImplementationRequest(requestId, token);
      setRequest(row);
    } catch (err) {
      setRequest(null);
      setError(
        err instanceof ApiError && err.status === 404
          ? "This request was not found or you do not have access to view it."
          : err instanceof ApiError
            ? err.message
            : "Failed to load this request.",
      );
    } finally {
      setLoading(false);
    }
  }, [requestId, token]);

  useEffect(() => {
    load();
  }, [load]);

  const isCreator = user != null && request?.createdByUserId === user.id;

  const statusActions: StatusAction[] = [];
  if (request && !isTerminalImplementationRequestStatus(request.status)) {
    if (request.status === "draft" && isCreator) {
      statusActions.push({ label: "Publish as open", toStatus: "open" });
    }
    if (request.status === "open" && isCreator) {
      statusActions.push({ label: "Mark in progress", toStatus: "in_progress" });
    }
    if (
      (request.status === "draft" || request.status === "open") &&
      isCreator
    ) {
      statusActions.push({
        label: "Cancel request",
        toStatus: "cancelled",
        variant: "destructive",
      });
    }
    if (request.status === "verified") {
      statusActions.push({ label: "Mark completed", toStatus: "completed" });
    }
  }

  async function transition(toStatus: ImplementationRequestStatus) {
    if (!token || !request) return;
    setBusy(true);
    setActionError(null);
    try {
      const { request: updated } = await apiPatchImplementationRequest(
        token,
        request.id,
        { status: toStatus },
      );
      setRequest(updated);
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Status update failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function expressInterest() {
    if (!token || !request) return;
    setBusy(true);
    setActionError(null);
    try {
      await apiCreateImplementationInterest(
        token,
        request.id,
        interestMessage.trim() || null,
      );
      setInterestSent(true);
      setInterestMessage("");
      await load();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Could not record your interest.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="container max-w-3xl px-4 py-10 text-muted-foreground">
        Loading request…
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="container max-w-3xl px-4 py-10">
        <BackLink />
        <p className="mt-6 text-sm text-destructive">{error ?? "Request not found."}</p>
      </div>
    );
  }

  const canExpressInterest =
    token &&
    !interestSent &&
    request.status !== "draft" &&
    request.status !== "cancelled" &&
    request.status !== "completed";

  return (
    <div className="container max-w-3xl px-4 py-8">
      <BackLink />

      <header className="mt-6 border-b pb-6">
        <div className="flex flex-wrap items-start gap-3">
          <ClipboardList className="mt-1 h-6 w-6 shrink-0 text-primary" />
          <RequestHeaderBody request={request} />
        </div>
      </header>

      <div className="mt-6 space-y-6">
        <section>
          <h2 className="text-sm font-semibold text-foreground">Description</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
            {request.description}
          </p>
        </section>

        {(request.target || request.targetCapability) && (
          <MetaRow label="Target" value={request.target?.name ?? request.targetCapability ?? ""} mono />
        )}

        {request.acceptanceCriteriaSummary && (
          <section>
            <h2 className="text-sm font-semibold text-foreground">
              Acceptance criteria
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
              {request.acceptanceCriteriaSummary}
            </p>
          </section>
        )}

        {(request.fundingContactEmail || request.fundingNote) && (
          <section className="rounded-lg border bg-muted/20 p-4">
            <h2 className="text-sm font-semibold text-foreground">
              Off-platform funding
            </h2>
            {request.fundingContactEmail && (
              <p className="mt-2 text-sm">
                Contact:{" "}
                <a
                  href={`mailto:${request.fundingContactEmail}`}
                  className="font-medium text-primary hover:underline"
                >
                  {request.fundingContactEmail}
                </a>
              </p>
            )}
            {request.fundingNote && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                {request.fundingNote}
              </p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              ExtenSilica does not hold funds or broker contracts.
            </p>
          </section>
        )}

        {request.milestones && request.milestones.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-foreground">Milestones</h2>
            <ol className="mt-3 space-y-2">
              {request.milestones.map((m) => (
                <li
                  key={m.id}
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <p className="font-medium text-foreground">{m.title}</p>
                  {m.description && (
                    <p className="mt-1 text-muted-foreground">{m.description}</p>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="rounded-lg border p-4">
          <h2 className="text-sm font-semibold text-foreground">Activity</h2>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <Stat label="Interested" value={String(request.interestCount)} />
            <Stat label="Submissions" value={String(request.submissionCount)} />
            {request.openedAt && (
              <Stat label="Opened" value={fmtDate(request.openedAt) ?? ""} />
            )}
            {request.completedAt && (
              <Stat label="Completed" value={fmtDate(request.completedAt) ?? ""} />
            )}
          </dl>
        </section>

        {token && (
          <section className="space-y-4 rounded-lg border border-dashed p-4">
            <h2 className="text-sm font-semibold text-foreground">Actions</h2>

            {actionError && (
              <p className="text-xs text-destructive">{actionError}</p>
            )}

            {statusActions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {statusActions.map((a) => (
                  <Button
                    key={a.toStatus}
                    type="button"
                    size="sm"
                    variant={a.variant ?? "outline"}
                    disabled={busy}
                    onClick={() => void transition(a.toStatus)}
                  >
                    {a.label}
                  </Button>
                ))}
              </div>
            )}

            {canExpressInterest && (
              <div className="space-y-2 border-t border-border/60 pt-4">
                <Label htmlFor="interest-msg" className="text-xs font-semibold">
                  Express interest{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional message, max {IMPLEMENTATION_INTEREST_MESSAGE_MAX} chars)
                  </span>
                </Label>
                <Textarea
                  id="interest-msg"
                  value={interestMessage}
                  onChange={(e) => setInterestMessage(e.target.value)}
                  rows={2}
                  maxLength={IMPLEMENTATION_INTEREST_MESSAGE_MAX}
                  className="text-sm"
                  placeholder="Brief note on how you would approach this work…"
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() => void expressInterest()}
                >
                  {busy ? "Sending…" : "I'm interested"}
                </Button>
              </div>
            )}

            {interestSent && (
              <p className="text-xs text-emerald-700">
                Your interest was recorded. The request creator may follow up off-platform.
              </p>
            )}

            <Alert className="bg-muted/30">
              <Info className="h-4 w-4" />
              <AlertTitle className="text-xs">Verification</AlertTitle>
              <AlertDescription className="text-xs text-muted-foreground">
                A passing run creates or updates the Extension/Target Port.
                Extension provenance is never changed by Port verification.
              </AlertDescription>
            </Alert>
          </section>
        )}

        {!token && (
          <p className="text-sm text-muted-foreground">
            <Link
              href={`/login?next=/requests/${request.id}`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Sign in
            </Link>{" "}
            to express interest or manage this request.
          </p>
        )}
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/requests"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      All Port requests
    </Link>
  );
}

function RequestHeaderBody({ request }: { request: ImplementationRequest }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{request.title}</h1>
        <ImplementationRequestStatusBadge status={request.status} />
      </div>
      <p
        className="mt-1 text-xs text-muted-foreground"
        title={IMPLEMENTATION_REQUEST_STATUS_INFO[request.status].description}
      >
        {IMPLEMENTATION_REQUEST_STATUS_INFO[request.status].description}
      </p>
      {request.package && (
        <Link
          href={`/package/${encodeURIComponent(request.package.slug)}`}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <Layers className="h-3.5 w-3.5" />
          {request.package.name}
          <span className="font-mono text-xs text-muted-foreground">
            ({request.package.slug})
          </span>
          <ExternalLink className="h-3 w-3" />
        </Link>
      )}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {request.createdBy && (
          <span className="inline-flex items-center gap-1">
            <User className="h-3 w-3" />
            <Link
              href={`/users/${request.createdBy.username}`}
              className="hover:text-foreground hover:underline"
            >
              @{request.createdBy.username}
            </Link>
          </span>
        )}
        {request.assignedImplementer && (
          <span className="inline-flex items-center gap-1">
            Assignee:{" "}
            <Link
              href={`/users/${request.assignedImplementer.username}`}
              className="hover:text-foreground hover:underline"
            >
              @{request.assignedImplementer.username}
            </Link>
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          Updated {fmtDate(request.updatedAt)}
        </span>
        <span>Visibility: {request.visibility.replace("_", " ")}</span>
      </div>
    </div>
  );
}

function MetaRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-foreground">{label}</h2>
      <p className={`mt-1 text-sm text-muted-foreground ${mono ? "font-mono" : ""}`}>
        {value}
      </p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}
