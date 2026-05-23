import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { fetchOrgPublic, fetchUser, fetchUserContributions } from "@/lib/api";
import type { UserContributions } from "@/lib/types";
import {
  ArrowLeft,
  Calendar,
  Download,
  Github,
  Package,
  User,
  ClipboardList,
  Send,
  ShieldCheck,
} from "lucide-react";
import { PackageCapabilityChips } from "@/components/package-capability-chips";
import { ImplementationRequestStatusBadge } from "@/components/implementation-request-status-badge";
import {
  UserProfileXsilBadges,
  UserProfileXsilSection,
} from "@/components/user-profile-xsil";

export async function generateMetadata({
  params,
}: {
  params: { username: string };
}): Promise<Metadata> {
  return {
    title: `${params.username} — ExtenSilica`,
  };
}

function fmt(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function UserProfilePage({
  params,
}: {
  params: { username: string };
}) {
  const [user, contributions] = await Promise.all([
    fetchUser(params.username).catch(() => null),
    fetchUserContributions(params.username).catch(() => null),
  ]);
  if (!user) {
    const org = await fetchOrgPublic(params.username);
    if (org) redirect(`/orgs/${params.username}`);
    notFound();
  }

  const hasContributions =
    contributions != null &&
    (contributions.requestsCreated.length > 0 ||
      contributions.submissions.length > 0 ||
      contributions.verifications.length > 0);

  return (
    <div className="container max-w-5xl px-4 py-8">
      <Link
        href="/search"
        className="mb-8 -ml-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Browse packages
      </Link>

      {/* Profile header */}
      <div className="mb-10 flex items-start gap-6">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border bg-muted text-muted-foreground">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.username}
              className="h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <User className="h-8 w-8" />
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold">@{user.username}</h1>
          {user.xsil ? <UserProfileXsilBadges xsil={user.xsil} /> : null}
          {user.bio && (
            <p className="mt-1 text-muted-foreground">{user.bio}</p>
          )}
          {user.implementerBio && (
            <p className="mt-2 text-sm text-muted-foreground">{user.implementerBio}</p>
          )}
          {user.implementerGithubUrl && (
            <a
              href={user.implementerGithubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <Github className="h-4 w-4" />
              GitHub
            </a>
          )}
          <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            Joined {fmt(user.createdAt)}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-background p-4 text-center">
          <Package className="mx-auto mb-1 h-5 w-5 text-muted-foreground" />
          <p className="text-2xl font-bold">{user.packages.length}</p>
          <p className="text-xs text-muted-foreground">
            package{user.packages.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="rounded-lg border bg-background p-4 text-center">
          <Download className="mx-auto mb-1 h-5 w-5 text-muted-foreground" />
          <p className="text-2xl font-bold">
            {user.packages
              .reduce((sum, p) => sum + p.totalDownloads, 0)
              .toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">total downloads</p>
        </div>
        <div className="hidden rounded-lg border bg-background p-4 text-center sm:block">
          <Download className="mx-auto mb-1 h-5 w-5 text-muted-foreground" />
          <p className="text-2xl font-bold">
            {user.packages
              .reduce((sum, p) => sum + p.weeklyDownloads, 0)
              .toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">downloads this week</p>
        </div>
      </div>

      {/* Packages */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">
          Published packages
        </h2>

        {user.packages.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/20 py-16 text-center">
            <p className="text-muted-foreground">No packages published yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {user.packages.map((pkg) => (
              <Link
                key={pkg.slug}
                href={`/package/${pkg.slug}`}
                className="flex items-start justify-between rounded-lg border bg-background p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0 flex-1 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{pkg.name || pkg.slug}</span>
                    {pkg.latestVersion && (
                      <span className="rounded-full border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                        {pkg.latestVersion}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                    {pkg.description || "No description."}
                  </p>
                  <PackageCapabilityChips
                    level={pkg.readinessLevel ?? pkg.maturityLevel}
                    badges={pkg.capabilityBadges}
                    maxBadges={4}
                  />
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-medium">
                    {pkg.totalDownloads.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">downloads</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {hasContributions && contributions && (
        <ContributionsSection
          contributions={contributions}
          fmt={fmt}
          showXsilLink={Boolean(user.xsil && user.xsil.totalEarned > 0)}
        />
      )}

      {user.xsil ? <UserProfileXsilSection xsil={user.xsil} /> : null}
    </div>
  );
}

function ContributionsSection({
  contributions,
  fmt,
  showXsilLink,
}: {
  contributions: UserContributions;
  fmt: (d: string) => string;
  showXsilLink?: boolean;
}) {
  return (
    <section className="mt-12 border-t pt-10">
      <ContributionsHeader />
      <p className="mb-6 text-sm text-muted-foreground">
        Public technical coordination on ExtenSilica — cite this profile URL on a CV or grant.
        {showXsilLink ? (
          <>
            {" "}
            <a href="#xsil-grants" className="text-primary underline">
              View XSIL governance grants
            </a>
            .
          </>
        ) : null}
      </p>

      {contributions.requestsCreated.length > 0 && (
        <ContributionBlock title="Requests filed" icon={ClipboardList}>
          <ul className="space-y-2">
            {contributions.requestsCreated.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/requests/${r.id}`}
                  className="block rounded-lg border bg-background p-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.title}</span>
                    <ImplementationRequestStatusBadge status={r.status} />
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {r.packageSlug} · {fmt(r.createdAt)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </ContributionBlock>
      )}

      {contributions.submissions.length > 0 && (
        <ContributionBlock title="Deliverables submitted" icon={Send}>
          <ul className="space-y-2">
            {contributions.submissions.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/requests/${s.requestId}`}
                  className="block rounded-lg border bg-background p-3 hover:bg-muted/30 transition-colors"
                >
                  <p className="font-medium">{s.requestTitle}</p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {s.packageSlug}
                    {s.submittedAt && ` · submitted ${fmt(s.submittedAt)}`}
                  </p>
                  {s.latestVerificationOutcome && (
                    <p className="mt-1 text-[11px]">
                      Verification:{" "}
                      <span
                        className={
                          s.latestVerificationOutcome === "pass"
                            ? "text-emerald-700"
                            : "text-amber-700"
                        }
                      >
                        {s.latestVerificationOutcome}
                      </span>
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </ContributionBlock>
      )}

      {contributions.verifications.length > 0 && (
        <ContributionBlock title="Verifications performed" icon={ShieldCheck}>
          <ul className="space-y-2">
            {contributions.verifications.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/requests/${v.requestId}`}
                  className="block rounded-lg border bg-background p-3 hover:bg-muted/30 transition-colors"
                >
                  <p className="font-medium">{v.requestTitle}</p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {v.packageSlug} · {fmt(v.createdAt)}
                  </p>
                  <p className="mt-1 text-[11px]">
                    Outcome:{" "}
                    <span
                      className={
                        v.outcome === "pass" ? "text-emerald-700" : "text-amber-700"
                      }
                    >
                      {v.outcome}
                    </span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </ContributionBlock>
      )}
    </section>
  );
}

function ContributionsHeader() {
  return (
    <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
      <ClipboardList className="h-5 w-5 text-primary" />
      Implementation contributions
    </h2>
  );
}

function ContributionBlock({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof ClipboardList;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {title}
      </h3>
      {children}
    </div>
  );
}
