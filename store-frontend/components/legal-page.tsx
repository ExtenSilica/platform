import Link from "next/link";

const NAV = [
  { href: "/legal/terms",   label: "Terms of Service" },
  { href: "/legal/privacy", label: "Privacy Policy"   },
  { href: "/legal/dmca",    label: "DMCA / Takedown"  },
  { href: "/faq",           label: "FAQ"               },
];

interface LegalPageProps {
  title: string;
  subtitle?: string;
  updated: string;    // "March 2026"
  current: string;    // href of current page, for active highlight
  children: React.ReactNode;
}

export function LegalPage({ title, subtitle, updated, current, children }: LegalPageProps) {
  return (
    <div className="min-h-screen">
      {/* Page header */}
      <div className="border-b bg-muted/10">
        <div className="container max-w-5xl px-4 py-8">
          <p className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Legal
          </p>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-2 max-w-2xl text-muted-foreground">{subtitle}</p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Last updated: {updated}
          </p>
        </div>

        {/* Section nav */}
        <div className="container max-w-5xl px-4">
          <nav className="flex gap-0 overflow-x-auto border-t">
            {NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  current === href
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* Body */}
      <div className="container max-w-3xl px-4 py-12">{children}</div>
    </div>
  );
}

/* ─── Section helpers ─────────────────────────────────────────────────────── */

export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-b pb-8 last:border-0 last:pb-0">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

export function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5">{children}</ul>;
}

export function C({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
      {children}
    </code>
  );
}

export function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-foreground">{children}</strong>;
}
