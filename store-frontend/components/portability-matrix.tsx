import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  PORTABILITY_MATRIX_NOTE,
  preBuildTone,
  testsTone,
  type PortabilityCellTone,
  type PortabilityMatrix,
} from "@/lib/portability-matrix";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<PortabilityCellTone, string> = {
  neutral: "",
  muted: "text-muted-foreground",
  info: "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-300",
  warn: "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-300",
  success:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  danger:
    "border-destructive/30 bg-destructive/10 text-destructive",
};

function CellBadge({
  label,
  tone,
  title,
}: {
  label: string;
  tone: PortabilityCellTone;
  title?: string | null;
}) {
  if (label === "—") {
    return <span className="text-muted-foreground">—</span>;
  }
  if (tone === "neutral") {
    return (
      <span className="text-sm" title={title ?? undefined}>
        {label}
      </span>
    );
  }
  return (
    <Badge
      variant="outline"
      className={cn("font-normal", TONE_CLASS[tone])}
      title={title ?? undefined}
    >
      {label}
    </Badge>
  );
}

export function PortabilityMatrixTable({ matrix }: { matrix: PortabilityMatrix }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{PORTABILITY_MATRIX_NOTE}</p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Target</th>
              <th className="px-3 py-2 font-medium">Pre-build</th>
              <th className="px-3 py-2 font-medium">Adapter</th>
              <th className="px-3 py-2 font-medium">Build</th>
              <th className="px-3 py-2 font-medium">Tests</th>
              <th className="px-3 py-2 font-medium">Port package</th>
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => (
              <tr key={row.target} className="border-b last:border-0">
                <td className="px-3 py-2.5 font-mono text-xs">{row.target}</td>
                <td className="px-3 py-2.5">
                  <CellBadge
                    label={row.preBuild}
                    tone={preBuildTone(row.preBuild)}
                    title={row.notes}
                  />
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{row.adapter}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{row.build}</td>
                <td className="px-3 py-2.5">
                  <CellBadge
                    label={row.tests}
                    tone={testsTone(row.tests, row.postTest)}
                    title={row.postTest}
                  />
                </td>
                <td className="px-3 py-2.5">
                  {row.portPackage ? (
                    <Link
                      href={`/package/${row.portPackage}`}
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      {row.portPackage}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
