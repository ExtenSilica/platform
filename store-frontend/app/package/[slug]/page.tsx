import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";

import { fetchPackage, fetchPackageReviews, fetchPackageStats } from "@/lib/api";
import type { RegistryVersion, Review, PackageStats } from "@/lib/types";
import {
  targetsDisplayFromJson,
  toolchainToString,
  computeCapabilityBadges,
  executionIndicatesTests,
} from "@/lib/xsil-parser";
import { CopyButton } from "@/components/copy-button";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/components/star-rating";
import { ReviewsSection } from "@/components/reviews-section";
import {
  ArrowLeft,
  AlertTriangle,
  GitBranch,
  ExternalLink,
  Calendar,
  Scale,
  Cpu,
  Tag,
  Terminal,
  User,
  Wrench,
  BookOpen,
  History,
  BarChart2,
  Sparkles,
} from "lucide-react";

/* ─── helpers ─────────────────────────────────────────────────────────────── */

function fmt(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtShort(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

function fmtNum(n: number) {
  return n.toLocaleString();
}

/* ─── metadata ──────────────────────────────────────────────────────────────*/

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const pkg = await fetchPackage(params.slug).catch(() => null);
  if (!pkg) return { title: "Not found — ExtenSilica" };
  return {
    title: `${pkg.name} — ExtenSilica`,
    description: pkg.description || pkg.shortDescription || undefined,
  };
}

/* ─── Section anchor wrapper ──────────────────────────────────────────────── */

function Section({
  id,
  title,
  icon: Icon,
  children,
}: {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 border-t pt-10 first:border-0 first:pt-0">
      <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {title}
      </h2>
      {children}
    </section>
  );
}

/* ─── Sidebar card ─────────────────────────────────────────────────────────── */

function SideCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */

export default async function PackagePage({
  params,
}: {
  params: { slug: string };
}) {
  const [pkg, reviews, stats] = await Promise.all([
    fetchPackage(params.slug).catch(() => null),
    fetchPackageReviews(params.slug).catch((): Review[] => []),
    fetchPackageStats(params.slug).catch((): PackageStats | null => null),
  ]);

  if (!pkg) notFound();

  const latest: RegistryVersion | undefined = pkg.versions?.[0];
  const keywords = pkg.keywords ?? [];
  const targetsUi = targetsDisplayFromJson(latest?.targets ?? null);
  const maturity = computeCapabilityBadges({
    isa: latest?.isa ?? null,
    toolchain: latest?.toolchain ?? null,
    targetsRaw: latest?.targets ?? null,
    resolutionMode: latest?.resolutionMode ?? null,
    dependenciesRaw: latest?.dependencies ?? null,
    hasTests: executionIndicatesTests(latest?.execution ?? null),
  });
  const readme = pkg.longDescription || pkg.description || "";
  const installCmd = `xsil install ${pkg.slug}`;
  const runCmd = `xsil run ${pkg.slug}`;

  const allTimeDl  = stats?.allTime   ?? pkg.totalDownloads;
  const last7Dl    = stats?.last7Days  ?? pkg.weeklyDownloads;
  const last30Dl   = stats?.last30Days ?? null;

  const reviewCount = pkg.reviewCount ?? reviews.length;
  const avgRating = pkg.averageRating ?? (
    reviews.length
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : null
  );

  const NAV = [
    { id: "readme", label: "README" },
    { id: "versions", label: "Versions" },
    { id: "downloads", label: "Downloads" },
    { id: "reviews", label: `Reviews${reviewCount ? ` (${reviewCount})` : ""}` },
  ];

  return (
    <div className="min-h-screen">
      {/* ── Deprecation banner ──────────────────────────────────────────── */}
      {pkg.isDeprecated && (
        <div className="border-b border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40">
          <div className="container max-w-6xl px-4 py-3 flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                This package has been deprecated
              </p>
              {pkg.deprecationMessage ? (
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  {pkg.deprecationMessage}
                </p>
              ) : (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  The author has marked this package as deprecated. Use it with caution.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="border-b bg-muted/10">
        <div className="container max-w-6xl px-4 py-6">
          <Link
            href="/search"
            className="-ml-1 mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Browse packages
          </Link>

          {/* Name + badges */}
          <div className="mb-2 flex flex-wrap items-baseline gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight">{pkg.name}</h1>
            {pkg.latestVersion && (
              <Badge variant="muted" className="font-mono text-sm">
                {pkg.latestVersion}
              </Badge>
            )}
            {pkg.isDeprecated && <Badge variant="destructive">deprecated</Badge>}
            {latest?.isYanked && (
              <Badge variant="destructive">latest yanked</Badge>
            )}
          </div>

          {/* Author line */}
          {pkg.author && (
            <p className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground">
              <User className="h-3.5 w-3.5 shrink-0" />
              by{" "}
              <Link
                href={`/users/${pkg.author}`}
                className="font-medium text-foreground hover:underline"
              >
                {pkg.author}
              </Link>
            </p>
          )}

          {/* Description */}
          <p className="mb-3 max-w-2xl text-base text-muted-foreground leading-relaxed">
            {pkg.description || pkg.shortDescription || "No description provided."}
          </p>

          {/* Average rating */}
          {avgRating !== null && reviewCount > 0 && (
            <div className="mb-4 flex items-center gap-2">
              <StarRating rating={avgRating} size="sm" />
              <span className="text-sm font-semibold">
                {avgRating.toFixed(1)}
              </span>
              <span className="text-xs text-muted-foreground">
                ({reviewCount} review{reviewCount !== 1 ? "s" : ""})
              </span>
            </div>
          )}

          {/* Keywords */}
          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {keywords.map((kw) => (
                <Link
                  key={kw}
                  href={`/search?q=${encodeURIComponent(kw)}`}
                  className="flex items-center gap-1 rounded-full border bg-background px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Tag className="h-2.5 w-2.5" />
                  {kw}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ── Section nav (sticky) ──────────────────────────────────────── */}
        <nav className="sticky top-14 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="container max-w-6xl px-4">
            <div className="flex gap-0 overflow-x-auto">
              {NAV.map(({ id, label }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-4 py-3 text-sm font-medium text-muted-foreground hover:border-primary hover:text-foreground transition-colors"
                >
                  {label}
                </a>
              ))}
            </div>
          </div>
        </nav>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="container max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-10 lg:flex-row-reverse lg:gap-12">

          {/* ══ Sidebar ════════════════════════════════════════════════════ */}
          <aside className="w-full shrink-0 space-y-4 lg:w-72">

            {/* Install */}
            <SideCard title="Install">
              <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 font-mono text-sm">
                <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                  {installCmd}
                </span>
                <CopyButton text={installCmd} />
              </div>
            </SideCard>

            {/* Run */}
            <SideCard title="Run">
              <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 font-mono text-sm">
                <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                  {runCmd}
                </span>
                <CopyButton text={runCmd} />
              </div>
              {latest?.isa && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Requires ISA{" "}
                  <code className="font-mono">{latest.isa}</code>
                </p>
              )}
            </SideCard>

            {/* Package metadata */}
            <SideCard title="Details">
              <div className="space-y-3">
                <Row
                  icon={<Calendar className="h-3.5 w-3.5" />}
                  label="Published"
                  value={fmt(pkg.createdAt)}
                />
                {pkg.latestVersion && (
                  <Row
                    icon={<Tag className="h-3.5 w-3.5" />}
                    label="Latest"
                    value={<code className="font-mono">{pkg.latestVersion}</code>}
                  />
                )}
                {latest?.isa && (
                  <Row
                    icon={<Cpu className="h-3.5 w-3.5" />}
                    label="ISA"
                    value={<code className="font-mono">{latest.isa}</code>}
                  />
                )}
                {maturity.badges.length > 0 && (
                  <Row
                    icon={<Sparkles className="h-3.5 w-3.5" />}
                    label="Maturity"
                    value={
                      <div className="space-y-2">
                        <div className="text-xs text-muted-foreground">
                          Level <span className="font-mono">{maturity.level}</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {maturity.badges.map((b) => (
                            <Badge key={b} variant="secondary" className="text-[10px]">
                              {b}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    }
                  />
                )}
                {latest?.toolchain && (
                  <Row
                    icon={<Wrench className="h-3.5 w-3.5" />}
                    label="Toolchain"
                    value={
                      <span className="break-words font-mono text-xs leading-snug">
                        {toolchainToString(latest.toolchain)}
                      </span>
                    }
                  />
                )}
                {targetsUi.badges.length > 0 && (
                  <Row
                    icon={<Terminal className="h-3.5 w-3.5" />}
                    label="Targets"
                    value={
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1">
                          {targetsUi.badges.map((id) => (
                            <Badge
                              key={id}
                              variant="outline"
                              className="font-mono text-[10px]"
                            >
                              {id}
                            </Badge>
                          ))}
                        </div>
                        {targetsUi.pretty && (
                          <pre className="max-h-48 max-w-full overflow-auto rounded-md border bg-muted/30 p-2 text-left font-mono text-[10px] leading-snug text-muted-foreground">
                            {targetsUi.pretty}
                          </pre>
                        )}
                      </div>
                    }
                  />
                )}
                {pkg.license && (
                  <Row
                    icon={<Scale className="h-3.5 w-3.5" />}
                    label="License"
                    value={pkg.license}
                  />
                )}
              </div>
            </SideCard>

            {/* Downloads quick view */}
            <SideCard title="Downloads">
              <div className="grid grid-cols-2 gap-3">
                <StatBox label="7 days"  value={fmtNum(last7Dl)} />
                {last30Dl !== null ? (
                  <StatBox label="30 days"  value={fmtNum(last30Dl)} />
                ) : (
                  <StatBox label="All time" value={fmtNum(allTimeDl)} />
                )}
              </div>
            </SideCard>

            {/* Maintainers */}
            {pkg.author && (
              <SideCard title="Maintainers">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border bg-muted text-[10px] font-bold uppercase text-muted-foreground">
                    {pkg.author.charAt(0)}
                  </div>
                  <Link
                    href={`/users/${pkg.author}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {pkg.author}
                  </Link>
                </div>
              </SideCard>
            )}

            {/* Links */}
            {(pkg.repositoryUrl || pkg.homepageUrl) && (
              <SideCard title="Links">
                <div className="space-y-2">
                  {pkg.repositoryUrl && (
                    <a
                      href={pkg.repositoryUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <GitBranch className="h-3.5 w-3.5 shrink-0" />
                      Repository
                      <ExternalLink className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />
                    </a>
                  )}
                  {pkg.homepageUrl && (
                    <a
                      href={pkg.homepageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      Homepage
                      <ExternalLink className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />
                    </a>
                  )}
                </div>
              </SideCard>
            )}
          </aside>

          {/* ══ Main content ══════════════════════════════════════════════ */}
          <main className="min-w-0 flex-1 space-y-0">

            {/* ── README ── */}
            <Section id="readme" title="README" icon={BookOpen}>
              {readme ? (
                <article className="prose prose-neutral dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:font-mono prose-code:text-sm prose-code:before:content-none prose-code:after:content-none prose-pre:rounded-lg prose-pre:border prose-pre:bg-muted/50 prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
                  <ReactMarkdown>{readme}</ReactMarkdown>
                </article>
              ) : (
                <p className="rounded-lg border border-dashed bg-muted/20 py-10 text-center text-sm text-muted-foreground">
                  No README provided.
                </p>
              )}
            </Section>

            {/* ── Versions ── */}
            <Section id="versions" title="Version History" icon={History}>
              {pkg.versions.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground uppercase tracking-wide">
                        <th className="px-4 py-3 font-medium">Version</th>
                        <th className="px-4 py-3 font-medium">Published</th>
                        <th className="px-4 py-3 font-medium hidden sm:table-cell">Size</th>
                        <th className="px-4 py-3 font-medium hidden md:table-cell">Downloads</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pkg.versions.map((v, i) => {
                        const isLatest = v.version === pkg.latestVersion;
                        const changelogLine = v.changelog?.split("\n")[0]?.trim();
                        const installCmd = `xsil install ${pkg.slug}@${v.version}`;
                        return (
                          <tr
                            key={v.id}
                            className={`group ${i < pkg.versions.length - 1 ? "border-b" : ""} ${v.isYanked ? "opacity-55" : ""}`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono font-medium">{v.version}</span>
                                {isLatest && (
                                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                    latest
                                  </span>
                                )}
                                {v.isYanked && (
                                  <span
                                    className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive"
                                    title={v.yankReason ?? undefined}
                                  >
                                    yanked
                                  </span>
                                )}
                              </div>
                              {changelogLine && (
                                <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">
                                  {changelogLine}
                                </p>
                              )}
                              <div className="mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                                  {installCmd}
                                </code>
                                <CopyButton text={installCmd} />
                              </div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                              {fmtShort(v.publishedAt)}
                            </td>
                            <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell whitespace-nowrap">
                              {v.size ? fmtBytes(v.size) : "—"}
                            </td>
                            <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                              {fmtNum(v.downloadCount)}
                            </td>
                            <td className="px-4 py-3">
                              {v.isYanked ? (
                                <span
                                  className="text-xs text-destructive"
                                  title={v.yankReason ?? undefined}
                                >
                                  yanked
                                </span>
                              ) : (
                                <span className="text-xs text-emerald-600 dark:text-emerald-400">
                                  active
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No versions published yet.</p>
              )}
            </Section>

            {/* ── Downloads ── */}
            <Section id="downloads" title="Downloads" icon={BarChart2}>
              <div className="space-y-6">
                {/* Stat cards */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <BigStat label="Last 7 days"  value={fmtNum(last7Dl)} />
                  {last30Dl !== null && (
                    <BigStat label="Last 30 days" value={fmtNum(last30Dl)} />
                  )}
                  <BigStat label="All time" value={fmtNum(allTimeDl)} />
                </div>

                {/* 30-day daily chart */}
                {stats?.dailyHistory && stats.dailyHistory.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Daily downloads — last 30 days
                    </h3>
                    <DailyChart history={stats.dailyHistory} />
                  </div>
                )}

                {/* Per-version breakdown from stats or version download counters */}
                {(stats?.byVersion?.length || pkg.versions.length > 0) && (
                  <div>
                    <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      By version
                    </h3>
                    <VersionBreakdown
                      versions={pkg.versions}
                      byVersion={stats?.byVersion ?? null}
                      allTime={allTimeDl}
                    />
                  </div>
                )}
              </div>
            </Section>

            {/* ── Reviews (interactive client component) ── */}
            <ReviewsSection slug={params.slug} initialReviews={reviews} />
          </main>
        </div>
      </div>
    </div>
  );
}

/* ─── Local sub-components ────────────────────────────────────────────────── */

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <div className="text-sm">{value}</div>
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4 text-center">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function BigStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-5">
      <p className="text-3xl font-extrabold tabular-nums">{value}</p>
      <p className="mt-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
    </div>
  );
}

function DailyChart({
  history,
}: {
  history: Array<{ day: string; count: number }>;
}) {
  const max = Math.max(...history.map((h) => h.count), 1);
  // show at most 30 bars; label every 7th day
  const bars = history.slice(-30);
  return (
    <div className="rounded-lg border bg-muted/10 p-4">
      <div className="flex h-28 items-end gap-[2px]">
        {bars.map((h) => {
          const pct = (h.count / max) * 100;
          const isZero = h.count === 0;
          return (
            <div
              key={h.day}
              className="group relative flex-1 cursor-default"
              title={`${h.day}: ${fmtNum(h.count)} download${h.count !== 1 ? "s" : ""}`}
            >
              <div
                className={`w-full rounded-sm transition-colors ${
                  isZero
                    ? "bg-muted/40"
                    : "bg-primary/50 group-hover:bg-primary"
                }`}
                style={{ height: `${Math.max(pct, isZero ? 1 : 3)}%` }}
              />
            </div>
          );
        })}
      </div>
      {/* x-axis labels every 7 days */}
      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
        {bars
          .filter((_, i) => i % 7 === 0 || i === bars.length - 1)
          .map((h) => (
            <span key={h.day}>{h.day.slice(5)}</span> // "MM-DD"
          ))}
      </div>
    </div>
  );
}

function VersionBreakdown({
  versions,
  byVersion,
  allTime,
}: {
  versions: import("@/lib/types").RegistryVersion[];
  byVersion: Array<{ version: string; count90Days: number }> | null;
  allTime: number;
}) {
  // Prefer event-based stats; fall back to cached downloadCount on Version
  const rows = byVersion && byVersion.length > 0
    ? byVersion.map((bv) => ({
        version: bv.version,
        count: bv.count90Days,
        label: "last 90 days",
      }))
    : versions.slice(0, 8).map((v) => ({
        version: v.version,
        count: v.downloadCount,
        label: "all time",
      }));

  const maxCount = Math.max(...rows.map((r) => r.count), 1);

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const pct = allTime > 0 ? Math.round((row.count / maxCount) * 100) : 0;
        return (
          <div key={row.version} className="flex items-center gap-3 text-sm">
            <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">
              {row.version}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/60 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-24 text-right text-xs text-muted-foreground">
              {fmtNum(row.count)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
