import Link from "next/link";
import { InfoPage, InfoSection } from "@/components/info-page";
import type { GovernancePublic } from "@/lib/api";
import {
  GOVERNANCE_VOTING_PARAMS,
  TOKEN_DISTRIBUTION_INTRO,
  TOKEN_EARN_ROWS,
  TOKEN_SUPPLY_FOOTNOTE,
  TOKEN_SUPPLY_ROWS,
  WHAT_IS_XSIL,
} from "@/lib/token-page-data";
import { XsilDisclaimerNotice } from "@/components/xsil-disclaimer-notice";
import { TokenHeroActions } from "@/components/token/token-hero-actions";
import { TokenClaimSection } from "@/components/token/token-claim-section";
import { TokenIcon } from "@/components/token/token-icon";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ARAGON_DAO_ADDRESS, ARAGON_DAO_PUBLIC_URL } from "@/lib/aragon-dao";
import {
  getXsilBasescanUrl,
  getXsilContractAddress,
  XSIL_BASESCAN_URL,
  XSIL_CHAIN_ID,
  XSIL_CONTRACT_ADDRESS,
} from "@/lib/xsil-contract";

type Props = {
  governance: GovernancePublic | null;
};

export function TokenPageContent({ governance }: Props) {
  const aragonDescription = governance?.aragon?.description ?? null;
  const supply = governance?.tokenSupply ?? TOKEN_SUPPLY_ROWS;
  const earn = governance?.earnRules ?? TOKEN_EARN_ROWS;
  const aragonUrl = ARAGON_DAO_PUBLIC_URL;
  const xsilContract =
    governance?.xsilContractAddress?.trim() ||
    getXsilContractAddress() ||
    XSIL_CONTRACT_ADDRESS;
  const xsilBasescan =
    governance?.xsilBasescanUrl?.trim() || getXsilBasescanUrl() || XSIL_BASESCAN_URL;

  return (
    <InfoPage
      title="XSIL — The ExtenSilica Contributor Token"
      subtitle="Verified technical contribution and governance participation."
      updated="May 2026"
      current="/token"
      note="No monetary value · Earned through verified support · Used in governance"
    >
      <div className="space-y-16">
        <section className="-mt-4 space-y-6">
          <Badge variant="outline" className="text-xs font-normal">
            No monetary value · Verified contribution · Governance participation
          </Badge>
          <XsilDisclaimerNotice variant="box" className="max-w-3xl" />
          <TokenHeroActions />
        </section>

        <InfoSection id="what-is" title="What is XSIL">
          <div className="grid gap-6 md:grid-cols-3">
            {WHAT_IS_XSIL.map((item) => (
              <div key={item.title} className="rounded-lg border bg-card p-5">
                <TokenIcon name={item.icon} className="mb-3 h-6 w-6 text-riscv-accent" />
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>
        </InfoSection>

        <InfoSection id="tokenomics" title="Token Supply">
          <p className="text-sm leading-relaxed text-muted-foreground">{TOKEN_DISTRIBUTION_INTRO}</p>
          <div className="mb-6 mt-4 rounded-lg border bg-muted/20 p-4 text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              XSILToken on Base (chain {XSIL_CHAIN_ID})
            </p>
            <a
              href={xsilBasescan}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block font-mono text-xs break-all text-primary underline hover:text-primary/90"
            >
              {xsilContract}
            </a>
            <p className="mt-2 text-xs text-muted-foreground">
              <a
                href={xsilBasescan}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                View on Basescan →
              </a>
            </p>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Allocation</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">%</th>
                  <th className="px-4 py-3 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {supply.map((row) => (
                  <tr
                    key={row.allocation}
                    className={`border-b last:border-0 ${"total" in row && row.total ? "bg-muted/20 font-semibold" : ""}`}
                  >
                    <td className="px-4 py-3">{row.allocation}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{row.amount}</td>
                    <td className="px-4 py-3 font-mono">{row.pct}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">{TOKEN_SUPPLY_FOOTNOTE}</p>
        </InfoSection>

        <InfoSection id="earn" title="Earn XSIL by contributing">
          <div className="space-y-3">
            {earn.map((row) => (
              <div
                key={row.action}
                className="flex flex-col gap-2 rounded-lg border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <TokenIcon
                    name={"icon" in row ? row.icon : "check"}
                    className="mt-0.5 h-5 w-5 shrink-0"
                  />
                  <div>
                    <p className="font-medium">{row.action}</p>
                    <p className="text-xs text-muted-foreground">{row.notes}</p>
                  </div>
                </div>
                <span className="shrink-0 font-mono text-lg font-semibold tabular-nums text-riscv-accent sm:text-right">
                  {row.xsil}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Token grants are reviewed and confirmed before treasury transfer on-chain. Gaming or
            duplicate actions are
            disqualified.
          </p>
        </InfoSection>

        <TokenClaimSection />

        <InfoSection id="governance-dao" title="Participate in governance">
          <p className="leading-relaxed text-muted-foreground">
            ExtenSilica is governed by XSIL token holders through the{" "}
            <a
              href={aragonUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              ExtenSilica DAO on Aragon
            </a>{" "}
            (Base). Token holders vote on registry policies, treasury distributions to
            contributors, and platform priorities.
          </p>
          <div className="mt-6 flex flex-col gap-4 rounded-lg border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Aragon
              </p>
              <h3 className="mt-1 text-lg font-semibold">ExtenSilica DAO on Aragon</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                View proposals · Cast votes · Delegate
              </p>
              {aragonDescription ? (
                <p className="mt-3 max-w-xl text-xs leading-relaxed text-muted-foreground whitespace-pre-line">
                  {aragonDescription}
                </p>
              ) : null}
            </div>
            <a
              href={aragonUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants())}
            >
              Open Aragon DAO →
            </a>
          </div>
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            DAO on Base: {governance?.aragon?.daoAddress ?? ARAGON_DAO_ADDRESS}
          </p>
          <div className="mt-6 overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[320px] text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Parameter</th>
                  <th className="px-4 py-3 font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {GOVERNANCE_VOTING_PARAMS.map((row) => (
                  <tr key={row.param} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">{row.param}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Voting requires XSIL on-chain. Earn or receive tokens from the DAO treasury, connect
            your wallet on this page, then open Aragon to view proposals and cast votes.
          </p>
        </InfoSection>

        <InfoSection id="documentation" title="Token Documentation">
          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold">XSIL Token Documentation v1.0</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Full tokenomics, governance model, contribution criteria, legal disclaimers, and
              future roadmap. Use &quot;Save as PDF / Print&quot; on the documentation page to export.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/token/documentation" className={cn(buttonVariants())}>
                Read documentation →
              </Link>
              <Link href="/token/documentation" className={cn(buttonVariants({ variant: "outline" }))}>
                Download PDF →
              </Link>
            </div>
          </div>
          <XsilDisclaimerNotice variant="box" title="Legal disclaimer" />
        </InfoSection>

        <footer className="border-t pt-8">
          <XsilDisclaimerNotice variant="inline" />
        </footer>
      </div>
    </InfoPage>
  );
}
