import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { fetchOrgPublic, fetchUser } from "@/lib/api";
import {
  ArrowLeft,
  Calendar,
  Download,
  Github,
  Package,
  User,
} from "lucide-react";
import { PackageCapabilityChips } from "@/components/package-capability-chips";

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
  const user = await fetchUser(params.username).catch(() => null);
  if (!user) {
    const org = await fetchOrgPublic(params.username);
    if (org) redirect(`/orgs/${params.username}`);
    notFound();
  }

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
    </div>
  );
}
