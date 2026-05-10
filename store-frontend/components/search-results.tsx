"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  RegistryPackage,
  STANDARD_STATUS_INFO,
  STANDARD_STATUS_VALUES,
  type StandardStatus,
} from "@/lib/types";
import { fetchPackages } from "@/lib/api";
import { PackageCard } from "@/components/package-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { RefreshCcw, WifiOff, SlidersHorizontal } from "lucide-react";

function parseStatuses(raw: string): StandardStatus[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is StandardStatus =>
      (STANDARD_STATUS_VALUES as string[]).includes(s),
    );
}

function CardSkeleton() {
  return <div className="h-44 animate-pulse rounded-lg border bg-muted/40" />;
}

export function SearchResults() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const spKey = searchParams.toString();

  const query = searchParams.get("q") ?? "";
  const author = searchParams.get("author") ?? "";
  const org = searchParams.get("org") ?? "";
  const level = searchParams.get("level") ?? "";
  const standardStatusRaw = searchParams.get("standardStatus") ?? "";
  const sort = searchParams.get("sort") ?? "created";
  const order = searchParams.get("order") ?? "desc";

  const activeStatuses = useMemo(
    () => parseStatuses(standardStatusRaw),
    [standardStatusRaw],
  );

  const [packages, setPackages] = useState<RegistryPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await fetchPackages({
        q: query || undefined,
        author: author || undefined,
        org: org || undefined,
        level: level || undefined,
        standardStatus: activeStatuses.length ? activeStatuses : undefined,
        sort: sort === "downloads" ? "downloads" : "created",
        order: order === "asc" ? "asc" : "desc",
      });
      setPackages(data);
    } catch (err) {
      console.error(err);
      setError("Could not reach the registry. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, [query, author, org, level, activeStatuses, sort, order]);

  useEffect(() => {
    load();
  }, [load]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    const q = String(fd.get("q") ?? "").trim();
    const au = String(fd.get("author") ?? "").trim();
    const og = String(fd.get("org") ?? "").trim().replace(/^@+/, "");
    const lv = String(fd.get("level") ?? "").trim();
    const st = String(fd.get("sort") ?? "created").trim();
    const ord = String(fd.get("order") ?? "desc").trim();

    if (q) params.set("q", q);
    if (au) params.set("author", au);
    if (og) params.set("org", og);
    if (lv && lv !== "any") params.set("level", lv);
    if (activeStatuses.length) {
      params.set("standardStatus", activeStatuses.join(","));
    }
    if (st === "downloads" || st === "created") params.set("sort", st);
    if (ord === "asc" || ord === "desc") params.set("order", ord);

    router.replace(`/search?${params.toString()}`);
  }

  function toggleStatus(s: StandardStatus) {
    const next = activeStatuses.includes(s)
      ? activeStatuses.filter((x) => x !== s)
      : [...activeStatuses, s];

    const params = new URLSearchParams(searchParams.toString());
    if (next.length) params.set("standardStatus", next.join(","));
    else params.delete("standardStatus");
    router.replace(`/search${params.toString() ? `?${params.toString()}` : ""}`);
  }

  const hasStructuredFilters = Boolean(
    author || org || level || activeStatuses.length,
  );

  return (
    <div className="container max-w-6xl px-4 py-10">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Standard:
        </span>
        {STANDARD_STATUS_VALUES.map((s) => {
          const active = activeStatuses.includes(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggleStatus(s)}
              title={STANDARD_STATUS_INFO[s].description}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                active
                  ? "border-foreground/40 bg-foreground/10 text-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted/40",
              )}
            >
              {STANDARD_STATUS_INFO[s].label}
            </button>
          );
        })}
        {activeStatuses.length > 0 && (
          <button
            type="button"
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.delete("standardStatus");
              router.replace(`/search${params.toString() ? `?${params.toString()}` : ""}`);
            }}
            className="ml-1 text-[11px] text-muted-foreground underline-offset-2 hover:underline"
          >
            clear
          </button>
        )}
      </div>
      <form
        key={spKey}
        onSubmit={handleSubmit}
        className="mb-8 space-y-4 rounded-lg border border-border/70 bg-muted/15 p-4 shadow-sm"
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1 space-y-1.5">
            <Label htmlFor="registry-q" className="text-xs">
              Keywords
            </Label>
            <Input
              id="registry-q"
              name="q"
              placeholder="Name, description, keywords, slug, author…"
              defaultValue={query}
              className="h-9"
            />
          </div>
          <Button type="submit" size="sm" className="h-9 shrink-0">
            Search
          </Button>
        </div>

        <details className="group rounded-md border border-border/50 bg-background/60 p-3">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-foreground">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            Filters &amp; sort
            <span className="ml-auto text-xs font-normal text-muted-foreground group-open:hidden">
              Author, organization, readiness level, downloads
            </span>
          </summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="registry-author" className="text-xs">
                Author contains
              </Label>
              <Input
                id="registry-author"
                name="author"
                placeholder="e.g. ACME Corp"
                defaultValue={author}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="registry-org" className="text-xs">
                Organization
              </Label>
              <Input
                id="registry-org"
                name="org"
                placeholder="slug without @"
                defaultValue={org}
                className="h-9 font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="registry-level" className="text-xs">
                Readiness level
              </Label>
              <select
                id="registry-level"
                name="level"
                defaultValue={level || "any"}
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="any">Any readiness</option>
                <option value="1">RL1</option>
                <option value="2">RL2</option>
                <option value="3">RL3</option>
                <option value="4">RL4</option>
                <option value="5">RL5</option>
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
              <Label htmlFor="registry-sort" className="text-xs">
                Sort by
              </Label>
              <div className="flex gap-2">
                <select
                  id="registry-sort"
                  name="sort"
                  defaultValue={sort}
                  className="flex h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="created">Date published</option>
                  <option value="downloads">Total downloads</option>
                </select>
                <select
                  name="order"
                  defaultValue={order}
                  className="h-9 w-[110px] shrink-0 rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="desc">High → low</option>
                  <option value="asc">Low → high</option>
                </select>
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="submit" size="sm">
              Apply filters
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => router.replace("/search")}
            >
              Reset
            </Button>
          </div>
        </details>
      </form>

      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">
          {query || hasStructuredFilters ? (
            <>
              {query ? (
                <>
                  Results for{" "}
                  <span className="text-primary">&ldquo;{query}&rdquo;</span>
                </>
              ) : (
                <span>Registry</span>
              )}
              {hasStructuredFilters && (
                <span className="mt-1 block text-sm font-normal text-muted-foreground">
                  {[
                    author && `Author: ${author}`,
                    org && `Org: @${org}`,
                    level && `RL${level}`,
                    activeStatuses.length &&
                      `Status: ${activeStatuses.map((s) => STANDARD_STATUS_INFO[s].label).join(", ")}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              )}
            </>
          ) : (
            "All packages"
          )}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Pre-silicon bridge</span>: evaluate RISC-V
            extensions before RTL/FPGA/ASIC decisions.
          </p>
        </div>
        {!loading && !error && (
          <p className="shrink-0 text-sm text-muted-foreground">
            {packages.length} package{packages.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {error ? (
        <Alert variant="destructive" className="max-w-xl">
          <WifiOff className="h-4 w-4" />
          <AlertTitle>Connection error</AlertTitle>
          <AlertDescription className="mt-2 space-y-3">
            <p>{error}</p>
            <Button variant="secondary" size="sm" onClick={load} className="gap-2">
              <RefreshCcw className="h-4 w-4" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : loading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : packages.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/20 py-20 text-center">
          <p className="font-medium text-foreground">No packages found</p>
          {query || hasStructuredFilters ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Try different keywords or filters, or{" "}
              <button
                type="button"
                onClick={() => router.replace("/search")}
                className="underline hover:text-foreground"
              >
                browse all packages
              </button>
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              No packages have been published yet.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} />
          ))}
        </div>
      )}
    </div>
  );
}
