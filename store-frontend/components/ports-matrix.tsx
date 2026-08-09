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
  const portByTarget = new Map(ports.map((port) => [port.target.slug, port]));

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b bg-muted/35 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Target</th>
              <th className="px-4 py-3 font-medium">Port status</th>
              <th className="px-4 py-3 font-medium">Evidence</th>
              <th className="px-4 py-3 font-medium">Contributor</th>
              <th className="px-4 py-3 text-right font-medium">Work</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {targets.map((target) => {
              const port = portByTarget.get(target.slug);
              return (
                <tr key={target.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-foreground">{target.name}</p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                      {target.kind}
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
                        NO PORT
                      </span>
                    )}
                  </td>
                  <td className="max-w-[280px] px-4 py-3 text-xs text-muted-foreground">
                    {port?.testSummary ?? (port ? "Evidence declared in the port artifact" : "No reproducible evidence yet")}
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
                      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Tests pass</span>
                    ) : (
                      <Link
                        href={`/package/${encodeURIComponent(slug)}?portTarget=${target.id}#port-work`}
                        className="inline-flex rounded-md border border-primary/30 px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/5"
                      >
                        Port it, earn XSIL
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
  );
}
