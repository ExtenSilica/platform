import Link from "next/link";
import { Github, Linkedin } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t-2 border-brand bg-brand/15">
      <div className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2">
              <img src="/logo.svg" alt="" className="h-6 w-6" />
              <p className="font-bold text-foreground">ExtenSilica</p>
            </div>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              ExtenSilica is the public registry for reproducible RISC-V extensions.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <a
                href="https://www.linkedin.com/company/extensilica"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground transition-colors hover:text-riscv-accent"
                aria-label="LinkedIn"
              >
                <Linkedin className="h-4 w-4" />
              </a>
              <a
                href="https://github.com/ExtenSilica"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground transition-colors hover:text-riscv-accent"
                aria-label="GitHub"
              >
                <Github className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-foreground">
              Registry
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/search" className="text-muted-foreground transition-colors hover:text-riscv-accent">
                  Browse registry
                </Link>
              </li>
              <li>
                <Link href="/legal/dmca" className="text-muted-foreground transition-colors hover:text-riscv-accent">
                  DMCA / Takedown
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-foreground">
              Docs
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/faq" className="text-muted-foreground transition-colors hover:text-riscv-accent">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/governance" className="text-muted-foreground transition-colors hover:text-riscv-accent">
                  Governance
                </Link>
              </li>
              <li>
                <Link href="/adoption" className="text-muted-foreground transition-colors hover:text-riscv-accent">
                  Adoption
                </Link>
              </li>
              <li>
                <Link href="/contributing" className="text-muted-foreground transition-colors hover:text-riscv-accent">
                  Contributing
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-foreground">
              Legal
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/legal/terms" className="text-muted-foreground transition-colors hover:text-riscv-accent">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/legal/privacy" className="text-muted-foreground transition-colors hover:text-riscv-accent">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-border/60 pt-6 text-center text-xs text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} ExtenSilica Ltda. All rights reserved.</p>
          <p className="mt-1 text-[10px] text-muted-foreground/60">
            ExtenSilica is an independent project and is not affiliated with RISC-V International.
          </p>
        </div>
      </div>
    </footer>
  );
}
