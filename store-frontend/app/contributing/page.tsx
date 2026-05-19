import type { Metadata } from "next";
import Link from "next/link";
import {
  InfoPage,
  InfoSection,
  InfoUl,
  InfoC,
  InfoStrong,
} from "@/components/info-page";

export const metadata: Metadata = {
  title: "Contributing — ExtenSilica",
  description:
    "How to publish .xsil packages, coordinate implementation work, and contribute to the registry platform.",
};

export default function ContributingPage() {
  return (
    <InfoPage
      title="Contributing"
      subtitle="Open technical contribution — reputation and citation, not platform payments."
      updated="May 2026"
      current="/contributing"
    >
      <div className="space-y-10">
        <InfoSection id="principles" title="Principles">
          <p>
            ExtenSilica is built for <InfoStrong>reproducible RISC-V extension work</InfoStrong>.
            Contribution is measured by useful packages, verified implementations, public
            profiles, and citable artifacts — not by payments processed on this site.
          </p>
        </InfoSection>

        <InfoSection id="registry-vs-platform" title="Registry vs platform code">
          <p>
            The registry accepts <InfoStrong>.xsil packages</InfoStrong> via{" "}
            <InfoC>xsil publish</InfoC> — not git commits or pull requests to ExtenSilica’s
            private platform repository.
          </p>
          <InfoUl>
            <li>
              <InfoStrong>Publishing a package</InfoStrong> does{" "}
              <InfoStrong>not</InfoStrong> require ExtenSilica’s Contributor License
              Agreement (CLA). Your package stays under the SPDX license you declare in the
              manifest and archive.
            </li>
            <li>
              An optional <InfoC>repository</InfoC> URL in the manifest (for example GitHub)
              points readers to <em>your</em> upstream project; we do not take ownership of
              that repo by listing the package.
            </li>
            <li>
              The <InfoStrong>CLA</InfoStrong> applies only if you contribute{" "}
              <InfoStrong>platform source code</InfoStrong> (API, website, deploy tooling) via
              pull request to the private ExtenSilica platform repository — a separate path
              from publishing.
            </li>
          </InfoUl>
        </InfoSection>

        <InfoSection id="packages" title="Publish a package">
          <InfoUl>
            <li>
              Scaffold with the{" "}
              <Link href="/wizard" className="text-primary underline">
                Extension Wizard
              </Link>{" "}
              or <InfoC>xsil new</InfoC>, then publish with <InfoC>xsil publish</InfoC>.
            </li>
            <li>
              Set honest <InfoC>standardStatus</InfoC> and readiness metadata; do not
              imply ratification or official endorsement without authority.
            </li>
            <li>
              Add a README on the package page and link your source repository when
              public.
            </li>
            <li>
              Use the package page <InfoStrong>Cite</InfoStrong> block (CFF + BibTeX) for
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
            Package maintainers and the community can open{" "}
            <Link href="/requests" className="text-primary underline">
              implementation requests
            </Link>{" "}
            to coordinate porting, tests, or verification work:
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
            listing, use the ownership-claim flow on the package page. Claims are
            reviewed by platform admins with evidence you control the work.
          </p>
        </InfoSection>

        <InfoSection id="platform" title="Platform code (optional)">
          <p>
            The registry web app, API, and tooling live in a{" "}
            <InfoStrong>private</InfoStrong> platform repository under the{" "}
            <a
              href="https://github.com/ExtenSilica"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              ExtenSilica GitHub organization
            </a>
            . Most contributors only publish <InfoC>.xsil</InfoC> packages and never touch
            that codebase.
          </p>
          <p>
            If you open a <InfoStrong>pull request to the platform repository</InfoStrong>{" "}
            (not a package publish), you must accept the{" "}
            <InfoStrong>Individual Contributor License Agreement (CLA)</InfoStrong> and
            contribute under Apache-2.0 — see{" "}
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
