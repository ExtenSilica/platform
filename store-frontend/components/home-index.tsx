"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowRight,
  BookOpen,
  Box,
  CheckCircle2,
  Cpu,
  Package,
  RefreshCcw,
  Search,
  ShieldCheck,
  Terminal,
  WifiOff,
} from "lucide-react";

import { apiCatalogStats, fetchPackages } from "@/lib/api";
import {
  STANDARD_STATUS_INFO,
  STANDARD_STATUS_VALUES,
  type CatalogStats,
  type RegistryPackage,
  type StandardStatus,
} from "@/lib/types";
import { pickDiverseHomePackages } from "@/lib/home-packages";
import { PackageCard } from "@/components/package-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CircuitBackground, ChipDie } from "@/components/circuit-bg";

const PACKAGE_CONTENTS = [
  {
    icon: BookOpen,
    title: "Specification and provenance",
    description: "Upstream links, authorship, licensing, status, and documentation travel with the package.",
  },
  {
    icon: Cpu,
    title: "ISA metadata",
    description: "Instruction encodings, CSR usage, dependencies, and required base ISA are searchable and versioned.",
  },
  {
    icon: Terminal,
    title: "Optional engineering assets",
    description: "Packages may declare simulator, toolchain, RTL, tests, examples, and hardware artifacts when available.",
  },
  {
    icon: ShieldCheck,
    title: "Reproducible archives",
    description: "Checksums, immutable versions, and preserved .xsil files make published work inspectable and citable.",
  },
] as const;

const CLI_COMMANDS = [
  "xsil search mojo",
  "xsil info mojo-v",
  "xsil install mojo-v",
  "xsil publish",
] as const;

function CardSkeleton() {
  return <div className="h-44 animate-pulse rounded-lg border border-border/60 bg-muted/40" />;
}

export function HomeIndex() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [packages, setPackages] = useState<RegistryPackage[]>([]);
  const [stats, setStats] = useState<CatalogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [catalog, catalogStats] = await Promise.all([
        fetchPackages({ limit: 80, sort: "created", order: "desc" }),
        apiCatalogStats().catch(() => null),
      ]);
      setPackages(pickDiverseHomePackages(catalog, 6));
      setStats(catalogStats);
    } catch (err) {
      console.error(err);
      setError("Could not reach the registry. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    const query = inputRef.current?.value.trim();
    router.push(query ? `/search?q=${encodeURIComponent(query)}` : "/search");
  }

  return (
    <div>
      <section className="relative overflow-hidden border-b bg-background px-4 py-12 sm:py-16">
        <CircuitBackground className="absolute inset-0 text-muted-foreground" />
        <ChipDie className="pointer-events-none absolute -right-10 top-8 h-44 w-44 text-riscv opacity-15 sm:right-8 sm:h-56 sm:w-56" />
        <div className="relative container max-w-6xl">
          <div className="max-w-3xl">
            <p className="mb-3 text-sm font-semibold text-brand-foreground">ExtenSilica Registry</p>
            <h1 className="text-4xl font-black text-foreground sm:text-5xl">
              The registry for RISC-V ISA extensions.
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Discover, package, and share RISC-V extensions using the open{" "}
              <code className="font-mono text-base text-foreground">.xsil</code> format.
            </p>

            <form onSubmit={handleSearch} className="mt-8 flex max-w-2xl gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={inputRef}
                  type="search"
                  aria-label="Search RISC-V extensions"
                  placeholder="Search Mojo-V, XThead, Zicond, vendor extensions..."
                  className="h-12 w-full rounded-md border border-input bg-background pl-12 pr-4 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              <button
                type="submit"
                className="inline-flex h-12 shrink-0 items-center gap-2 rounded-md bg-riscv px-5 text-sm font-semibold text-white transition-colors hover:bg-riscv-light"
              >
                <Search className="h-4 w-4" />
                Search
              </button>
            </form>

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <Link href="/search" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                Browse all extensions <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link href="/wizard" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                Create a package <Package className="h-3.5 w-3.5" />
              </Link>
              <code className="rounded border bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
                xsil install &lt;extension&gt;
              </code>
            </div>
          </div>
        </div>
      </section>

      {stats && (
        <section className="border-b bg-muted/20 px-4">
          <div className="container grid max-w-6xl grid-cols-3 divide-x py-5 text-center">
            <div className="px-2">
              <p className="text-2xl font-bold tabular-nums">{stats.extensions.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Extensions</p>
            </div>
            <div className="px-2">
              <p className="text-2xl font-bold tabular-nums">{(stats.versions ?? 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Versions</p>
            </div>
            <div className="px-2">
              <p className="text-2xl font-bold tabular-nums">{(stats.downloads ?? 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Downloads</p>
            </div>
          </div>
        </section>
      )}

      <section className="px-4 py-12" id="explore">
        <div className="container max-w-6xl">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-brand-foreground">Registry</p>
              <h2 className="mt-1 text-2xl font-bold">Explore extensions</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Ratified, vendor, research, and experimental work in one searchable catalog.
              </p>
            </div>
            <Link href="/search" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Browse registry <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {stats && stats.total > 0 && (
            <div className="mb-6 flex flex-wrap items-center gap-2">
              {STANDARD_STATUS_VALUES.map((status) => {
                const count = stats.byStatus[status] ?? 0;
                if (!count) return null;
                return (
                  <Link
                    key={status}
                    href={`/search?standardStatus=${status}`}
                    title={STANDARD_STATUS_INFO[status as StandardStatus].description}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs text-foreground transition-colors hover:border-riscv-accent/40"
                  >
                    <span className="font-semibold tabular-nums">{count}</span>
                    <span>{STANDARD_STATUS_INFO[status as StandardStatus].label}</span>
                  </Link>
                );
              })}
            </div>
          )}

          {error ? (
            <Alert variant="destructive" className="max-w-xl">
              <WifiOff className="h-4 w-4" />
              <AlertTitle>Connection error</AlertTitle>
              <AlertDescription className="mt-2 space-y-3">
                <p>{error}</p>
                <Button variant="secondary" size="sm" onClick={loadData} className="gap-2">
                  <RefreshCcw className="h-4 w-4" /> Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : loading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => <CardSkeleton key={index} />)}
            </div>
          ) : packages.length === 0 ? (
            <div className="rounded-lg border border-dashed py-14 text-center">
              <Archive className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="font-medium">No extensions published yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {packages.map((pkg) => <PackageCard key={pkg.id} pkg={pkg} />)}
            </div>
          )}
        </div>
      </section>

      <section className="border-y bg-muted/20 px-4 py-12">
        <div className="container max-w-6xl">
          <div className="mb-8 max-w-2xl">
            <p className="text-sm font-semibold text-brand-foreground">The .xsil format</p>
            <h2 className="mt-1 text-2xl font-bold">One archive, useful technical context</h2>
            <p className="mt-2 text-muted-foreground">
              ExtenSilica stores what extension users need to discover, inspect, install, and cite the work.
            </p>
          </div>
          <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {PACKAGE_CONTENTS.map(({ icon: Icon, title, description }) => (
              <div key={title}>
                <Icon className="mb-3 h-5 w-5 text-riscv" />
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 grid gap-2 border-t pt-6 sm:grid-cols-2 lg:grid-cols-4">
            {CLI_COMMANDS.map((command) => (
              <code key={command} className="rounded-md border bg-background px-3 py-2 text-xs text-foreground">
                {command}
              </code>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-12">
        <div className="container flex max-w-6xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-riscv" />
              <h2 className="text-xl font-bold">Improve the public catalog</h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Publish a real extension, maintain its upstream package, add artifacts, tests, specifications, or correct technical metadata.
            </p>
          </div>
          <Link
            href="/contributing"
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-md border border-riscv/30 px-4 text-sm font-semibold text-primary transition-colors hover:bg-muted"
          >
            Contributing guide
          </Link>
        </div>
      </section>
    </div>
  );
}
