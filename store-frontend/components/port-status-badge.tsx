import { cn } from "@/lib/utils";
import { PORT_STATUS_INFO, type PortStatus } from "@/lib/types";
import {
  Sprout,
  Users,
  BadgeCheck,
  ShieldCheck,
  Archive,
} from "lucide-react";

/**
 * Tailwind tone tokens per `PortStatus`. Chosen so the badge contrasts cleanly
 * against card backgrounds in both light and dark themes.
 *
 * Distinct palette from `StandardStatusBadge` so the two badges never look
 * redundant when stacked.
 */
const TONE: Record<
  PortStatus,
  { ring: string; bg: string; text: string; icon: typeof BadgeCheck }
> = {
  seeded: {
    ring: "border-orange-500/40",
    bg: "bg-orange-500/10",
    text: "text-orange-700 dark:text-orange-300",
    icon: Sprout,
  },
  community_port: {
    ring: "border-sky-500/40",
    bg: "bg-sky-500/10",
    text: "text-sky-700 dark:text-sky-300",
    icon: Users,
  },
  claimed: {
    ring: "border-teal-500/40",
    bg: "bg-teal-500/10",
    text: "text-teal-700 dark:text-teal-300",
    icon: BadgeCheck,
  },
  official: {
    ring: "border-emerald-600/50",
    bg: "bg-emerald-600/10",
    text: "text-emerald-700 dark:text-emerald-300",
    icon: ShieldCheck,
  },
  archived: {
    ring: "border-zinc-500/40",
    bg: "bg-zinc-500/10",
    text: "text-zinc-600 dark:text-zinc-400",
    icon: Archive,
  },
};

interface PortStatusBadgeProps {
  status?: PortStatus | null;
  /** "compact" = short label only; "full" = full label with longer description. */
  variant?: "full" | "compact";
  className?: string;
  title?: string;
  /**
   * When `status` is null, omit rendering entirely. Default `false`, so callers
   * who want a visible "self-published" tag get one; pass `true` on detail
   * pages where blank space is preferable to a meaningless badge.
   */
  hideWhenUnset?: boolean;
}

/**
 * Renders the small provenance pill ("Seeded · unverified", "Maintainer claimed",
 * etc.). The field is server-set so users cannot lie about it.
 *
 * For legacy rows (`status == null`) we render a neutral "Self-published" hint
 * unless `hideWhenUnset` is true.
 */
export function PortStatusBadge({
  status,
  variant = "compact",
  className,
  title,
  hideWhenUnset = false,
}: PortStatusBadgeProps) {
  if (!status) {
    if (hideWhenUnset) return null;
    return (
      <span
        title={
          title ??
          "Self-published. The publisher created this entry directly; ExtenSilica has not separately verified upstream authorship."
        }
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/30 bg-muted/30 px-2 py-0.5 text-[11px] font-medium text-muted-foreground",
          className,
        )}
      >
        Self-published
      </span>
    );
  }

  const info = PORT_STATUS_INFO[status];
  const tone = TONE[status];
  const Icon = tone.icon;
  const tooltip = title ?? info.description;
  const label = variant === "full" ? info.label : info.short;

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
      <span>{label}</span>
    </span>
  );
}
