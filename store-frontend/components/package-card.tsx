import Link from "next/link";
import { RegistryPackage } from "@/lib/types";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertTriangle, Download } from "lucide-react";

export function PackageCard({ pkg }: { pkg: RegistryPackage }) {
  const summary = pkg.shortDescription || pkg.description || "No description.";
  const version = pkg.latestVersion || pkg.version || null;
  const keywords = pkg.keywords?.slice(0, 3) ?? [];

  return (
    <Link href={`/package/${pkg.slug}`} className="group block h-full">
      <Card className={`flex h-full flex-col transition-colors group-hover:border-primary/50 ${pkg.isDeprecated ? "opacity-75" : ""}`}>
        {pkg.isDeprecated && (
          <div className="flex items-center gap-1.5 rounded-t-lg border-b border-amber-200 bg-amber-50 px-3 py-1.5 dark:border-amber-800 dark:bg-amber-950/40">
            <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
              deprecated
            </span>
          </div>
        )}
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="line-clamp-1 text-base">{pkg.name}</CardTitle>
            {version && (
              <span className="shrink-0 rounded-full border bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                {version}
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex-1 pb-3">
          <p className="text-sm leading-relaxed text-muted-foreground line-clamp-3">
            {summary}
          </p>
          {keywords.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {keywords.map((kw) => (
                <span
                  key={kw}
                  className="rounded-full border bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground"
                >
                  {kw}
                </span>
              ))}
            </div>
          )}
        </CardContent>

        <CardFooter className="flex items-center justify-between border-t pt-3">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Download className="h-3 w-3" />
            {pkg.totalDownloads.toLocaleString()}
          </div>
          <span className="text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
            View →
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
}
