import Link from "next/link";
import {
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  Hammer,
  TestTube2,
  XCircle,
} from "lucide-react";
import type {
  PortVerificationStatus,
  RegistryPort,
  RegistryTarget,
} from "@/lib/types";
import {
  SUPPORT_GROUPS,
  defaultBackendForTarget,
  supportAction,
  supportAnchor,
} from "@/lib/support-model";

const STATUS: Record<
  PortVerificationStatus,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  verified: {
    label: "VERIFIED",
    icon: CheckCircle2,
    className: "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  tested: {
    label: "TESTED",
    icon: TestTube2,
    className: "border-blue-500/35 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  built: {
    label: "BUILT",
    icon: Hammer,
    className: "border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  },
  declared: {
    label: "DECLARED",
    icon: CircleDashed,
    className: "border-border bg-muted/40 text-muted-foreground",
  },
  failed: {
    label: "FAILED",
    icon: XCircle,
    className: "border-destructive/35 bg-destructive/10 text-destructive",
  },
  archived: {
    label: "ARCHIVED",
    icon: CircleDashed,
    className: "border-border bg-muted/40 text-muted-foreground",
  },
};

function PortStatusBadge({ status }: { status: PortVerificationStatus }) {
  const info = STATUS[status];
  const Icon = info.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold ${info.className}`}>
      <Icon className="h-3 w-3" />
      {info.label}
    </span>
  );
}

export function PortsMatrix({
  slug,
  ports,
  targets,
}: {
  slug: string;
  ports: RegistryPort[];
  targets: RegistryTarget[];
}) {
  return (
    <div className="space-y-7">
      {SUPPORT_GROUPS.map((group) => {
        const groupTargets = targets.filter((target) => group.kinds.includes(target.kind));
        if (groupTargets.length === 0) return null;
        const rows: Array<{ target: RegistryTarget; port: RegistryPort | null }> = [];
        for (const target of groupTargets) {
          const targetPorts = ports.filter((port) => port.target.slug === target.slug);
          if (targetPorts.length > 0) {
            rows.push(...targetPorts.map((port) => ({ target, port })));
          } else {
            rows.push({ target, port: null });
          }
        }

        return (
          <section key={group.id} aria-labelledby={`support-group-${group.id}`}>
            <div className="mb-2">
              <h3 id={`support-group-${group.id}`} className="text-sm font-semibold text-foreground">
                {group.title}
              </h3>
              <p className="text-xs text-muted-foreground">{group.description}</p>
            </div>
            <div className="overflow-hidden rounded-lg border bg-background">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b bg-muted/35 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Target / backend</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Evidence</th>
                      <th className="px-4 py-3 font-medium">Contributor</th>
                      <th className="px-4 py-3 text-right font-medium">Work</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map(({ target, port }) => {
                      const fallbackBackend = defaultBackendForTarget(target.slug);
                      const backendSlug = port?.backendSlug ?? fallbackBackend.slug;
                      const backendName = port?.backendName ?? fallbackBackend.name;
                      const query = new URLSearchParams({
                        portTarget: String(target.id),
                        portBackend: backendSlug,
                      });
                      return (
                        <tr
                          id={supportAnchor(target.slug, backendSlug)}
                          key={`${target.id}:${port?.id ?? backendSlug}`}
                          className="scroll-mt-24 align-top"
                        >
                          <td className="px-4 py-3">
                            <p className="font-semibold text-foreground">{target.name}</p>
                            <p className="mt-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                              {backendName || target.kind}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            {port ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <PortStatusBadge status={port.verificationStatus} />
                                {port.version && (
                                  <code className="text-[11px] text-muted-foreground">v{port.version}</code>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex rounded-md border border-dashed px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                                NO EVIDENCE
                              </span>
                            )}
                          </td>
                          <td className="max-w-[280px] px-4 py-3 text-xs text-muted-foreground">
                            {port?.testSummary ?? (port ? "Evidence declared for this support record" : "No reproducible evidence yet")}
                            {port?.artifact && (
                              <code className="mt-1 block break-all text-[10px] text-foreground">
                                xsil install {port.artifact.slug}
                              </code>
                            )}
                            {port?.evidenceUrl && (
                              <a
                                href={port.evidenceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1 flex items-center gap-1 text-primary hover:underline"
                              >
                                Open evidence <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {port?.contributor ? (
                              <Link href={`/users/${port.contributor.username}`} className="font-medium hover:underline">
                                @{port.contributor.username}
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">Unclaimed</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {port?.verificationStatus === "verified" ? (
                              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Evidence passes</span>
                            ) : (
                              <Link
                                href={`/package/${encodeURIComponent(slug)}?${query.toString()}#port-work`}
                                className="inline-flex rounded-md border border-primary/30 px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/5"
                              >
                                {supportAction(target.kind)}
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
