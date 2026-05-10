import { cn } from "@/lib/utils";
import {
  STANDARD_STATUS_INFO,
  type StandardStatus,
} from "@/lib/types";
import { BadgeCheck, FileText, Building2, FlaskConical, Cpu, HelpCircle } from "lucide-react";

/**
 * Color tokens for each `StandardStatus`. Tailwind utility-class strings, picked
 * to be readable against both the muted card surface and the page background.
 */
const TONE: Record<
  StandardStatus,
  { ring: string; bg: string; text: string; icon: typeof BadgeCheck }
> = {
  ratified: {
    ring: "border-emerald-500/40",
    bg: "bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-300",
    icon: BadgeCheck,
  },
  draft: {
    ring: "border-amber-500/40",
    bg: "bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-300",
    icon: FileText,
  },
  vendor: {
    ring: "border-blue-500/40",
    bg: "bg-blue-500/10",
    text: "text-blue-700 dark:text-blue-300",
    icon: Building2,
  },
  research: {
    ring: "border-violet-500/40",
    bg: "bg-violet-500/10",
    text: "text-violet-700 dark:text-violet-300",
    icon: FlaskConical,
  },
  custom: {
    ring: "border-slate-500/40",
    bg: "bg-slate-500/10",
    text: "text-slate-700 dark:text-slate-300",
    icon: Cpu,
  },
};

interface StandardStatusBadgeProps {
  status?: StandardStatus | null;
  authority?: string | null;
  /** Short pill ("Ratified · RISC-V International") vs label-only. */
  variant?: "full" | "compact";
  className?: string;
  title?: string;
}

/**
 * Renders a small badge that exposes a package's honest classification. When
 * `status` is null the component renders an "Unclassified" pill; this only
 * happens for legacy rows that pre-date the StandardStatus field.
 */
export function StandardStatusBadge({
  status,
  authority,
  variant = "compact",
  className,
  title,
}: StandardStatusBadgeProps) {
  if (!status) {
    return (
      <span
        title={title ?? "This package was published before the StandardStatus field existed."}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/30 bg-muted/30 px-2 py-0.5 text-[11px] font-medium text-muted-foreground",
          className,
        )}
      >
        <HelpCircle className="h-3 w-3" />
        Unclassified
      </span>
    );
  }

  const info = STANDARD_STATUS_INFO[status];
  const tone = TONE[status];
  const Icon = tone.icon;
  const tooltip = title ?? info.description;
  const showAuthority = variant === "full" && authority && authority.trim().length > 0;

  return (
    <span
      title={tooltip}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tone.ring,
        tone.bg,
        tone.text,
        className,
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={2.5} />
      <span>{info.label}</span>
      {showAuthority ? (
        <>
          <span className="text-current/40">·</span>
          <span className="font-normal opacity-90">{authority}</span>
        </>
      ) : null}
    </span>
  );
}
