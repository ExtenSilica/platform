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
} from "lucide-react";

function CardSkeleton() {
  return <div className="h-44 animate-pulse rounded-lg border bg-muted/40" />;
}

const FEATURES = [
  {
    icon: Package,
    title: "Package registry",
    description:
      "Every .xsil package has a canonical name, version history, and a discoverable metadata page — installable in one command.",
  },
  {
    icon: GitBranch,
    title: "Versioned publishing",
    description:
      "Publish new versions with xsil publish. Each version is immutable and permanently addressable by slug@version.",
  },
  {
    icon: Shield,
    title: "Reproducible by design",
    description:
      "The manifest embeds a SHA-256 payloadHash over all package files. The CLI recomputes it on every install — if the bytes differ, execution is refused.",
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
  const [packages, setPackages] = useState<RegistryPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await fetchPackages(undefined, 6);
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
      <section className="border-b bg-muted/20 px-4 py-20 text-center">
        <div className="mx-auto max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="font-mono">.xsil</span> · RISC-V · reproducible
          </div>

          <h1 className="mb-4 text-4xl font-extrabold tracking-tight sm:text-5xl">
            The public registry for{" "}
            <span className="text-primary">.xsil packages</span>
          </h1>

          <p className="mb-8 text-lg text-muted-foreground">
            Discover, publish, and run reproducible RISC-V extensions.
            ExtenSilica is to{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">
              .xsil
            </code>{" "}
            what npmjs.com is to JavaScript.
          </p>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="mx-auto flex max-w-lg gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={inputRef}
                type="search"
                placeholder="Search packages…"
                className="h-11 w-full rounded-md border border-input bg-background pl-10 pr-4 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-11 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Search
            </button>
          </form>

          {/* Example commands */}
          <div className="mx-auto mt-8 max-w-md rounded-lg border bg-background p-4 text-left font-mono text-sm">
            <p className="mb-3 select-none text-xs uppercase tracking-wider text-muted-foreground">
              quickstart
            </p>
            {EXAMPLE_COMMANDS.map(({ cmd }) => (
              <p key={cmd} className="leading-7">
                <span className="select-none text-muted-foreground">$ </span>
                <span>{cmd}</span>
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="border-b px-4 py-14">
        <div className="container max-w-6xl">
          <p className="mb-8 text-center text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Why ExtenSilica?
          </p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-lg border bg-background p-5">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md border bg-muted">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <h3 className="mb-1 font-semibold">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Recent packages ── */}
      <section className="px-4 py-14">
        <div className="container max-w-6xl">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold">Recent packages</h2>
            <Link
              href="/search"
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Browse all <ArrowRight className="h-3.5 w-3.5" />
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
            <div className="rounded-lg border border-dashed bg-muted/20 py-16 text-center">
              <p className="text-muted-foreground">
                No packages published yet.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Be the first —{" "}
                <code className="font-mono">xsil publish ./your-package/</code>
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
      <section className="border-t bg-muted/30 px-4 py-14 text-center">
        <div className="mx-auto max-w-xl">
          <h2 className="mb-3 text-2xl font-bold">Ready to publish?</h2>
          <p className="mb-6 text-muted-foreground">
            Register an account, prepare your{" "}
            <code className="rounded bg-muted px-1.5 font-mono text-sm">
              manifest.json
            </code>
            , and run{" "}
            <code className="rounded bg-muted px-1.5 font-mono text-sm">
              xsil publish
            </code>{" "}
            — your package is indexed instantly.
          </p>
          <div className="inline-flex items-center gap-3 rounded-lg border bg-background px-5 py-3 font-mono text-sm">
            <span className="text-muted-foreground">$</span>
            <span>xsil login &amp;&amp; xsil publish ./my-pkg/</span>
          </div>
        </div>
      </section>
    </div>
  );
}
