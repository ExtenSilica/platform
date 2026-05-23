import Link from "next/link";
import {
  CLAIM_STEPS,
  FUTURE_LIQUIDITY_COPY,
  GOVERNANCE_SCOPE_ITEMS,
  GOVERNANCE_VOTING_PARAMS,
  LEGAL_DISCLAIMER_WHITEPAPER,
  TOKEN_DISTRIBUTION_ROWS,
  TOKEN_DOC_CONTACT,
  TOKEN_DOC_DATE,
  TOKEN_DOC_VERSION,
  TOKEN_EARN_ROWS,
  TOKEN_OVERVIEW_ROWS,
} from "@/lib/token-documentation-content";
import { XsilDisclaimerNotice } from "@/components/xsil-disclaimer-notice";
import { ARAGON_DAO_DESCRIPTION_DEFAULT } from "@/lib/xsil-disclaimer";

function DocSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-border/60 pb-10 last:border-0">
      <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[320px] text-left text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b last:border-0">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`px-4 py-3 ${j === 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TokenDocumentationArticle() {
  return (
    <article className="token-documentation mx-auto max-w-3xl">
      <header className="mb-10 border-b pb-8 print:border-black">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          ExtenSilica · Version {TOKEN_DOC_VERSION} · {TOKEN_DOC_DATE}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground print:text-black">
          XSIL Token Documentation
        </h1>
      </header>

      <nav className="no-print mb-10 rounded-lg border bg-muted/20 p-4 text-sm">
        <p className="mb-2 font-medium text-foreground">Contents</p>
        <ol className="grid gap-1 text-muted-foreground sm:grid-cols-2">
          {[
            ["introduction", "1. Introduction"],
            ["overview", "2. Token Overview"],
            ["purpose", "3. Token Purpose"],
            ["distribution", "4. Token Distribution"],
            ["contributions", "5. Contribution Criteria"],
            ["governance", "6. Governance"],
            ["claim", "7. Claim Process"],
            ["liquidity", "8. Future Liquidity"],
            ["legal", "9. Legal Disclaimer"],
            ["contact", "10. Contact"],
          ].map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="text-primary hover:underline">
                {label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="space-y-10">
        <DocSection id="introduction" title="1. Introduction">
          <p>
            ExtenSilica is a public registry for reproducible RISC-V extension packages. The XSIL
            token is a governance token that represents contribution history and participation rights
            in the ExtenSilica ecosystem.
          </p>
          <p>
            This document describes the token model, distribution, governance structure, and
            contribution criteria.
          </p>
        </DocSection>

        <DocSection id="overview" title="2. Token Overview">
          <DataTable
            headers={["Property", "Value"]}
            rows={TOKEN_OVERVIEW_ROWS.map((r) => [r.property, r.value])}
          />
        </DocSection>

        <DocSection id="purpose" title="3. Token Purpose">
          <p>XSIL tokens serve two purposes:</p>
          <div>
            <h3 className="font-semibold text-foreground">3.1 Contribution record</h3>
            <p className="mt-2">
              Each token represents verified contribution to the ExtenSilica ecosystem. Grant
              history is recorded off-chain on the platform ledger and reflected on-chain after
              claim.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground">3.2 Governance participation</h3>
            <p className="mt-2">
              Token holders participate in ExtenSilica governance via the ExtenSilica DAO on Aragon.
              Decisions include feature priorities, registry policies, and future token
              distribution.
            </p>
          </div>
        </DocSection>

        <DocSection id="distribution" title="4. Token Distribution">
          <DataTable
            headers={["Allocation", "Amount", "%", "Vesting"]}
            rows={TOKEN_DISTRIBUTION_ROWS.map((r) => [
              r.allocation,
              r.amount,
              r.pct,
              r.vesting,
            ])}
          />
        </DocSection>

        <DocSection id="contributions" title="5. Contribution Criteria">
          <DataTable
            headers={["Action", "XSIL", "Notes"]}
            rows={TOKEN_EARN_ROWS.map((r) => [r.action, r.xsil, r.notes])}
          />
          <p>
            Tokens are granted after verification of each action. Gaming, duplicate submissions, or
            low-quality contributions are disqualified at admin discretion.
          </p>
        </DocSection>

        <DocSection id="governance" title="6. Governance">
          <p>
            ExtenSilica is governed via the ExtenSilica DAO on Aragon (Base network).
          </p>
          <p className="whitespace-pre-line text-sm">{ARAGON_DAO_DESCRIPTION_DEFAULT}</p>
          <h3 className="font-semibold text-foreground">Voting parameters</h3>
          <DataTable
            headers={["Parameter", "Value"]}
            rows={GOVERNANCE_VOTING_PARAMS.map((r) => [r.param, r.value])}
          />
          <h3 className="font-semibold text-foreground">Governance scope</h3>
          <ul className="list-disc space-y-1 pl-5">
            {GOVERNANCE_SCOPE_ITEMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </DocSection>

        <DocSection id="claim" title="7. Claim Process">
          <ol className="list-decimal space-y-2 pl-5">
            {CLAIM_STEPS.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          <p>Gas fees are minimal on Base (typically under $0.01 per claim).</p>
        </DocSection>

        <DocSection id="liquidity" title="8. Future Liquidity">
          {FUTURE_LIQUIDITY_COPY.split("\n\n").map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </DocSection>

        <DocSection id="legal" title="9. Legal Disclaimer">
          <XsilDisclaimerNotice variant="box" title="Required notice" />
          {LEGAL_DISCLAIMER_WHITEPAPER.split("\n\n").map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </DocSection>

        <DocSection id="contact" title="10. Contact">
          <ul className="space-y-2 text-foreground">
            <li>
              <a href={`mailto:${TOKEN_DOC_CONTACT.email}`} className="text-primary underline">
                {TOKEN_DOC_CONTACT.email}
              </a>
            </li>
            <li>
              <Link href="/" className="text-primary underline">
                {TOKEN_DOC_CONTACT.site.replace(/^https:\/\//, "")}
              </Link>
            </li>
            <li>
              <a
                href={TOKEN_DOC_CONTACT.github}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                {TOKEN_DOC_CONTACT.github.replace(/^https:\/\//, "")}
              </a>
            </li>
          </ul>
        </DocSection>
      </div>
    </article>
  );
}
