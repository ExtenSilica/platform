import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <p className="font-bold text-foreground">ExtenSilica</p>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              The public registry for reproducible{" "}
              <code className="rounded bg-muted px-1 font-mono text-xs">.xsil</code>{" "}
              packages.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Open registry. No payments, no gatekeeping.
            </p>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Registry
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/search" className="text-muted-foreground hover:text-foreground transition-colors">
                  Browse packages
                </Link>
              </li>
              <li>
                <Link href="/search?q=rvv" className="text-muted-foreground hover:text-foreground transition-colors">
                  Vector extensions
                </Link>
              </li>
              <li>
                <Link href="/search?q=spike" className="text-muted-foreground hover:text-foreground transition-colors">
                  Spike packages
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Docs
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/faq" className="text-muted-foreground hover:text-foreground transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/extensilica/xsil"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  CLI on GitHub
                </a>
              </li>
              <li>
                <a
                  href="/spec/xsil"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  .xsil spec
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Legal
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/legal/terms" className="text-muted-foreground hover:text-foreground transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/legal/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t pt-6 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} ExtenSilica contributors. Open registry. No payments, no gatekeeping.
        </div>
      </div>
    </footer>
  );
}
