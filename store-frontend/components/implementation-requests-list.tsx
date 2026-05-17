"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiListImplementationRequests, ApiError } from "@/lib/api";
import type { ImplementationRequest, ImplementationRequestStatus } from "@/lib/types";
import {
  IMPLEMENTATION_REQUEST_STATUSES,
  IMPLEMENTATION_REQUEST_STATUS_INFO,
} from "@/lib/types";
import { ImplementationRequestStatusBadge } from "@/components/implementation-request-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClipboardList, RefreshCcw } from "lucide-react";
import { useAuth } from "@/lib/auth";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ImplementationRequestsList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token } = useAuth();

  const statusParam = searchParams.get("status") ?? "";
  const capabilityParam = searchParams.get("capability") ?? "";

  const [statusFilter, setStatusFilter] = useState(statusParam);
  const [capabilityFilter, setCapabilityFilter] = useState(capabilityParam);
  const [requests, setRequests] = useState<ImplementationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status =
        statusParam && IMPLEMENTATION_REQUEST_STATUSES.includes(
          statusParam as ImplementationRequestStatus,
        )
          ? (statusParam as ImplementationRequestStatus)
          : undefined;
      const { requests: rows } = await apiListImplementationRequests(token, {
        status,
        capability: capabilityParam || undefined,
      });
      setRequests(rows);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load implementation requests.",
      );
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [token, statusParam, capabilityParam]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setStatusFilter(statusParam);
    setCapabilityFilter(capabilityParam);
  }, [statusParam, capabilityParam]);

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (capabilityFilter.trim()) params.set("capability", capabilityFilter.trim());
    router.replace(`/requests${params.toString() ? `?${params}` : ""}`);
  }

  function clearFilters() {
    setStatusFilter("");
    setCapabilityFilter("");
    router.replace("/requests");
  }

  return (
    <div className="container max-w-4xl px-4 py-8">
      <div className="mb-8">
        <div className="flex items-start gap-3">
          <ClipboardList className="mt-1 h-6 w-6 shrink-0 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Implementation requests
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Open technical coordination on registry packages — ports, tests, and
              readiness work. ExtenSilica does not process payments on-platform.
            </p>
          </div>
        </div>
      </div>

      <form
        onSubmit={applyFilters}
        className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border bg-muted/20 p-4"
      >
        <FilterField label="Status" htmlFor="req-status-filter">
          <select
            id="req-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex h-9 min-w-[10rem] rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Any active status</option>
            {IMPLEMENTATION_REQUEST_STATUSES.filter(
              (s) => s !== "cancelled",
            ).map((s) => (
              <option key={s} value={s}>
                {IMPLEMENTATION_REQUEST_STATUS_INFO[s].label}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Capability" htmlFor="req-cap-filter">
          <Input
            id="req-cap-filter"
            value={capabilityFilter}
            onChange={(e) => setCapabilityFilter(e.target.value)}
            placeholder="e.g. spike, RL3"
            className="h-9 w-40 text-sm sm:w-52"
          />
        </FilterField>

        <Button type="submit" size="sm">
          Apply
        </Button>
        {(statusParam || capabilityParam) && (
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
            Clear
          </Button>
        )}
      </form>

      {error && (
        <p className="mb-4 text-sm text-destructive">{error}</p>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg border bg-muted/40" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          <p>No implementation requests match your filters.</p>
          <p className="mt-2">
            Browse the{" "}
            <Link href="/search" className="font-medium text-foreground underline-offset-4 hover:underline">
              registry
            </Link>{" "}
            and open a package page to file a new request.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>{requests.length} request{requests.length === 1 ? "" : "s"}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2"
              onClick={() => void load()}
            >
              <RefreshCcw className="h-3 w-3" />
              Refresh
            </Button>
          </div>
          <ul className="space-y-3">
            {requests.map((r) => (
              <li key={r.id}>
                <RequestListCard request={r} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function FilterField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-semibold">
        {label}
      </Label>
      {children}
    </div>
  );
}

function RequestListCard({ request: r }: { request: ImplementationRequest }) {
  return (
    <Link
      href={`/requests/${r.id}`}
      className="block rounded-lg border bg-background p-4 transition-colors hover:border-primary/40 hover:bg-muted/20"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-foreground">{r.title}</h2>
            <ImplementationRequestStatusBadge status={r.status} />
          </div>
          {r.package && (
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {r.package.slug}
            </p>
          )}
        </div>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {fmtDate(r.updatedAt)}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
        {r.description}
      </p>
      <RequestCardMeta request={r} />
    </Link>
  );
}

function RequestCardMeta({ request: r }: { request: ImplementationRequest }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      {r.targetCapability && (
        <span>
          Target: <span className="font-mono text-foreground/80">{r.targetCapability}</span>
        </span>
      )}
      {r.createdBy && <span>by @{r.createdBy.username}</span>}
      {r.interestCount > 0 && <span>{r.interestCount} interested</span>}
      {r.submissionCount > 0 && <span>{r.submissionCount} submission{r.submissionCount === 1 ? "" : "s"}</span>}
    </div>
  );
}
