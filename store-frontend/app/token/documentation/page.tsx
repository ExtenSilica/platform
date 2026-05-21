import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage, InfoSection } from "@/components/info-page";
import {
  TOKEN_EARN_ROWS,
  TOKEN_SUPPLY_ROWS,
  XSIL_DISCLAIMER_FULL,
} from "@/lib/token-page-data";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: { absolute: "XSIL Token Documentation — ExtenSilica" },
  description:
    "XSIL tokenomics, governance model, contribution criteria, and legal disclaimers.",
};

export default function TokenDocumentationPage() {
  return (
    <InfoPage
      title="XSIL Token Documentation v1.0"
      subtitle="Contributor governance token for the ExtenSilica RISC-V extension registry."
      updated="May 2026"
      current="/token"
    >
      <div className="mb-8">
        <Link href="/token" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          ← Back to token page
        </Link>
      </div>

      <div className="space-y-10">
        <InfoSection id="overview" title="Overview">
          <p className="leading-relaxed text-muted-foreground">
            XSIL records verified contributions to the ExtenSilica ecosystem and grants one-token,
            one-vote participation in platform governance via Aragon when tokens are claimed on-chain.
            XSIL has no monetary value today and is not sold or offered as an investment.
          </p>
        </InfoSection>

        <InfoSection id="supply" title="Token supply">
          <ul className="space-y-2 text-sm">
            {TOKEN_SUPPLY_ROWS.map((row) => (
              <li key={row.allocation} className="flex flex-wrap justify-between gap-2 border-b py-2">
                <span>
                  <strong>{row.allocation}</strong>
                  {row.notes ? ` — ${row.notes}` : ""}
                </span>
                <span className="font-mono tabular-nums">
                  {row.amount} ({row.pct})
                </span>
              </li>
            ))}
          </ul>
        </InfoSection>

        <InfoSection id="earn" title="Contribution criteria">
          <ul className="space-y-2 text-sm">
            {TOKEN_EARN_ROWS.map((row) => (
              <li key={row.action} className="flex flex-wrap justify-between gap-2 border-b py-2">
                <span>
                  {row.action}
                  <span className="block text-xs text-muted-foreground">{row.notes}</span>
                </span>
                <span className="font-mono font-semibold text-riscv-accent">{row.xsil} XSIL</span>
              </li>
            ))}
          </ul>
        </InfoSection>

        <InfoSection id="governance" title="Governance model">
          <p className="leading-relaxed text-muted-foreground">
            Decisions that affect registry policy, feature prioritization, and future token
            distribution are submitted to the ExtenSilica Aragon DAO. Voting power is proportional
            to on-chain XSIL balance after claim. Off-chain balances accrue on the platform ledger
            until a wallet is linked and minting is enabled.
          </p>
        </InfoSection>

        <InfoSection id="download" title="Download">
          <p className="text-sm text-muted-foreground">
            A PDF export of this documentation will be published here. Until then, use this page or
            print to PDF from your browser.
          </p>
        </InfoSection>

        <InfoSection id="disclaimer" title="Disclaimer">
          <p className="text-sm leading-relaxed text-muted-foreground">{XSIL_DISCLAIMER_FULL}</p>
        </InfoSection>
      </div>
    </InfoPage>
  );
}
