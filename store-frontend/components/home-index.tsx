"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RegistryPackage,
  STANDARD_STATUS_INFO,
  STANDARD_STATUS_VALUES,
  type CatalogStats,
  type StandardStatus,
} from "@/lib/types";
import { fetchPackages, apiCatalogStats } from "@/lib/api";
import { pickDiverseHomePackages } from "@/lib/home-packages";
import { PackageCard } from "@/components/package-card";
import { XmacPortDemo } from "@/components/xmac-port-demo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Search,
  RefreshCcw,
  WifiOff,
  Package,
  GitBranch,
  Shield,
  ArrowRight,
  Cpu,
  CircuitBoard,
  Wand2,
  Layers,
  FlaskConical,
} from "lucide-react";
import { CircuitBackground, PipelineBackground, HexOverlay, ChipDie } from "@/components/circuit-bg";
import { HowItWorks } from "@/components/how-it-works";

function CardSkeleton() {
  return <div className="h-44 animate-pulse rounded-lg border border-border/60 bg-muted/40 shadow-sm" />;
}

const FEATURES = [
  {
    icon: Layers,
    title: "Port across cores",
    description:
      "Check whether an extension fits a core interface, generate an adapter when possible, and prove it with shared tests.",
  },
  {
    icon: FlaskConical,
    title: "Shared differential tests",
    description:
      "The same vectors run on the golden model, PicoRV32 PCPI, and NEORV32 CFU — bit-exact, same seed.",
  },
  {
    icon: Cpu,
    title: "Built for RISC-V",
    description:
      "Custom instructions and extension packages aimed at pre-silicon evaluation — not a generic software marketplace.",
  },
  {
    icon: Package,
    title: "Registry as memory",
    description:
      "Versions, checksums, and portability matrices record what was proven. Discovery stays secondary to the porting loop.",
  },
  {
    icon: Shield,
    title: "Honest status vocabulary",
    description:
      "Looks mappable, Adapter required, Differentially validated — never Compatible from capability flags alone.",
  },
];

const TARGETS = [
  {
    id: "reference",
    name: "Reference interpreter",
    status: "working",
    note: "Golden model",
  },
  {
    id: "picorv32-pcpi",
    name: "PicoRV32 PCPI",
    status: "working",
    note: "Verilog · Icarus",
  },
  {
    id: "neorv32-cfu",
    name: "NEORV32 CFU",
    status: "working",
    note: "VHDL · GHDL",
  },
  {
    id: "cva6-cvxif",
    name: "CVA6 / CV-X-IF",
    status: "working",
    note: "Verilog · Icarus (MVP)",
  },
  {
    id: "rocket-rocc",
    name: "Rocket / RoCC",
    status: "working",
    note: "Verilog · Icarus (MVP)",
  },
];

export function HomeIndex() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const [heroParallaxPx, setHeroParallaxPx] = useState(0);
  const [packages, setPackages] = useState<RegistryPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<CatalogStats | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [data, statsData] = await Promise.all([
        fetchPackages({ limit: 80, sort: "created", order: "desc" }),
        apiCatalogStats().catch(() => null),
      ]);
      setPackages(pickDiverseHomePackages(data, 6));
      setStats(statsData);
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
      {/* ── Hero (brand + one claim + CTAs + one visual) ── */}
      <section
        ref={heroRef}
        className="relative overflow-hidden border-b bg-gradient-to-b from-brand/30 via-brand/25 to-brand/20 px-4 pb-16 pt-14 text-center dark:from-[hsl(222_26%_11%)] dark:via-[hsl(222_28%_8%)] dark:to-[hsl(222_30%_6%)] sm:pt-16"
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
          <ChipDie className="absolute -left-10 top-10 h-48 w-48 text-riscv opacity-60 sm:left-4 sm:h-56 sm:w-56" />
          <ChipDie className="absolute -right-10 bottom-10 h-40 w-40 rotate-12 text-brand-foreground opacity-40 sm:right-8 sm:h-48 sm:w-48" />
        </div>

        <div className="relative mx-auto max-w-3xl">
          <p className="mb-4 text-sm font-semibold tracking-wide text-brand-foreground sm:text-base">
            Exten<span className="text-riscv">Silica</span>
          </p>

          <h1 className="mb-4 text-4xl font-black tracking-tighter text-foreground sm:text-5xl">
            Port RISC-V extensions{" "}
            <span className="relative inline-block">
              <span className="text-riscv-accent drop-shadow-[0_0_12px_hsl(var(--riscv-accent)/0.35)]">
                across cores
              </span>
              <span className="absolute -bottom-1 left-0 h-px w-full bg-gradient-to-r from-transparent via-riscv-accent/50 to-transparent" />
            </span>
          </h1>

          <p className="mx-auto mb-8 max-w-xl text-lg text-muted-foreground">
            Describe an extension once, check compatibility, generate target adapters, and run the
            same tests across supported cores.
          </p>

          <div className="mb-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/wizard"
              className="inline-flex h-11 items-center gap-2 rounded-md border border-transparent bg-riscv px-5 text-sm font-medium text-white transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-riscv-accent/50 hover:bg-riscv-light hover:shadow-[0_10px_28px_-6px_hsl(var(--riscv-accent)/0.35)]"
            >
              <Wand2 className="h-4 w-4" />
              Analyze an extension
            </Link>
            <a
              href="#targets"
              className="inline-flex h-11 items-center gap-2 rounded-md border border-riscv/25 bg-background/80 px-5 text-sm font-medium text-foreground transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-riscv-accent/40 hover:shadow-md"
            >
              <Layers className="h-4 w-4 text-riscv" />
              View supported targets
            </a>
          </div>

          <div className="mx-auto max-w-lg text-left">
            <XmacPortDemo />
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <HowItWorks />

      {/* ── Supported targets ── */}
      <section id="targets" className="scroll-mt-20 border-b px-4 py-14">
        <div className="container max-w-6xl">
          <div className="mb-8 max-w-2xl">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-brand-foreground">
              Target capability model
            </p>
            <h2 className="text-2xl font-bold tracking-tight">Supported targets</h2>
            <p className="mt-2 text-muted-foreground">
              Working backends have passed differential tests for the MVP instruction class.
              Placeholders stay <span className="font-medium text-foreground">Not assessed</span>{" "}
              until a backend exists.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {TARGETS.map((t) => (
              <div
                key={t.id}
                className="rounded-lg border border-riscv/15 bg-background p-4 shadow-sm"
              >
                <p className="font-mono text-xs text-muted-foreground">{t.id}</p>
                <p className="mt-1 font-semibold text-foreground">{t.name}</p>
                <p className="mt-2 text-xs text-muted-foreground">{t.note}</p>
                <p
                  className={`mt-3 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                    t.status === "working"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                      : "border-border bg-muted/50 text-muted-foreground"
                  }`}
                >
                  {t.status === "working" ? "working" : "not assessed"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why ── */}
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
              const isAnchor = title === "Port across cores";
              return (
                <div
                  key={title}
                  className={`group relative rounded-lg transition-all duration-200 ease-out will-change-transform ${
                    isAnchor
                      ? "rounded-xl border border-riscv-accent/55 bg-gradient-to-br from-riscv-accent/[0.14] via-riscv/[0.06] to-riscv-muted/30 p-6 shadow-[0_10px_32px_-8px_hsl(var(--riscv-accent)/0.14)] sm:p-7 md:min-h-[220px] md:p-8 hover:-translate-y-0.5 hover:border-riscv-accent/75 dark:from-riscv-accent/[0.12] dark:via-riscv/[0.14] dark:to-background/80"
                      : "border border-riscv/10 bg-background p-5 shadow-sm hover:-translate-y-0.5 hover:border-riscv-accent/35"
                  }`}
                >
                  <div
                    className={`mb-3 flex items-center justify-center rounded-md shadow-sm ${
                      isAnchor
                        ? "mb-4 h-12 w-12 rounded-lg border border-riscv-accent/45 bg-riscv-accent/[0.18] text-riscv-accent"
                        : "h-9 w-9 border border-riscv/25 bg-riscv/[0.07]"
                    }`}
                  >
                    <Icon
                      className={isAnchor ? "h-5 w-5" : "h-4 w-4 text-riscv"}
                      strokeWidth={isAnchor ? 2.5 : 2.25}
                    />
                  </div>
                  <h3
                    className={`mb-1 ${
                      isAnchor ? "text-lg font-bold tracking-tight text-foreground" : "font-semibold"
                    }`}
                  >
                    {title}
                  </h3>
                  <p
                    className={`leading-relaxed text-muted-foreground ${
                      isAnchor ? "text-sm sm:text-[0.9375rem]" : "text-sm"
                    }`}
                  >
                    {description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Explore packages (registry — secondary) ── */}
      <section id="explore" className="scroll-mt-20 px-4 py-14">
        <div className="container max-w-6xl">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-1 text-sm font-semibold uppercase tracking-wider text-brand-foreground">
                Explore
              </p>
              <h2 className="text-xl font-bold">Extension packages</h2>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                The registry catalogs versions and evidence. Start from a portability question —
                then browse if you need a published artifact.
              </p>
            </div>
            <Link
              href="/search"
              className="flex items-center gap-1 text-sm font-medium text-riscv transition-colors hover:text-riscv-accent"
            >
              Browse registry <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <form onSubmit={handleSearch} className="mb-8 flex max-w-lg gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={inputRef}
                type="search"
                placeholder="Search packages…"
                className="h-10 w-full rounded-md border border-input bg-background pl-10 pr-4 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-md border border-riscv/20 bg-background px-4 text-sm font-medium transition-colors hover:border-riscv-accent/40"
            >
              Search
            </button>
          </form>

          {stats && stats.total > 0 && (
            <div className="mb-6 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs text-muted-foreground">
                {stats.total.toLocaleString()} tracked
              </span>
              {STANDARD_STATUS_VALUES.map((s) => {
                const count = stats.byStatus[s] ?? 0;
                if (!count) return null;
                return (
                  <Link
                    key={s}
                    href={`/search?standardStatus=${s}`}
                    title={STANDARD_STATUS_INFO[s as StandardStatus].description}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-background/80 px-2.5 py-0.5 text-[11px] font-medium text-foreground/80 transition-colors hover:border-riscv-accent/40"
                  >
                    <span className="font-semibold tabular-nums">{count}</span>
                    <span>{STANDARD_STATUS_INFO[s as StandardStatus].label}</span>
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
              <p className="font-medium text-muted-foreground">No extensions published yet.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Local portability packages live under{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                  portability/packages/
                </code>{" "}
                until publish is authorized.
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

      {/* ── Soft CTA (analyze, not register) ── */}
      <section className="relative border-t bg-brand/30 px-4 py-14 text-center">
        <HexOverlay className="absolute inset-0 text-foreground" />
        <div className="relative mx-auto max-w-xl">
          <h2 className="mb-3 text-2xl font-bold">Start with a technical description</h2>
          <p className="mb-6 text-muted-foreground">
            Use the wizard to sketch operands, latency, and effects — then check a target. Account
            creation is only needed when you publish evidence.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/wizard"
              className="inline-flex h-11 items-center gap-2 rounded-md border border-transparent bg-riscv px-5 text-sm font-medium text-white transition-all hover:-translate-y-0.5 hover:bg-riscv-light"
            >
              <Wand2 className="h-4 w-4" />
              Analyze an extension
            </Link>
            <Link
              href="/package/xmac"
              className="inline-flex h-11 items-center gap-2 rounded-md border border-riscv/25 bg-background/80 px-5 text-sm font-medium transition-all hover:-translate-y-0.5"
            >
              <GitBranch className="h-4 w-4 text-riscv" />
              See XMAC matrix
            </Link>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            Offline engine:{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono">
              portability/bin/xsil-port
            </code>
            . Registry CLI remains{" "}
            <a
              href="https://crates.io/crates/xsil"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-riscv-accent underline-offset-4 hover:underline"
            >
              xsil
            </a>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
