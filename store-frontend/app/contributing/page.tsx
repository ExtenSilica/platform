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

export const metadata: Metadata = {
  title: "Contributing — ExtenSilica",
  description:
    "How to define Extensions, implement them on concrete Targets, and submit reproducible evidence.",
};

export default function ContributingPage() {
  return (
    <InfoPage
      title="Contributing"
      subtitle="Define the architecture once. Prove each Target and backend independently."
      updated="August 2026"
      current="/contributing"
    >
      <div className="space-y-10">
        <InfoSection id="principles" title="Principles">
          <p>
            ExtenSilica is built for <InfoStrong>reproducible RISC-V extension work</InfoStrong>.
            Contribution is measured by verified implementations and support evidence, public
            profiles, and citable artifacts — not by catalog volume or platform payments.
          </p>
        </InfoSection>

        <InfoSection id="packages" title="Define an Extension">
          <InfoUl>
            <li>
              Scaffold with the{" "}
              <Link href="/wizard" className="text-primary underline">
                Extension Wizard
              </Link>{" "}
              or <InfoC>xsil new</InfoC>, then publish with <InfoC>xsil publish</InfoC>.
            </li>
            <li>
              Set honest <InfoC>standardStatus</InfoC>, encoding, dependencies, and provenance; do not
              imply ratification or official endorsement without authority.
            </li>
            <li>
              Add a README on the Extension page and link your source repository when
              public.
            </li>
            <li>
              Use the Extension page <InfoStrong>Cite</InfoStrong> block (CFF + BibTeX) for
              papers and Zenodo deposits — see our{" "}
              <a
                href="https://github.com/ExtenSilica/ExtenSilica/blob/main/docs/zenodo-doi.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Zenodo manual
              </a>{" "}
              in the platform repository.
            </li>
          </InfoUl>
        </InfoSection>

        <InfoSection id="implementation" title="Implementation requests">
          <p>
            Extension maintainers and the community can open{" "}
            <Link href="/requests" className="text-primary underline">
              implementation requests
            </Link>{" "}
            to coordinate one concrete Target and backend:
          </p>
          <InfoUl>
            <li>Express interest with your public implementer profile</li>
            <li>Submit work and record verification runs</li>
            <li>
              Optional funding-contact fields are <InfoStrong>off-platform only</InfoStrong>{" "}
              — the registry does not hold funds or broker contracts
            </li>
          </InfoUl>
          <p>
            Build reputation via your{" "}
            <InfoC>/users/&lt;username&gt;</InfoC> page and verified submissions.
          </p>
        </InfoSection>

        <InfoSection id="ownership" title="Ownership claims">
          <p>
            If you maintain an upstream extension but do not yet own the registry
            listing, use the ownership-claim flow on the Extension page. Claims are
            reviewed by platform admins with evidence you control the work.
          </p>
        </InfoSection>

        <InfoSection id="platform" title="Platform code">
          <p>
            The registry web app, API, and tooling live in the{" "}
            <a
              href="https://github.com/ExtenSilica"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              ExtenSilica GitHub organization
            </a>
            . Contributions to the platform repository require the{" "}
            <InfoStrong>Individual Contributor License Agreement (CLA)</InfoStrong>{" "}
            and are licensed under Apache-2.0 — see{" "}
            <a
              href="https://github.com/ExtenSilica/ExtenSilica/blob/main/docs/CLA.md"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              docs/CLA.md
            </a>{" "}
            and{" "}
            <a
              href="https://github.com/ExtenSilica/ExtenSilica/blob/main/CONTRIBUTING.md"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              CONTRIBUTING.md
            </a>{" "}
            in the platform repository.
          </p>
          <p>
            Report security-sensitive issues through the contact path in our{" "}
            <Link href="/legal/terms" className="text-primary underline">
              Terms
            </Link>
            ; do not open public issues for undisclosed vulnerabilities.
          </p>
        </InfoSection>

        <InfoSection id="xsil" title="XSIL contribution tokens">
          <p>
            Verified Target support may earn{" "}
            <Link href="/token" className="text-primary underline">
              XSIL
            </Link>{" "}
            governance points. Publishing metadata earns nothing. Grants are issued after evidence
            passes verification; linking a
            wallet is optional and only used for on-chain claim when enabled.
          </p>
          <XsilDisclaimerNotice variant="box" className="mt-4" />
        </InfoSection>

        <InfoSection id="governance" title="Governance & metrics">
          <p>
            Read <Link href="/governance" className="text-primary underline">Governance</Link>{" "}
            for stewardship boundaries and{" "}
            <Link href="/adoption" className="text-primary underline">Adoption</Link>{" "}
            for public usage metrics used in foundation discussions.
          </p>
        </InfoSection>
      </div>
    </InfoPage>
  );
}
