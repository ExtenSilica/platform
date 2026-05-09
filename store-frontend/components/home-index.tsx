"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RegistryPackage } from "@/lib/types";
import { fetchPackages } from "@/lib/api";
import { PackageCard } from "@/components/package-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Search,
  RefreshCcw,
  WifiOff,
  Package,
  GitBranch,
  Shield,
  Terminal,
  ArrowRight,
  Cpu,
  Zap,
  Lock,
  CircuitBoard,
  Wand2,
} from "lucide-react";
import { CircuitBackground, PipelineBackground, HexOverlay, ChipDie } from "@/components/circuit-bg";
import { HowItWorks } from "@/components/how-it-works";

function CardSkeleton() {
  return <div className="h-44 animate-pulse rounded-lg border border-border/60 bg-muted/40 shadow-sm" />;
}

const FEATURES = [
  {
    icon: Cpu,
    title: "Built for RISC-V",
    description:
      "Designed specifically for packaging, distributing, and running RISC-V ISA extensions.",
  },
  {
    icon: Package,
    title: "Package registry",
    description:
      "Every .xsil package has a canonical name, version history, and a discoverable metadata page — install with xsil install when you are ready to run it locally.",
  },
  {
    icon: GitBranch,
    title: "Versioned publishing",
    description:
      "Publish new versions with xsil publish. Each version is immutable and permanently addressable by slug@version.",
  },
  {
    icon: Shield,
    title: "Flexible reproducibility",
    description:
      "Publish with bundled, resolved, or host-dependent resolution modes. Optional registry checks help when you mirror tool artifacts on ExtenSilica; host-provided toolchains stay in your README.",
  },
  {
    icon: Terminal,
    title: "Run from the CLI",
    description:
      "xsil run, xsil install, and xsil test work with registry slugs, local .xsil files, or unpacked directories.",
  },
];

const EXAMPLE_COMMANDS = [
  { label: "install", cmd: "xsil install rvv-demo" },
  { label: "run", cmd: "xsil run rvv-demo" },
  { label: "publish", cmd: "xsil publish ./my-extension/" },
  { label: "search", cmd: "xsil search risc-v vector" },
];

export function HomeIndex() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const [heroParallaxPx, setHeroParallaxPx] = useState(0);
  const [packages, setPackages] = useState<RegistryPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await fetchPackages({ limit: 6, sort: "downloads", order: "desc" });
      setPackages(data);
    } catch (err) {
      console.error(err);
      setError("Could not reach the registry. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = heroRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const vh = window.innerHeight;
        if (rect.bottom < 0 || rect.top > vh) return;
        const px = Math.round(rect.top * 0.032);
        setHeroParallaxPx(Math.max(-16, Math.min(16, px)));
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = inputRef.current?.value.trim();
    if (q) {
      router.push(`/search?q=${encodeURIComponent(q)}`);
    } else {
      router.push("/search");
    }
  }

  return (
    <div>
      {/* ── Hero ── */}
      <section
        ref={heroRef}
        className="relative overflow-hidden border-b bg-gradient-to-b from-brand/30 via-brand/25 to-brand/20 px-4 py-20 text-center dark:from-[hsl(222_26%_11%)] dark:via-[hsl(222_28%_8%)] dark:to-[hsl(222_30%_6%)]"
      >
        {/* Layered backdrop + light parallax (content column stays visually stable) */}
        <div
          className="pointer-events-none absolute inset-0 will-change-transform"
          style={{ transform: `translate3d(0, ${heroParallaxPx}px, 0)` }}
        >
          <PipelineBackground className="absolute inset-0 h-full w-full" />
          <HexOverlay variant="hero" className="absolute inset-0 text-foreground" />
        </div>

        {/* Chips: slightly different parallax for depth */}
        <div
          className="pointer-events-none absolute inset-0 will-change-transform"
          style={{ transform: `translate3d(0, ${Math.round(heroParallaxPx * 0.55)}px, 0)` }}
        >
          <ChipDie className="absolute -left-10 top-10 h-48 w-48 text-riscv opacity-60 sm:left-4 sm:h-56 sm:w-56" />
          <ChipDie className="absolute -right-10 bottom-10 h-40 w-40 rotate-12 text-brand-foreground opacity-40 sm:right-8 sm:h-48 sm:w-48" />
        </div>

        <div className="relative mx-auto max-w-2xl">
          {/* Badge */}
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-riscv/30 bg-riscv/10 px-3.5 py-1 text-xs font-medium text-riscv">
            <span className="font-mono">.xsil</span>
            <span className="text-riscv/40">·</span>
            <span>reproducible</span>
            <span className="text-riscv/40">·</span>
            <Cpu className="h-3 w-3 text-riscv-accent" />
            <span className="text-riscv-accent">RISC-V</span>
          </div>

          <h1 className="mb-4 text-4xl font-black tracking-tighter text-foreground sm:text-5xl">
            The pre-silicon bridge for{" "}
            <span className="relative inline-block">
              <span className="text-riscv-accent drop-shadow-[0_0_12px_hsl(var(--riscv-accent)/0.35)]">RISC-V</span>
              <span className="absolute -bottom-1 left-0 h-px w-full bg-gradient-to-r from-transparent via-riscv-accent/50 to-transparent" />
            </span>{" "}
            <span className="text-riscv-light">extensions</span>
          </h1>

          <p className="mb-8 text-lg text-muted-foreground">
            Reproducible{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">.xsil</code>{" "}
            packages for simulator, toolchain, and optional FPGA/RTL evaluation.
          </p>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="mx-auto flex max-w-lg gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={inputRef}
                type="search"
                placeholder="Search RISC-V extensions…"
                className="h-11 w-full rounded-md border border-input bg-background pl-10 pr-4 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-11 items-center rounded-md border border-transparent bg-riscv px-5 text-sm font-medium text-white transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-riscv-accent/50 hover:bg-riscv-light hover:shadow-[0_10px_28px_-6px_hsl(var(--riscv-accent)/0.35)]"
            >
              Search
            </button>
          </form>

          {/* Wizard CTA */}
          <p className="mt-4 text-sm text-muted-foreground">
            <span className="opacity-70">or</span>{" "}
            <Link
              href="/wizard"
              className="inline-flex items-center gap-1.5 font-medium text-riscv-accent underline-offset-4 hover:underline"
            >
              <Wand2 className="h-3.5 w-3.5" />
              build a runnable .xsil skeleton in the wizard
            </Link>
          </p>

          {/* Example commands — focal terminal */}
          <div className="mx-auto mt-10 max-w-lg scale-[1.08] sm:scale-100 sm:max-w-xl">
            <p className="mb-2.5 text-base font-semibold text-foreground sm:text-[1.0625rem]">
              Try a runnable extension in one command.
            </p>
            <div className="relative">
              {/* edge glow */}
              <div
                className="pointer-events-none absolute -inset-1 rounded-2xl opacity-70 blur-md sm:-inset-1.5"
                style={{
                  background:
                    "linear-gradient(145deg, hsl(var(--riscv-accent) / 0.22), transparent 42%, hsl(var(--riscv) / 0.12))",
                }}
                aria-hidden
              />
              <div className="relative overflow-hidden rounded-xl border border-border/90 text-left font-mono text-[0.9375rem] leading-relaxed shadow-[0_4px_6px_-1px_rgb(0_0_0_/_0.2),0_20px_50px_-12px_rgb(0_0_0_/_0.45),0_0_0_1px_rgb(0_0_0_/_0.08)] ring-1 ring-riscv-accent/25 ring-offset-2 ring-offset-[hsl(222_32%_97%)] transition-all duration-200 ease-out will-change-transform hover:-translate-y-0.5 hover:border-riscv-accent/45 hover:shadow-[0_8px_12px_-2px_rgb(0_0_0_/_0.22),0_24px_56px_-12px_rgb(0_0_0_/_0.48)] dark:border-border/60 dark:ring-riscv-accent/20 dark:ring-offset-background dark:hover:border-riscv-accent/35 sm:text-base sm:leading-relaxed">
              {/* terminal title bar */}
              <div className="flex items-center gap-2 border-b border-white/10 bg-muted/85 px-5 py-2.5 dark:border-white/5 dark:bg-muted/50">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-400/75 shadow-[0_0_8px_rgb(248_113_113_/_0.35)]" />
                  <span className="h-3 w-3 rounded-full bg-amber-400/75 shadow-[0_0_8px_rgb(251_191_36_/_0.3)]" />
                  <span className="h-3 w-3 rounded-full bg-emerald-400/70 shadow-[0_0_8px_rgb(52_211_153_/_0.3)]" />
                </div>
                <p className="ml-1 select-none text-[11px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">
                  quickstart — xsil
                </p>
              </div>
              {/* terminal body */}
              <div className="bg-[hsl(222_32%_7%)] px-5 py-5 text-[#e8edf5] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.04)] dark:bg-[hsl(222_38%_5%)] dark:text-[#eef2f8] sm:px-6 sm:py-6">
              {EXAMPLE_COMMANDS.map(({ cmd }) => (
                <p key={cmd} className="leading-8 tracking-tight sm:leading-9">
                  <span className="select-none font-medium text-emerald-400/95">$ </span>
                  <span className="text-[#f1f5f9]">{cmd}</span>
                </p>
              ))}
              </div>
            </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Resolved dependencies are fetched, hash-verified, and cached by the CLI.
            </p>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <HowItWorks />

      {/* ── Features ── */}
      <section className="relative overflow-hidden border-b px-4 py-14">
        <CircuitBackground className="absolute inset-0 text-muted-foreground" />
        <HexOverlay className="absolute inset-0 text-foreground" />
        <div className="relative container max-w-6xl">
          <div className="mb-8 flex items-center justify-center gap-2">
            <CircuitBoard className="h-4 w-4 text-riscv" />
            <p className="text-center text-sm font-semibold uppercase tracking-wider text-brand-foreground">
              Why ExtenSilica?
            </p>
            <CircuitBoard className="h-4 w-4 text-riscv" />
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {FEATURES.map(({ icon: Icon, title, description }) => {
              const isAnchor = title === "Built for RISC-V";
              return (
                <div
                  key={title}
                  className={`group relative rounded-lg transition-all duration-200 ease-out will-change-transform ${
                    isAnchor
                      ? "rounded-xl border border-riscv-accent/55 bg-gradient-to-br from-riscv-accent/[0.14] via-riscv/[0.06] to-riscv-muted/30 p-6 shadow-[0_10px_32px_-8px_hsl(var(--riscv-accent)/0.14)] sm:p-7 md:min-h-[220px] md:p-8 hover:-translate-y-0.5 hover:border-riscv-accent/75 hover:shadow-[0_16px_40px_-8px_hsl(var(--riscv-accent)/0.22)] dark:from-riscv-accent/[0.12] dark:via-riscv/[0.14] dark:to-background/80"
                      : "border border-riscv/10 bg-background p-5 shadow-sm hover:-translate-y-0.5 hover:border-riscv-accent/35 hover:shadow-[0_10px_28px_-8px_hsl(var(--riscv-accent)/0.1)]"
                  }`}
                >
                  <div className={`absolute -top-px left-6 right-6 h-px bg-gradient-to-r from-transparent ${isAnchor ? "via-riscv-accent/55" : "via-riscv/30"} to-transparent`} />
                  <div className={`mb-3 flex items-center justify-center rounded-md shadow-sm transition-all duration-300 ${
                    isAnchor
                      ? "mb-4 h-12 w-12 rounded-lg border border-riscv-accent/45 bg-riscv-accent/[0.18] text-riscv-accent group-hover:border-riscv-accent/60 group-hover:bg-riscv-accent/[0.24] group-hover:shadow-[0_0_14px_hsl(var(--riscv-accent)/0.28)] dark:bg-riscv-accent/[0.22] dark:text-[hsl(0_0%_100%)] dark:group-hover:bg-riscv-accent/[0.28]"
                      : "mb-3 h-9 w-9 border border-riscv/25 bg-riscv/[0.07] group-hover:border-riscv/40 group-hover:bg-riscv/[0.12] group-hover:shadow-[0_0_10px_hsl(var(--riscv)/0.15)]"
                  }`}>
                    <Icon
                      className={isAnchor ? "h-5 w-5 drop-shadow-[0_1px_2px_hsl(var(--riscv-accent)/0.35)]" : "h-4 w-4 text-riscv"}
                      strokeWidth={isAnchor ? 2.5 : 2.25}
                    />
                  </div>
                  <h3 className={`mb-1 ${isAnchor ? "text-lg font-bold tracking-tight text-foreground" : "font-semibold"}`}>{title}</h3>
                  <p className={`leading-relaxed text-muted-foreground ${isAnchor ? "text-sm sm:text-[0.9375rem]" : "text-sm"}`}>
                    {description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── ISA strip ── */}
      <section className="border-b bg-riscv px-4 py-3">
        <div className="container max-w-6xl">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-[11px] font-medium tracking-wider text-white/75">
            <span className="flex items-center gap-1.5"><Cpu className="h-3 w-3" strokeWidth={2.5} /> RV32I</span>
            <span className="text-white/30">|</span>
            <span className="flex items-center gap-1.5"><Cpu className="h-3 w-3" strokeWidth={2.5} /> RV64GC</span>
            <span className="text-white/30">|</span>
            <span className="flex items-center gap-1.5"><Zap className="h-3 w-3" strokeWidth={2.5} /> RVV 1.0</span>
            <span className="text-white/30">|</span>
            <span className="flex items-center gap-1.5"><Lock className="h-3 w-3" strokeWidth={2.5} /> Zbkb</span>
            <span className="text-white/30">|</span>
            <span className="flex items-center gap-1.5"><Cpu className="h-3 w-3" strokeWidth={2.5} /> Custom ISA</span>
          </div>
        </div>
      </section>

      {/* ── Recent packages ── */}
      <section className="px-4 py-14">
        <div className="container max-w-6xl">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold">Latest extensions</h2>
            <Link
              href="/search"
              className="flex items-center gap-1 text-sm font-medium text-riscv transition-colors hover:text-riscv-accent"
            >
              Browse registry <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {error ? (
            <Alert variant="destructive" className="max-w-xl">
              <WifiOff className="h-4 w-4" />
              <AlertTitle>Connection error</AlertTitle>
              <AlertDescription className="mt-2 space-y-3">
                <p>{error}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={loadData}
                  className="gap-2"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : loading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : packages.length === 0 ? (
            <div className="rounded-lg border border-dashed border-riscv-accent/25 bg-riscv/[0.02] py-16 text-center">
              <Cpu className="mx-auto mb-3 h-8 w-8 text-riscv/30" />
              <p className="font-medium text-muted-foreground">
                No extensions published yet.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Be the first to ship —{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">xsil publish ./my-extension/</code>
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {packages.map((pkg) => (
                <PackageCard key={pkg.id} pkg={pkg} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── CTA band ── */}
      <section className="relative border-t bg-brand/30 px-4 py-14 text-center">
        <HexOverlay className="absolute inset-0 text-foreground" />
        <div className="relative mx-auto max-w-xl">
          <h2 className="mb-3 text-2xl font-bold">Ship your extension</h2>
          <p className="mb-6 text-muted-foreground">
            Define your{" "}
            <code className="rounded bg-muted px-1.5 font-mono text-sm">
              manifest.json
            </code>
            , register your tool artifacts in ExtenSilica, then run{" "}
            <code className="rounded bg-muted px-1.5 font-mono text-sm">
              xsil publish
            </code>
            . Publish is gated until every declared dependency is verified.
          </p>
          <div className="inline-flex items-center gap-3 rounded-lg border border-border/80 bg-[hsl(222_30%_8%)] px-5 py-3 font-mono text-sm text-gray-200 shadow-lg dark:bg-[hsl(222_40%_6%)]">
            <span className="text-green-400/70">$</span>
            <span>xsil login &amp;&amp; xsil publish ./my-pkg/</span>
          </div>
        </div>
      </section>
    </div>
  );
}
