import Link from "next/link";
import { RegistryPackage } from "@/lib/types";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertTriangle, Download, Cpu } from "lucide-react";
import {
  computeCapabilityBadges,
  displayReadinessLevel,
  executionIndicatesTests,
} from "@/lib/xsil-parser";
import { PackageCapabilityChips } from "@/components/package-capability-chips";
import { StandardStatusBadge } from "@/components/standard-status-badge";
import { PortStatusBadge } from "@/components/port-status-badge";

const ISA_KEYWORDS: Record<string, string> = {
  rvv: "RVV",
  vector: "RVV",
  rv32: "RV32",
  rv64: "RV64",
  rv64gc: "RV64GC",
  rv32i: "RV32I",
};

function deriveIsaLabel(pkg: RegistryPackage): string {
  const latest = pkg.versions?.[0];
  if (latest?.isa) return latest.isa;

  const kws = (pkg.keywords ?? []).map((k) => k.toLowerCase());
  for (const kw of kws) {
    if (ISA_KEYWORDS[kw]) return ISA_KEYWORDS[kw];
  }
  return "RISC-V extension";
}

export function PackageCard({ pkg }: { pkg: RegistryPackage }) {
  const summary = pkg.shortDescription || pkg.description || "No description.";
  const version = pkg.latestVersion || pkg.version || null;
  const keywords = pkg.keywords?.slice(0, 3) ?? [];
  const isaLabel = deriveIsaLabel(pkg);
  const hasSpecificIsa = isaLabel !== "RISC-V extension";
  const latest = pkg.versions?.[0];
  const maturity = computeCapabilityBadges({
    isa: latest?.isa ?? null,
    toolchain: latest?.toolchain ?? null,
    targetsRaw: latest?.targets ?? null,
    resolutionMode: latest?.resolutionMode ?? null,
    dependenciesRaw: latest?.dependencies ?? null,
    hasTests: executionIndicatesTests(latest?.execution ?? null),
  });
  const readinessLevel = displayReadinessLevel(latest, maturity.level);

  return (
    <Link href={`/package/${pkg.slug}`} className="group block h-full">
      <Card className={`flex h-full flex-col border-border/80 shadow-sm transition-all duration-200 ease-out will-change-transform group-hover:-translate-y-0.5 group-hover:border-riscv-accent/45 group-hover:shadow-[0_12px_32px_-8px_hsl(var(--riscv-accent)/0.14)] ${pkg.isDeprecated ? "opacity-75" : ""}`}>
        {pkg.isDeprecated && (
          <div className="flex items-center gap-1.5 rounded-t-lg border-b border-amber-200 bg-amber-50 px-3 py-1.5 dark:border-amber-800 dark:bg-amber-950/40">
            <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
              deprecated
            </span>
          </div>
        )}
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="line-clamp-1 text-base font-bold">{pkg.name}</CardTitle>
            {version && (
              <span className="shrink-0 rounded-full border border-riscv/15 bg-riscv/[0.06] px-2 py-0.5 font-mono text-[10px] font-medium text-riscv">
                {version}
              </span>
            )}
          </div>
          {pkg.org && (
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              <span className="font-mono">@{pkg.org.slug}</span>
              <span className="mx-1">·</span>
              <span>{pkg.org.displayName}</span>
            </p>
          )}
          <PackageCapabilityChips level={readinessLevel} badges={maturity.badges} />
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <StandardStatusBadge
              status={pkg.standardStatus ?? null}
              authority={pkg.authority ?? null}
              variant="compact"
            />
            <PortStatusBadge
              status={pkg.portStatus ?? null}
              variant="compact"
              hideWhenUnset
            />
            {hasSpecificIsa && (
              <span className="inline-flex w-fit items-center gap-1 rounded-full border border-riscv/20 bg-riscv/[0.06] px-1.5 py-0.5 text-[9px] font-medium tracking-wide text-riscv">
                <Cpu className="h-2.5 w-2.5" strokeWidth={2.25} />
                {isaLabel}
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex-1 pb-3">
          <p className="text-sm leading-relaxed text-muted-foreground line-clamp-3">
            {summary}
          </p>
          {keywords.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {keywords.map((kw) => (
                <span
                  key={kw}
                  className="rounded-md border bg-muted/50 px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                >
                  {kw}
                </span>
              ))}
            </div>
          )}
        </CardContent>

        <CardFooter className="flex items-center justify-between border-t border-border/60 pt-3">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Download className="h-3 w-3" />
            {pkg.totalDownloads.toLocaleString()}
          </span>
          <span className="text-xs font-medium text-riscv-accent opacity-0 transition-opacity group-hover:opacity-100">
            View →
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
}
