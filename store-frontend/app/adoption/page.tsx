import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage, InfoSection, InfoStrong } from "@/components/info-page";
import { AdoptionDailyChart } from "@/components/adoption-daily-chart";
import { fetchAdoptionStats } from "@/lib/api";
import {
  formatPackageListLabel,
  packageNamesDiffer,
} from "@/lib/package-display";

export const metadata: Metadata = {
  title: "Adoption — ExtenSilica",
  description:
    "Public registry adoption metrics: package page views, downloads, and trending packages.",
};

const EARLY_ADOPTION_NOTE =
  "The registry opened publicly in May 2026. Totals are still early — metrics will become more meaningful as community usage grows.";

function fmtNum(n: number) {
  return n.toLocaleString();
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-5">
      <p className="text-3xl font-extrabold tabular-nums">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

export default async function AdoptionPage() {
  const stats = await fetchAdoptionStats(30);

  const viewsWindow = stats?.views.windowTotal ?? 0;
  const views7 = stats?.views.last7Days ?? 0;
  const views30 = stats?.views.last30Days ?? 0;
  const showSeparateViewWindows =
    stats != null && (views7 !== viewsWindow || views30 !== viewsWindow);

  const topPackages = (stats?.topPackagesByViews ?? []).slice(0, 5);

  return (
    <InfoPage
      title="Adoption"
      subtitle="Transparent registry usage for stewards, contributors, and foundation discussions."
      updated="May 2026"
      note={EARLY_ADOPTION_NOTE}
      current="/adoption"
    >
      <div className="space-y-10">
        <InfoSection id="about" title="What we measure">
          <p>
            These metrics support <InfoStrong>adoption conversations</InfoStrong> with
            the community and future neutral stewards. They are not billing or
            marketplace data.
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>
              <InfoStrong>Page views</InfoStrong> — counted when someone loads a public
              package page (daily buckets per package).
            </li>
            <li>
              <InfoStrong>Downloads</InfoStrong> — counted when a version artifact is
              downloaded from the registry.
            </li>
          </ul>
        </InfoSection>

        {!stats ? (
          <div className="rounded-lg border border-dashed bg-muted/20 py-12 text-center text-sm text-muted-foreground">
            Adoption metrics are temporarily unavailable. Try again later or check{" "}
            <Link href="/search" className="text-primary underline">
              browse the registry
            </Link>
            .
          </div>
        ) : (
          <>
            <section className="space-y-4">
              <h2 className="text-lg font-semibold">
                Snapshot — last {stats.days} days
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard
                  label="Packages in catalog"
                  value={fmtNum(stats.totalPackages)}
                />
                <StatCard
                  label={`Page views (${stats.days}d)`}
                  value={fmtNum(viewsWindow)}
                />
                <StatCard
                  label={`Downloads (${stats.days}d)`}
                  value={fmtNum(stats.downloads.windowTotal)}
                />
              </div>
              {showSeparateViewWindows ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <StatCard label="Views (7d)" value={fmtNum(views7)} />
                  <StatCard label="Views (30d)" value={fmtNum(views30)} />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  All recorded views in this window fall within the last {stats.days}{" "}
                  days since public launch.
                </p>
              )}
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Daily page views</h2>
              <AdoptionDailyChart
                history={stats.views.daily}
                unitLabel="views"
              />
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Daily downloads</h2>
              <AdoptionDailyChart
                history={stats.downloads.daily}
                unitLabel="downloads"
              />
            </section>

            {topPackages.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-lg font-semibold">Recently viewed packages</h2>
                <ul className="divide-y rounded-lg border">
                  {topPackages.map((row) => (
                    <li
                      key={row.slug}
                      className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                    >
                      <Link
                        href={`/package/${row.slug}`}
                        className="min-w-0 font-medium hover:underline"
                      >
                        {formatPackageListLabel(row.name, row.slug)}
                        {packageNamesDiffer(row.name, row.slug) ? (
                          <span className="ml-2 font-mono text-xs text-muted-foreground">
                            {row.slug}
                          </span>
                        ) : null}
                      </Link>
                      {row.viewsInWindow > 1 ? (
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {fmtNum(row.viewsInWindow)} views
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        <InfoSection id="api" title="API">
          <p className="text-sm text-muted-foreground">
            Aggregated JSON is available at{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              GET /stats/adoption?days=30
            </code>{" "}
            (max 90 days). Use it for dashboards and steward reports; do not treat it
            as a payment or entitlement signal.
          </p>
        </InfoSection>
      </div>
    </InfoPage>
  );
}
