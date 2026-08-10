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
    "How to publish, maintain, and improve RISC-V extension packages in ExtenSilica.",
};

export default function ContributingPage() {
  return (
    <InfoPage
      title="Contributing"
      subtitle="Improve the public technical record for RISC-V extensions."
      updated="August 2026"
      current="/contributing"
    >
      <div className="space-y-10">
        <InfoSection id="principles" title="Principles">
          <p>
            ExtenSilica is built for <InfoStrong>reproducible RISC-V extension work</InfoStrong>.
            Useful contributions improve a real package: provenance, specifications, encodings,
            dependencies, artifacts, tests, examples, or documentation. Catalog volume alone is
            not a contribution.
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

        <InfoSection id="package-work" title="Improve an existing package">
          <p>
            Package maintainers and community contributors can improve the technical archive without
            turning ExtenSilica into a separate porting framework:
          </p>
          <InfoUl>
            <li>Update a specification, version, encoding, CSR range, or dependency</li>
            <li>Add reproducible simulator, toolchain, RTL, test, example, or hardware artifacts</li>
            <li>Correct provenance and claim maintenance of a package you control upstream</li>
            <li>Report duplicate, misleading, stale, or unverifiable metadata</li>
          </InfoUl>
          <p>
            Coordinate changes in the package&apos;s upstream repository or through the contact channels
            on its registry page. Published versions remain immutable; corrections ship as a new version.
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
            Verified engineering work that improves the extension catalog may earn{" "}
            <Link href="/token" className="text-primary underline">
              XSIL
            </Link>{" "}
            governance tokens. Publishing empty or duplicate metadata earns nothing. Grants are
            reviewed according to the value, provenance, and reproducibility of the contribution;
            linking a wallet is optional and only used for on-chain claim when enabled.
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
