import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { apiGetOrg } from "@/lib/api";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Download,
  ExternalLink,
  Globe,
  Package,
  Shield,
  Star,
  Users,
} from "lucide-react";
import type { Organization } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  return {
    title: `@${params.slug} — ExtenSilica`,
    description: `Organization @${params.slug} on ExtenSilica`,
  };
}

function fmt(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const ROLE_BADGE: Record<string, string> = {
  owner: "bg-amber-100 text-amber-800 border-amber-200",
  admin: "bg-blue-100 text-blue-800 border-blue-200",
  member: "bg-slate-100 text-slate-700 border-slate-200",
};

async function fetchOrg(slug: string): Promise<Organization | null> {
  try {
    return await apiGetOrg(slug);
  } catch {
    return null;
  }
}

export default async function OrgPage({
  params,
}: {
  params: { slug: string };
}) {
  const org = await fetchOrg(params.slug);
  if (!org) notFound();

  const owners = org.members.filter((m) => m.role === "owner");
  const admins = org.members.filter((m) => m.role === "admin");
  const members = org.members.filter((m) => m.role === "member");

  const totalDownloads = org.packages.reduce((s, p) => s + p.totalDownloads, 0);

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-10">
      {/* Back */}
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Registry
      </Link>

      {/* Org header */}
      <div className="flex items-start gap-5">
        {org.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={org.avatarUrl}
            alt={org.displayName}
            className="w-20 h-20 rounded-xl border object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-20 h-20 rounded-xl border bg-muted flex items-center justify-center flex-shrink-0">
            <Building2 className="w-9 h-9 text-muted-foreground" />
          </div>
        )}
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{org.displayName}</h1>
            <span className="text-sm text-muted-foreground font-mono">@{org.slug}</span>
          </div>
          {org.description && (
            <p className="text-muted-foreground">{org.description}</p>
          )}
          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap pt-1">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Created {fmt(org.createdAt)}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {org.members.length} member{org.members.length !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1">
              <Package className="w-3.5 h-3.5" />
              {org.packages.length} package{org.packages.length !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1">
              <Download className="w-3.5 h-3.5" />
              {totalDownloads.toLocaleString()} downloads
            </span>
            {org.websiteUrl && (
              <a
                href={org.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-foreground hover:underline"
              >
                <Globe className="w-3.5 h-3.5" />
                Website
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Packages column */}
        <section className="md:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Package className="w-4 h-4" />
            Packages
          </h2>
          {org.packages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No packages published under this organization yet.
            </p>
          ) : (
            <div className="divide-y border rounded-lg">
              {org.packages.map((pkg) => (
                <Link
                  key={pkg.slug}
                  href={`/package/${pkg.slug}`}
                  className="flex items-start justify-between gap-4 p-4 hover:bg-muted/40 transition-colors group"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-medium text-sm group-hover:text-primary">
                        {pkg.slug}
                      </span>
                      {pkg.latestVersion && (
                        <span className="text-xs border rounded px-1.5 py-0.5 bg-muted font-mono">
                          v{pkg.latestVersion}
                        </span>
                      )}
                      {pkg.isDeprecated && (
                        <span className="text-xs border rounded px-1.5 py-0.5 bg-amber-50 text-amber-700 border-amber-200">
                          deprecated
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {pkg.description}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1 pt-0.5">
                    <Download className="w-3 h-3" />
                    {pkg.totalDownloads.toLocaleString()}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Members sidebar */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-4 h-4" />
            Members
          </h2>

          {[
            { label: "Owners", icon: Star, list: owners },
            { label: "Admins", icon: Shield, list: admins },
            { label: "Members", icon: Users, list: members },
          ]
            .filter(({ list }) => list.length > 0)
            .map(({ label, icon: Icon, list }) => (
              <div key={label} className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {label}
                </p>
                {list.map((m) => (
                  <Link
                    key={m.id}
                    href={`/users/${m.user.username}`}
                    className="flex items-center gap-2.5 p-2 rounded-md hover:bg-muted transition-colors group"
                  >
                    {m.user.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.user.avatarUrl}
                        alt={m.user.username}
                        className="w-7 h-7 rounded-full border object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full border bg-muted flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-muted-foreground uppercase">
                          {m.user.username[0]}
                        </span>
                      </div>
                    )}
                    <span className="text-sm group-hover:text-primary truncate">
                      {m.user.username}
                    </span>
                    <span
                      className={`ml-auto text-xs border rounded px-1.5 py-0.5 font-medium ${
                        ROLE_BADGE[m.role] ?? ROLE_BADGE.member
                      }`}
                    >
                      {m.role}
                    </span>
                  </Link>
                ))}
              </div>
            ))}
        </section>
      </div>
    </main>
  );
}
