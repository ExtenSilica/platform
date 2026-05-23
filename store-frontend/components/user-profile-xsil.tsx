import Link from "next/link";
import { Coins } from "lucide-react";
import type { UserProfileXsil } from "@/lib/types";
import { formatGrantReference, formatRelativeTime, grantReasonLabel } from "@/lib/xsil-grant-display";
import { Badge } from "@/components/ui/badge";

type Props = {
  xsil: UserProfileXsil;
};

export function UserProfileXsilSection({ xsil }: Props) {
  if (xsil.totalEarned <= 0 && xsil.grants.length === 0) {
    return null;
  }

  return (
    <section id="xsil-grants" className="mt-12 border-t pt-10 scroll-mt-8">
      <div className="mb-4 flex items-center gap-2">
        <Coins className="h-5 w-5 text-riscv-accent" aria-hidden />
        <h2 className="text-lg font-semibold">Contributions (XSIL)</h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Public record of verified registry contributions that earned XSIL governance points.
      </p>

      {xsil.grants.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {xsil.grants.map((g) => (
            <li
              key={g.id}
              className="flex flex-wrap items-baseline gap-x-2 rounded-lg border bg-background px-4 py-3"
            >
              <span className="font-mono font-semibold text-riscv-accent">+{g.amount}</span>
              <span>{g.reasonLabel ?? grantReasonLabel(g.reason)}</span>
              <span className="text-muted-foreground">· {formatGrantReference(g.referenceId)}</span>
              <span className="text-xs text-muted-foreground">· {formatRelativeTime(g.createdAt)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No public grant history yet.</p>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        <Link href="/token" className="text-primary underline">
          XSIL token documentation
        </Link>
      </p>
    </section>
  );
}

export function UserProfileXsilBadges({ xsil }: { xsil: UserProfileXsil }) {
  if (xsil.totalEarned <= 0) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Badge variant="outline" className="font-normal">
        XSIL holder
      </Badge>
      <span className="font-mono text-sm tabular-nums text-riscv-accent">
        {xsil.totalEarned.toLocaleString()} XSIL earned
      </span>
    </div>
  );
}
