import type { Metadata } from "next";
import Link from "next/link";
import {
  InfoPage,
  InfoSection,
  InfoUl,
  InfoC,
  InfoStrong,
} from "@/components/info-page";
import { CONTACT_EMAIL, LEGAL_EMAIL, SUPPORT_EMAIL } from "@/lib/site-contact";

export const metadata: Metadata = {
  title: "About — ExtenSilica",
  description:
    "What the ExtenSilica RISC-V extension registry stores, who operates it, and where the team is based.",
};

export default function AboutPage() {
  return (
    <InfoPage
      title="About ExtenSilica"
      subtitle="A public catalog for versioned RISC-V ISA extension packages."
      updated="August 2026"
      current="/about"
    >
      <div className="space-y-10">
        <InfoSection id="mission" title="What we build">
          <p>
            ExtenSilica is a <InfoStrong>free, public registry for RISC-V ISA extensions</InfoStrong>.
            It gives maintainers one place to publish versioned packages and gives users one place
            to discover, inspect, install, and cite them.
          </p>
          <p>
            The open <InfoC>.xsil</InfoC> format carries identity, upstream provenance, ISA
            requirements, encodings, dependencies, documentation, checksums, and optional
            simulator, toolchain, RTL, test, example, or hardware artifacts. ExtenSilica stores
            and indexes that package metadata without making claims beyond what the archive declares.
          </p>
        </InfoSection>

        <InfoSection id="operator" title="Who operates the registry">
          <p>
            The platform is operated by <InfoStrong>ExtenSilica</InfoStrong> as interim
            technical steward. ExtenSilica is an independent project and is{" "}
            <InfoStrong>not affiliated with RISC-V International</InfoStrong>.
          </p>
          <p>
            For stewardship boundaries, funding policy, and XSIL governance tokens, see{" "}
            <Link href="/governance" className="text-primary underline">
              Governance
            </Link>{" "}
            and{" "}
            <Link href="/contributing" className="text-primary underline">
              Contributing
            </Link>
            .
          </p>
        </InfoSection>

        <InfoSection id="location" title="Where we are based">
          <p>
            <InfoStrong>São Paulo, Brazil</InfoStrong>
          </p>
          <p>
            The registry and website are built and maintained from São Paulo. Community
            contributors and Extension maintainers participate from many countries; the registry
            itself is global and not limited to a single jurisdiction.
          </p>
        </InfoSection>

        <InfoSection id="contact" title="Contact">
          <InfoUl>
            <li>
              General inquiries:{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">
                {CONTACT_EMAIL}
              </a>
            </li>
            <li>
              Legal and policy:{" "}
              <a href={`mailto:${LEGAL_EMAIL}`} className="text-primary underline">
                {LEGAL_EMAIL}
              </a>
            </li>
            <li>
              Account and registry support:{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary underline">
                {SUPPORT_EMAIL}
              </a>
            </li>
            <li>
              Code and issues:{" "}
              <a
                href="https://github.com/ExtenSilica"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                github.com/ExtenSilica
              </a>
            </li>
            <li>
              <Link href="/faq" className="text-primary underline">
                FAQ
              </Link>{" "}
              — publishing, accounts, and registry policy
            </li>
          </InfoUl>
        </InfoSection>
      </div>
    </InfoPage>
  );
}
