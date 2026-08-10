import type { Metadata } from "next";
import Link from "next/link";
import {
  InfoPage,
  InfoSection,
  InfoUl,
  InfoC,
  InfoStrong,
} from "@/components/info-page";
import { XsilDisclaimerNotice } from "@/components/xsil-disclaimer-notice";
import { ARAGON_DAO_PUBLIC_URL } from "@/lib/aragon-dao";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Governance — ExtenSilica",
  description:
    "How ExtenSilica stewards the public RISC-V extension package registry and contributor governance.",
};

export default async function GovernancePage() {
  return (
    <InfoPage
      title="Governance"
      subtitle="Stewardship of the .xsil format and public extension catalog."
      updated="August 2026"
      current="/governance"
    >
      <div className="space-y-10">
        <InfoSection id="steward" title="Interim steward">
          <p>
            <InfoStrong>ExtenSilica</InfoStrong> operates as interim technical steward of the
            public RISC-V extension registry and the{" "}
            <InfoC>.xsil</InfoC> package format. Our goal is neutral, long-term
            governance — including transfer to{" "}
            <InfoStrong>RISC-V International</InfoStrong> or an affiliated foundation
            when the catalog, processes, and community are ready.
          </p>
          <p>
            ExtenSilica is an independent project and is{" "}
            <InfoStrong>not affiliated with RISC-V International</InfoStrong>. References
            to ratified or draft extensions are descriptive; canonical specifications
            remain with their standards bodies.
          </p>
        </InfoSection>

        <InfoSection id="scope" title="What we coordinate">
          <p>We coordinate <InfoStrong>open technical work</InfoStrong> on the registry:</p>
          <InfoUl>
            <li>Versioned .xsil packages and upstream provenance</li>
            <li>Extension identity, encoding, CSR, dependency, and specification metadata</li>
            <li>Optional simulator, toolchain, RTL, test, example, and hardware artifacts</li>
            <li>Immutable releases, checksums, citations, deprecation, and ownership claims</li>
            <li>
              <Link href="/token" className="text-primary underline">
                XSIL governance points
              </Link>{" "}
              — non-monetary rewards for verified catalog contributions and governance participation
            </li>
            <li>
              External citations and canonical CFF / BibTeX on each Extension page for
              academic reuse
            </li>
          </InfoUl>
        </InfoSection>

        <InfoSection id="out-of-scope" title="What we do not do">
          <p>
            We <InfoStrong>do not</InfoStrong> hold funds, process payments, set prices,
            or broker contracts on the platform. Optional funding-contact fields on
            implementation requests point to <InfoStrong>off-platform</InfoStrong>{" "}
            arrangements only; they are not offers, escrow, or payment rails.
          </p>
          <p>
            There are no paid tiers, marketplace fees, wallets, or payout states in
            the registry schema. That boundary exists so a future foundation can absorb
            the codebase without inheriting financial custody.
          </p>
        </InfoSection>

        <InfoSection id="transfer" title="Path to neutral governance">
          <p>Transfer readiness is measured by transparent operations, not promises:</p>
          <InfoUl>
            <li>Public adoption metrics on the <Link href="/adoption" className="text-primary underline">adoption dashboard</Link></li>
            <li>Documented contribution and citation practices</li>
            <li>Apache-licensed platform code and a contributor license agreement (CLA)</li>
            <li>No financial schema drift in the database or API</li>
          </InfoUl>
          <p>
            When governance moves to a foundation, package contents remain under their upstream
            licenses; only platform code and operational runbooks transfer.
          </p>
        </InfoSection>

        <InfoSection id="xsil" title="XSIL governance tokens">
          <p>
            <Link href="/token" className="text-primary underline">
              XSIL
            </Link>{" "}
            records verified contribution and future governance participation. It is not a payment
            instrument or investment product on this platform.
          </p>
          <XsilDisclaimerNotice variant="box" className="mt-4" />
          <p className="mt-4 text-sm text-muted-foreground">
            Proposals and votes run on the ExtenSilica DAO on Aragon (Base).
          </p>
          <a
            href={ARAGON_DAO_PUBLIC_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3 inline-flex")}
          >
            Open ExtenSilica DAO on Aragon →
          </a>
        </InfoSection>

        <InfoSection id="contribute" title="Get involved">
          <p>
            See <Link href="/contributing" className="text-primary underline">Contributing</Link>{" "}
            for how to publish, maintain, and improve extension packages. Questions about
            stewardship can be directed through the contact
            channels listed in our{" "}
            <Link href="/legal/terms" className="text-primary underline">
              Terms of Service
            </Link>
            .
          </p>
        </InfoSection>
      </div>
    </InfoPage>
  );
}
