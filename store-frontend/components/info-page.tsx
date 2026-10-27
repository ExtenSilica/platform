import Link from "next/link";

export const INFO_NAV = [
  { href: "/about", label: "About" },
  { href: "/adoption", label: "Adoption" },
  { href: "/contributing", label: "Contributing" },
] as const;

interface InfoPageProps {
  title: string;
  subtitle?: string;
  updated: string;
  /** Optional banner below the header (e.g. early-adoption context). */
  note?: string;
  current: string;
  children: React.ReactNode;
}

export function InfoPage({ title, subtitle, updated, note, current, children }: InfoPageProps) {
  return (
    <div className="min-h-screen">
      <div className="border-b bg-muted/10">
        <div className="container max-w-6xl px-4 py-8">
          <p className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Project
          </p>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {subtitle ? (
            <p className="mt-2 max-w-2xl text-muted-foreground">{subtitle}</p>
          ) : null}
          <p className="mt-3 text-xs text-muted-foreground">Last updated: {updated}</p>
          {note ? (
            <p className="mt-3 max-w-2xl rounded-md border border-border/80 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              {note}
            </p>
          ) : null}
        </div>

        <div className="container max-w-6xl px-4">
          <nav className="flex gap-0 overflow-x-auto border-t">
            {INFO_NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  current === href
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-riscv-accent/40 hover:text-foreground hover:shadow-sm"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <div className="container max-w-5xl px-4 py-12">{children}</div>
    </div>
  );
}

export function InfoSection({
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
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export function InfoUl({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5">{children}</ul>;
}

export function InfoC({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
      {children}
    </code>
  );
}

export function InfoStrong({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-foreground">{children}</strong>;
}
