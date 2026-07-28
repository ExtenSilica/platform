import Link from "next/link";
import { CheckCircle2, Minus } from "lucide-react";

const ROWS: {
  label: string;
  detail: string;
  ok: boolean;
  href?: string;
}[] = [
  {
    label: "Reference model",
    detail: "Differentially validated",
    ok: true,
  },
  {
    label: "PicoRV32 PCPI",
    detail: "Adapter required → 1200/1200 tests",
    ok: true,
    href: "/package/xmac-port-picorv32-pcpi",
  },
  {
    label: "NEORV32 CFU",
    detail: "Adapter required → 1200/1200 tests",
    ok: true,
    href: "/package/xmac-port-neorv32-cfu",
  },
  {
    label: "CVA6 / CV-X-IF",
    detail: "Adapter required → differentially validated (MVP)",
    ok: true,
    href: "/package/xmac-port-cva6-cvxif",
  },
  {
    label: "Rocket / RoCC",
    detail: "Adapter required → differentially validated (MVP)",
    ok: true,
    href: "/package/xmac-port-rocket-rocc",
  },
];

/**
 * Hero-adjacent proof: one extension description, two cores, shared tests.
 * Links to package pages when published; still readable offline as static proof copy.
 */
export function XmacPortDemo() {
  return (
    <div className="overflow-hidden rounded-xl border border-riscv/20 bg-background/90 shadow-sm backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-border/80 bg-muted/40 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-foreground">XMAC</span>
          <span className="text-xs text-muted-foreground">rd = rd + rs1 × rs2</span>
        </div>
        <Link
          href="/package/xmac"
          className="text-xs font-medium text-riscv-accent underline-offset-4 hover:underline"
        >
          Package page
        </Link>
      </div>
      <ul className="divide-y divide-border/60">
        {ROWS.map((row) => (
          <li
            key={row.label}
            className="flex items-start gap-3 px-4 py-3 text-sm sm:items-center"
          >
            {row.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 sm:mt-0" />
            ) : (
              <Minus className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground sm:mt-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">{row.label}</p>
              <p className="text-xs text-muted-foreground">{row.detail}</p>
            </div>
            {row.href && (
              <Link
                href={row.href}
                className="hidden shrink-0 text-xs text-riscv-accent underline-offset-4 hover:underline sm:inline"
              >
                Evidence
              </Link>
            )}
          </li>
        ))}
      </ul>
      <p className="border-t border-border/60 px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
        Pre-build never says Compatible. Post-test status is earned by shared differential
        tests (same seed on PCPI and CFU).
      </p>
    </div>
  );
}
