import { Badge } from "@/components/ui/badge";

/** Compact maturity / capability chips for cards and profile listings. */
export function PackageCapabilityChips({
  level,
  badges,
  maxBadges = 5,
}: {
  level: number;
  badges: string[];
  /** Cap visible badges so cards stay scannable. */
  maxBadges?: number;
}) {
  if (badges.length === 0 && level <= 1) return null;

  const shown = badges.slice(0, maxBadges);
  const extra = badges.length - shown.length;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      <span className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[9px] font-medium text-muted-foreground">
        L{level}
      </span>
      {shown.map((b) => (
        <Badge key={b} variant="secondary" className="px-1.5 py-0 font-mono text-[9px] font-normal">
          {b}
        </Badge>
      ))}
      {extra > 0 && (
        <span className="text-[9px] text-muted-foreground">+{extra}</span>
      )}
    </div>
  );
}
