import { XSIL_LEGAL_DISCLAIMER_LINES } from "@/lib/xsil-disclaimer";
import { cn } from "@/lib/utils";

type Variant = "inline" | "box" | "compact";

type Props = {
  variant?: Variant;
  className?: string;
  title?: string;
};

export function XsilDisclaimerNotice({
  variant = "box",
  className,
  title = "XSIL legal notice",
}: Props) {
  const lines = XSIL_LEGAL_DISCLAIMER_LINES;

  if (variant === "inline") {
    return (
      <p className={cn("text-sm leading-relaxed text-muted-foreground", className)}>
        {lines.join(" ")}
      </p>
    );
  }

  if (variant === "compact") {
    return (
      <p className={cn("text-xs leading-relaxed text-muted-foreground", className)}>
        {lines[0]} {lines[3]}
      </p>
    );
  }

  return (
    <aside
      className={cn(
        "rounded-md border border-amber-500/30 bg-amber-500/5 p-4 text-sm leading-relaxed text-muted-foreground",
        className,
      )}
      role="note"
      aria-label="XSIL token legal notice"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-foreground/80">{title}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </aside>
  );
}
