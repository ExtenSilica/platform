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
    "What ExtenSilica verifies, who operates the public RISC-V portability registry, and where the team is based.",
};

export default function AboutPage() {
  return (
    <InfoPage
      title="About ExtenSilica"
      subtitle="Public evidence for RISC-V extension implementations across cores and tools."
      updated="August 2026"
      current="/about"
    >
      <div className="space-y-10">
        <InfoSection id="mission" title="What we build">
          <p>
            ExtenSilica is a <InfoStrong>free, public portability registry</InfoStrong>.
            An Extension records architectural intent, encoding, dependencies, and provenance.
            Each implementation or support claim is attached to a concrete Target and backed by
            reproducible evidence.
          </p>
          <p>
            Versioned <InfoC>.xsil</InfoC> archives transport Extension definitions and preserved
            Port artifacts. The catalog does not promote implementation artifacts into new
            Extensions, and it never infers support for an Extension as a whole.
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
