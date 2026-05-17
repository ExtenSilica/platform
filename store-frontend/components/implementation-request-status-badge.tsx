import { cn } from "@/lib/utils";
import type { ImplementationRequestStatus } from "@/lib/types";
import { IMPLEMENTATION_REQUEST_STATUS_INFO } from "@/lib/types";

const STATUS_CLASS: Record<ImplementationRequestStatus, string> = {
  draft: "text-muted-foreground bg-muted/50 border-border",
  open: "text-sky-700 bg-sky-500/10 border-sky-500/30",
  in_progress: "text-violet-700 bg-violet-500/10 border-violet-500/30",
  submitted: "text-amber-700 bg-amber-500/10 border-amber-500/30",
  verified: "text-emerald-700 bg-emerald-500/10 border-emerald-500/30",
  completed: "text-emerald-800 bg-emerald-500/15 border-emerald-500/40",
  cancelled: "text-muted-foreground bg-muted/40 border-border",
};

export function ImplementationRequestStatusBadge({
  status,
  className,
}: {
  status: ImplementationRequestStatus;
  className?: string;
}) {
  const label = IMPLEMENTATION_REQUEST_STATUS_INFO[status].label;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        STATUS_CLASS[status],
        className,
      )}
      title={IMPLEMENTATION_REQUEST_STATUS_INFO[status].description}
    >
      {label}
    </span>
  );
}
