"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  CircuitBoard,
  Cpu,
  GitBranch,
  Lock,
  Package,
  RefreshCcw,
  Search,
  ShieldCheck,
  Terminal,
  Wand2,
  WifiOff,
  Zap,
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
import { HeroTerminal } from "@/components/hero-terminal";
import { HowItWorks } from "@/components/how-it-works";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  CircuitBackground,
  ChipDie,
  HexOverlay,
  PipelineBackground,
} from "@/components/circuit-bg";

const PACKAGE_CONTENTS = [
  {
    icon: Cpu,
    title: "Built for RISC-V",
    description:
      "A public catalog focused specifically on RISC-V ISA extensions, from ratified standards to experimental work.",
  },
  {
    icon: Package,
    title: "Open .xsil format",
    description:
      "Package extension metadata, documentation, and optional engineering artifacts in one inspectable archive.",
  },
  {
    icon: BookOpen,
    title: "Provenance included",
    description:
      "Upstream links, authorship, licensing, ISA requirements, encodings, and dependencies stay attached to the work.",
  },
  {
    icon: GitBranch,
    title: "Versioned publishing",
    description:
      "Every release has a canonical name, immutable version, checksum, and permanent registry page.",
  },
  {
    icon: ShieldCheck,
    title: "Technical assets welcome",
    description:
      "Simulator, toolchain, RTL, tests, examples, and hardware links can be included when a package has them.",
  },
] as const;

function CardSkeleton() {
  return <div className="h-44 animate-pulse rounded-lg border border-border/60 bg-muted/40 shadow-sm" />;
}

export function HomeIndex() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const [heroParallaxPx, setHeroParallaxPx] = useState(0);
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
      setPackages(
        pickDiverseHomePackages(
          catalog.filter((pkg) => pkg.slug !== "xmac"),
          6,
        ),
      );
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

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const hero = heroRef.current;
        if (!hero) return;
        const rect = hero.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) return;
        setHeroParallaxPx(Math.max(-16, Math.min(16, Math.round(rect.top * 0.032))));
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    const query = inputRef.current?.value.trim();
    router.push(query ? `/search?q=${encodeURIComponent(query)}` : "/search");
  }

  return (
    <div>
      <section
        ref={heroRef}
        className="relative overflow-hidden border-b bg-gradient-to-b from-brand/30 via-brand/25 to-brand/20 px-4 py-16 text-center dark:from-[hsl(222_26%_11%)] dark:via-[hsl(222_28%_8%)] dark:to-[hsl(222_30%_6%)] sm:py-20"
      >
        <div
          className="pointer-events-none absolute inset-0 will-change-transform"
          style={{ transform: `translate3d(0, ${heroParallaxPx}px, 0)` }}
        >
          <PipelineBackground className="absolute inset-0 h-full w-full" />
          <HexOverlay variant="hero" className="absolute inset-0 text-foreground" />
        </div>
        <div
          className="pointer-events-none absolute inset-0 will-change-transform"
          style={{ transform: `translate3d(0, ${Math.round(heroParallaxPx * 0.55)}px, 0)` }}
        >
          <ChipDie className="absolute -left-12 top-12 h-48 w-48 text-riscv opacity-60 sm:left-4 sm:h-56 sm:w-56" />
          <ChipDie className="absolute -right-12 bottom-12 h-40 w-40 rotate-12 text-brand-foreground opacity-40 sm:right-8 sm:h-48 sm:w-48" />
        </div>

        <div className="relative mx-auto max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-riscv/30 bg-riscv/10 px-3.5 py-1 text-xs font-medium text-riscv">
            <span className="font-mono">.xsil</span>
            <span className="text-riscv/40">|</span>
            <span>open format</span>
            <span className="text-riscv/40">|</span>
            <Cpu className="h-3 w-3 text-riscv-accent" />
            <span className="text-riscv-accent">RISC-V</span>
          </div>

          <h1 className="text-5xl font-black text-foreground sm:text-6xl">
            Exten<span className="text-riscv-accent drop-shadow-[0_0_12px_hsl(var(--riscv-accent)/0.35)]">Silica</span>
          </h1>
          <p className="mt-4 text-xl font-semibold text-foreground sm:text-2xl">
            The registry for RISC-V ISA extensions.
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Discover, package, and share RISC-V extensions using the open{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">.xsil</code>{" "}
            format.
          </p>

          <form onSubmit={handleSearch} className="mx-auto mt-8 flex max-w-xl flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={inputRef}
                type="search"
                aria-label="Search RISC-V extensions"
                placeholder="Search extensions, vendors, or specifications..."
                className="h-11 w-full rounded-md border border-input bg-background pl-10 pr-4 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-transparent bg-riscv px-5 text-sm font-medium text-white transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-riscv-accent/50 hover:bg-riscv-light hover:shadow-[0_10px_28px_-6px_hsl(var(--riscv-accent)/0.35)]"
            >
              <Search className="h-4 w-4" />
              Search
            </button>
          </form>

          <p className="mt-4 text-sm text-muted-foreground">
            <span className="opacity-70">or</span>{" "}
            <Link
              href="/wizard"
              className="inline-flex items-center gap-1.5 font-medium text-riscv-accent underline-offset-4 hover:underline"
            >
              <Wand2 className="h-3.5 w-3.5" />
              create a .xsil package in the wizard
            </Link>
          </p>

          {stats && (
            <div className="mx-auto mt-6 flex max-w-xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span><strong className="text-foreground">{stats.extensions.toLocaleString()}</strong> extensions</span>
              <span><strong className="text-foreground">{(stats.versions ?? 0).toLocaleString()}</strong> versions</span>
              <span><strong className="text-foreground">{(stats.downloads ?? 0).toLocaleString()}</strong> downloads</span>
            </div>
          )}

          <div className="mx-auto mt-10 max-w-xl">
            <p className="mb-3 text-base font-semibold text-foreground">
              Search, inspect, and install from your terminal.
            </p>
            <HeroTerminal />
            <p className="mt-3 text-sm text-muted-foreground">
              The{" "}
              <a
                href="https://crates.io/crates/xsil"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-riscv-accent underline-offset-4 hover:underline"
              >
                xsil CLI
              </a>{" "}
              is open source and available on crates.io.
            </p>
          </div>
        </div>
      </section>

      <HowItWorks />

      <section className="relative overflow-hidden border-b px-4 py-14">
        <CircuitBackground className="absolute inset-0 text-muted-foreground" />
        <HexOverlay className="absolute inset-0 text-foreground" />
        <div className="relative container max-w-6xl">
          <div className="mb-8 flex items-center justify-center gap-2">
            <CircuitBoard className="h-4 w-4 text-riscv" />
            <h2 className="text-center text-sm font-semibold uppercase text-brand-foreground">
              Inside a .xsil package
            </h2>
            <CircuitBoard className="h-4 w-4 text-riscv" />
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {PACKAGE_CONTENTS.map(({ icon: Icon, title, description }) => {
              const highlighted = title === "Built for RISC-V";
              return (
                <div
                  key={title}
                  className={`group relative rounded-lg border p-5 transition-all duration-200 ease-out hover:-translate-y-0.5 ${
                    highlighted
                      ? "border-riscv-accent/55 bg-riscv-accent/[0.08] shadow-[0_10px_32px_-8px_hsl(var(--riscv-accent)/0.14)] hover:border-riscv-accent/75"
                      : "border-riscv/10 bg-background shadow-sm hover:border-riscv-accent/35 hover:shadow-[0_10px_28px_-8px_hsl(var(--riscv-accent)/0.1)]"
                  }`}
                >
                  <div className={`absolute -top-px left-6 right-6 h-px bg-gradient-to-r from-transparent ${highlighted ? "via-riscv-accent/55" : "via-riscv/30"} to-transparent`} />
                  <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-md border ${highlighted ? "border-riscv-accent/45 bg-riscv-accent/[0.16] text-riscv-accent" : "border-riscv/25 bg-riscv/[0.07] text-riscv"}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-foreground">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-b bg-riscv px-4 py-3">
        <div className="container max-w-6xl">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-[11px] font-medium text-white/75">
            <span className="flex items-center gap-1.5"><Cpu className="h-3 w-3" /> RV32I</span>
            <span className="text-white/30">|</span>
            <span className="flex items-center gap-1.5"><Cpu className="h-3 w-3" /> RV64GC</span>
            <span className="text-white/30">|</span>
            <span className="flex items-center gap-1.5"><Zap className="h-3 w-3" /> RVV 1.0</span>
            <span className="text-white/30">|</span>
            <span className="flex items-center gap-1.5"><Lock className="h-3 w-3" /> CRYPTO</span>
            <span className="text-white/30">|</span>
            <span className="flex items-center gap-1.5"><Cpu className="h-3 w-3" /> CUSTOM ISA</span>
          </div>
        </div>
      </section>

      <section className="px-4 py-14" id="explore">
        <div className="container max-w-6xl">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-brand-foreground">Registry</p>
              <h2 className="mt-1 text-2xl font-bold">Latest extensions</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Ratified, vendor, research, and experimental work in one searchable catalog.
              </p>
            </div>
            <Link href="/search" className="inline-flex items-center gap-1 text-sm font-medium text-riscv hover:text-riscv-accent">
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
            <div className="rounded-lg border border-dashed border-riscv-accent/25 bg-riscv/[0.02] py-16 text-center">
              <Package className="mx-auto mb-3 h-8 w-8 text-riscv/30" />
              <p className="font-medium text-muted-foreground">No extensions published yet.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Publish the first package with{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">xsil publish</code>
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {packages.map((pkg) => <PackageCard key={pkg.id} pkg={pkg} />)}
            </div>
          )}
        </div>
      </section>

      <section className="relative border-t bg-brand/30 px-4 py-14 text-center">
        <HexOverlay className="absolute inset-0 text-foreground" />
        <div className="relative mx-auto max-w-2xl">
          <h2 className="text-2xl font-bold">Publish an extension package</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Create a manifest, attach the technical context you have, and publish an immutable version to the public registry.
          </p>
          <div className="mt-6 inline-flex flex-col gap-1.5 rounded-lg border border-border/80 bg-[hsl(222_30%_8%)] px-5 py-3 text-left font-mono text-sm text-gray-200 shadow-lg dark:bg-[hsl(222_40%_6%)]">
            <p><span className="select-none text-green-400/70">$ </span><span className="text-amber-200/95">cargo install xsil</span><span className="ml-3 select-none text-gray-400"># one-time</span></p>
            <p><span className="select-none text-green-400/70">$ </span><span>xsil login &amp;&amp; xsil publish ./my-extension/</span></p>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm">
            <Link href="/wizard" className="inline-flex items-center gap-1.5 font-semibold text-riscv-accent hover:underline">
              <Wand2 className="h-4 w-4" /> Create a package
            </Link>
            <Link href="/contributing" className="inline-flex items-center gap-1.5 font-semibold text-riscv-accent hover:underline">
              <Terminal className="h-4 w-4" /> Contributing guide
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
