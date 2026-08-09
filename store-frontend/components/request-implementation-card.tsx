"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  apiListPackageImplementationRequests,
  apiCreatePackageImplementationRequest,
  apiPatchImplementationRequest,
  apiGetMyOrgs,
  ApiError,
} from "@/lib/api";
import type { ImplementationRequest, MyOrg, RegistryTarget } from "@/lib/types";
import {
  IMPLEMENTATION_TITLE_MIN,
  IMPLEMENTATION_TITLE_MAX,
  IMPLEMENTATION_DESCRIPTION_MIN,
  IMPLEMENTATION_DESCRIPTION_MAX,
  IMPLEMENTATION_ACCEPTANCE_CRITERIA_MAX,
  PORT_REWARD_XSIL_BY_TARGET_KIND,
} from "@/lib/types";
import { ImplementationRequestStatusBadge } from "@/components/implementation-request-status-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { ClipboardList, Info, Send, Plus, CheckCircle2 } from "lucide-react";

const LISTABLE_STATUSES = new Set([
  "open",
  "in_progress",
  "submitted",
  "verified",
]);

/**
 * Port work panel on an Extension page. A target is mandatory and a passing
 * verification creates the Port and unlocks the displayed XSIL reward.
 */
export function RequestImplementationCard({
  slug,
  targets,
}: {
  slug: string;
  targets: RegistryTarget[];
}) {
  const { token, user } = useAuth();
  const searchParams = useSearchParams();
  const [requests, setRequests] = useState<ImplementationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "org_only" | "unlisted">(
    "public",
  );
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [acceptanceCriteriaSummary, setAcceptanceCriteriaSummary] = useState("");
  const [createdByOrgId, setCreatedByOrgId] = useState("");
  const [myOrgs, setMyOrgs] = useState<MyOrg[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<number | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    apiListPackageImplementationRequests(slug, token ?? null)
      .then(({ requests: list }) => setRequests(list))
      .catch((err) => {
        setLoadError(
          err instanceof ApiError ? err.message : "Could not load implementation requests.",
        );
        setRequests([]);
      })
      .finally(() => setLoading(false));
  }, [slug, token]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const requested = searchParams.get("portTarget");
    if (!requested || !targets.some((target) => String(target.id) === requested)) return;
    setSelectedTargetId(requested);
    if (token) setOpen(true);
  }, [searchParams, targets, token]);

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

  const titleLen = title.trim().length;
  const descLen = description.trim().length;
  const formValid =
    titleLen >= IMPLEMENTATION_TITLE_MIN &&
    titleLen <= IMPLEMENTATION_TITLE_MAX &&
    descLen >= IMPLEMENTATION_DESCRIPTION_MIN &&
    descLen <= IMPLEMENTATION_DESCRIPTION_MAX &&
    Boolean(selectedTargetId);

  const selectedTarget = targets.find((target) => String(target.id) === selectedTargetId);
  const selectedReward = selectedTarget
    ? PORT_REWARD_XSIL_BY_TARGET_KIND[selectedTarget.kind]
    : null;

  const listed = requests
    .filter((r) => {
      if (r.status === "draft") return Boolean(r.targetId) && user?.id === r.createdByUserId;
      return Boolean(r.targetId) && LISTABLE_STATUSES.has(r.status);
    })
    .slice(0, 8);

  async function submit(publish: boolean) {
    if (!token || !formValid) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { request } = await apiCreatePackageImplementationRequest(token, slug, {
        title: title.trim(),
        description: description.trim(),
        visibility,
        targetId: Number(selectedTargetId),
        targetCapability: selectedTarget?.slug ?? null,
        acceptanceCriteriaSummary: acceptanceCriteriaSummary.trim() || null,
        createdByOrgId: createdByOrgId ? Number(createdByOrgId) : null,
      });
      if (publish) {
        await apiPatchImplementationRequest(token, request.id, { status: "open" });
      }
      setCreatedId(request.id);
      setOpen(false);
      setTitle("");
      setDescription("");
      setSelectedTargetId("");
      setAcceptanceCriteriaSummary("");
      reload();
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : "Could not create the request.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (createdId != null) {
    return (
      <CreatedSuccessBanner
        requestId={createdId}
        onDismiss={() => setCreatedId(null)}
      />
    );
  }

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-start gap-3">
        <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            Port requests
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Extension + Target + reproducible evidence. Verification earns XSIL.
          </p>
        </div>
      </div>

      {loadError && (
        <p className="mt-2 text-xs text-destructive">{loadError}</p>
      )}

      {loading ? (
        <p className="mt-3 text-xs text-muted-foreground">Loading requests…</p>
      ) : listed.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {listed.map((r) => (
            <li
              key={r.id}
              className="rounded-md border border-border/80 bg-muted/20 px-3 py-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/requests/${r.id}`}
                  className="text-sm font-medium text-foreground hover:underline"
                >
                  {r.title}
                </Link>
                <ImplementationRequestStatusBadge status={r.status} />
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {r.target?.name ?? r.targetCapability ?? "Target pending"}
                {r.rewardXsil ? ` · ${r.rewardXsil.toLocaleString()} XSIL` : ""}
              </p>
              {r.createdBy && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  by @{r.createdBy.username}
                  {r.interestCount > 0 && ` · ${r.interestCount} interested`}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          No open Port requests yet.
        </p>
      )}

      {!token ? (
        <p className="mt-3 text-xs text-muted-foreground">
          <Link
            href={`/login?next=/package/${encodeURIComponent(slug)}`}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Sign in
          </Link>{" "}
          to port this Extension and earn XSIL after verification.
        </p>
      ) : !open ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 gap-1.5"
          onClick={() => setOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Port this Extension
        </Button>
      ) : (
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(true);
          }}
        >
          {myOrgs.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="impl-org" className="text-xs font-semibold">
                Filed by
              </Label>
              <select
                id="impl-org"
                value={createdByOrgId}
                onChange={(e) => setCreatedByOrgId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Myself (personal account)</option>
                {myOrgs.map((o) => (
                  <option key={o.id} value={String(o.id)}>
                    Organization @{o.slug}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="impl-title" className="text-xs font-semibold">
              Title{" "}
              <span className="font-normal text-muted-foreground">
                ({IMPLEMENTATION_TITLE_MIN}–{IMPLEMENTATION_TITLE_MAX} chars)
              </span>
            </Label>
            <Input
              id="impl-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Port this extension to Spike with reproducible tests"
              maxLength={IMPLEMENTATION_TITLE_MAX}
              className="text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              {titleLen}/{IMPLEMENTATION_TITLE_MAX}
            </p>
          </div>

          <DescriptionField
            description={description}
            onChange={setDescription}
            descLen={descLen}
          />

          <div className="space-y-1.5">
            <Label htmlFor="impl-visibility" className="text-xs font-semibold">
              Visibility
            </Label>
            <select
              id="impl-visibility"
              value={visibility}
              onChange={(e) =>
                setVisibility(e.target.value as typeof visibility)
              }
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="public">Public — listed for implementers</option>
              <option value="org_only">Org only — members of your org</option>
              <option value="unlisted">Unlisted — link holders only</option>
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
            <div className="space-y-1.5">
              <Label htmlFor="impl-target" className="text-xs font-semibold">Target</Label>
              <select
                id="impl-target"
                value={selectedTargetId}
                onChange={(e) => setSelectedTargetId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                required
              >
                <option value="">Select target</option>
                {targets.map((target) => (
                  <option key={target.id} value={String(target.id)}>
                    {target.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Reward</Label>
              <div className="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm font-semibold tabular-nums">
                {selectedReward ? `${selectedReward.toLocaleString()} XSIL` : "Select target"}
              </div>
            </div>
          </div>

          <AcceptanceCriteriaField
            value={acceptanceCriteriaSummary}
            onChange={setAcceptanceCriteriaSummary}
          />

          <Alert className="bg-muted/40">
            <Info className="h-4 w-4" />
            <AlertTitle className="text-xs">Reward requires verification</AlertTitle>
            <AlertDescription className="text-xs text-muted-foreground">
              Publishing metadata earns nothing. XSIL is granted only after the
              submitted Port and its evidence pass verification.
            </AlertDescription>
          </Alert>

          {submitError && (
            <p className="text-xs text-destructive">{submitError}</p>
          )}

          <FormActions
            formValid={formValid}
            submitting={submitting}
            onSaveDraft={() => void submit(false)}
            onCancel={() => setOpen(false)}
          />
        </form>
      )}
    </div>
  );
}

function CreatedSuccessBanner({
  requestId,
  onDismiss,
}: {
  requestId: number;
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
      <div className="flex items-start gap-3 text-sm">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <div>
          <p className="font-semibold text-foreground">Request created</p>
          <p className="mt-1 text-muted-foreground">
            <Link
              href={`/requests/${requestId}`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              View request #{requestId}
            </Link>{" "}
            or track it from your{" "}
            <Link
              href="/dashboard"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              dashboard
            </Link>
            .
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 h-7 px-2 text-xs"
            onClick={onDismiss}
          >
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}

function DescriptionField({
  description,
  onChange,
  descLen,
}: {
  description: string;
  onChange: (v: string) => void;
  descLen: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="impl-desc" className="text-xs font-semibold">
        Description{" "}
        <span className="font-normal text-muted-foreground">
          ({IMPLEMENTATION_DESCRIPTION_MIN}+ chars)
        </span>
      </Label>
      <Textarea
        id="impl-desc"
        value={description}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Describe the technical goal, constraints, and context an implementer needs."
        rows={5}
        maxLength={IMPLEMENTATION_DESCRIPTION_MAX}
        className="text-sm"
      />
      <p className="text-[11px] text-muted-foreground">
        {descLen}/{IMPLEMENTATION_DESCRIPTION_MAX}
        {descLen < IMPLEMENTATION_DESCRIPTION_MIN && (
          <span className="ml-2 text-destructive/80">
            needs {IMPLEMENTATION_DESCRIPTION_MIN - descLen} more
          </span>
        )}
      </p>
    </div>
  );
}

function AcceptanceCriteriaField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="impl-acceptance" className="text-xs font-semibold">
        Acceptance criteria{" "}
        <span className="font-normal text-muted-foreground">(optional)</span>
      </Label>
      <Textarea
        id="impl-acceptance"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="What does “done” look like for verification?"
        rows={3}
        maxLength={IMPLEMENTATION_ACCEPTANCE_CRITERIA_MAX}
        className="text-sm"
      />
    </div>
  );
}

function FormActions({
  formValid,
  submitting,
  onSaveDraft,
  onCancel,
}: {
  formValid: boolean;
  submitting: boolean;
  onSaveDraft: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="submit"
        size="sm"
        disabled={!formValid || submitting}
        className="gap-1.5"
      >
        <Send className="h-3.5 w-3.5" />
        {submitting ? "Publishing…" : "Publish as open"}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={!formValid || submitting}
        onClick={onSaveDraft}
      >
        {submitting ? "Saving…" : "Save draft"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onCancel}
        disabled={submitting}
      >
        Cancel
      </Button>
    </div>
  );
}
