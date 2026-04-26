import { Badge } from "@/components/ui/badge";

function readinessName(level: number): string {
  // Current registry/webapp ladder is 1–5. Keep conservative names that remain true.
  switch (level) {
    case 1: return "Packaged";
    case 2: return "Runnable";
    case 3: return "Reproducible";
    case 4: return "Testable";
    case 5: return "HW-evaluable";
    default: return "Readiness";
  }
}

/** Compact readiness + capability chips for cards and profile listings. */
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
      <span className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
        <span className="text-foreground/85">Readiness:</span>{" "}
        <span className="font-mono">RL{level}</span> — {readinessName(level)}
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
