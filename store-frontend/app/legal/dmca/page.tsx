import type { Metadata } from "next";
import { LegalPage, Section, Ul, Strong } from "@/components/legal-page";
import DmcaForm from "./dmca-form";

export const metadata: Metadata = {
  title: "DMCA / Takedown Request — ExtenSilica",
  description:
    "Submit a DMCA or intellectual property takedown request for content published on the ExtenSilica registry.",
};

export default function DmcaPage() {
  return (
    <LegalPage
      title="DMCA / Takedown Request"
      subtitle="If you believe content published on ExtenSilica infringes your intellectual property rights, use this page to submit a formal takedown request."
      updated="May 9, 2026"
      current="/legal/dmca"
    >
      <div className="space-y-10">

        <Section id="overview" title="Overview">
          <p>
            ExtenSilica respects intellectual property rights and complies with the
            Digital Millennium Copyright Act (<Strong>DMCA</Strong>) and equivalent
            laws in other jurisdictions. We will respond promptly to valid takedown
            requests.
          </p>
          <p>
            Before submitting, please confirm that:
          </p>
          <Ul>
            <li>You are the rights holder or authorized to act on their behalf.</li>
            <li>
              The content is actually infringing — filing a knowingly false DMCA
              claim is a violation of 17 U.S.C. § 512(f) and may expose you to
              liability.
            </li>
            <li>
              You have not already resolved this directly with the package author.
              Many issues can be resolved quickly through communication.
            </li>
          </Ul>
        </Section>

        <Section id="seeded-packages" title="If You Are the Upstream Maintainer of a Seeded Package">
          <p>
            ExtenSilica auto-publishes a subset of packages using a designated
            catalog-seed bot account, sourcing metadata and content from public
            upstream repositories. These packages are badged{" "}
            <Strong>&ldquo;Seeded&rdquo;</Strong> on the package page so visitors
            can see they have not (yet) been blessed by the upstream maintainer.
            See{" "}
            <a href="/legal/terms#catalog-labels" className="text-primary underline">
              Terms § 3 — Catalog Labels and Catalog-Seeded Packages
            </a>{" "}
            for the full description.
          </p>
          <p>
            If you are the upstream maintainer of such an extension and you want
            it taken down or moved under your control, the fastest path is{" "}
            <Strong>usually not</Strong> a DMCA notice. Instead, go to the
            package page and use the{" "}
            <Strong>&ldquo;Request authorship&rdquo;</Strong> flow:
          </p>
          <Ul>
            <li>
              You become the owner of the package. Its <Strong>portStatus</Strong>{" "}
              flips to <Strong>&ldquo;Claimed&rdquo;</Strong> automatically.
            </li>
            <li>
              You can immediately yank versions, edit metadata, publish updates,
              or — if you prefer — ask us to delete the package entirely.
            </li>
            <li>
              You keep the original install history and identifiers, which is
              important if anyone is already depending on the package.
            </li>
          </Ul>
          <p>
            A DMCA notice is still appropriate when the package contains content
            you did <Strong>not</Strong> publish openly upstream (private source,
            proprietary binaries, etc.), when our seed agent misattributed
            authorship, or when claim-by-request is not workable for any reason.
            In those cases please use the form at the bottom of this page.
          </p>
        </Section>

        <Section id="process" title="Our Process">
          <p>
            When we receive a valid takedown request we will:
          </p>
          <Ul>
            <li>
              <Strong>Acknowledge</Strong> receipt as soon as reasonably possible.
            </li>
            <li>
              <Strong>Notify</Strong> the package author of the claim and give them
              an opportunity to respond or remove the content.
            </li>
            <li>
              <Strong>Act</Strong> within a reasonable timeframe — typically by yanking
              the affected version(s) or removing the package. Complete deletion of
              artifacts is reserved for confirmed illegal content or court orders.
            </li>
            <li>
              <Strong>Restore</Strong> content if a valid counter-notice is received
              and no court order prevents restoration (see counter-notice section below).
            </li>
          </Ul>
        </Section>

        <Section id="counter-notice" title="Counter-Notice">
          <p>
            If your content was removed in response to a DMCA claim you believe was
            filed in error or misidentified, you may submit a counter-notice to{" "}
            <a
              href="mailto:legal@extensilica.com"
              className="text-primary underline"
            >
              legal@extensilica.com
            </a>
            {" "}with the following information:
          </p>
          <Ul>
            <li>Your name, address, phone number, and email address.</li>
            <li>
              Identification of the content that was removed and its location before
              removal.
            </li>
            <li>
              A statement under penalty of perjury that you have a good faith belief
              the content was removed by mistake or misidentification.
            </li>
            <li>
              A statement that you consent to the jurisdiction of the federal court in
              your district, and that you will accept service of process from the
              original complainant.
            </li>
            <li>Your physical or electronic signature.</li>
          </Ul>
          <p>
            Upon receiving a valid counter-notice we will notify the original
            complainant and, where required by applicable law, restore the content
            unless the complainant seeks a court order.
          </p>
        </Section>

        <Section id="repeat-infringers" title="Repeat Infringers">
          <p>
            ExtenSilica maintains a policy of terminating accounts of users who are
            found to be repeat infringers of intellectual property rights, in
            appropriate circumstances.
          </p>
        </Section>

        <Section id="submit" title="Submit a Takedown Request">
          <p>
            Complete the form below. All fields marked <Strong>*</Strong> are
            required. You can also email{" "}
            <a
              href="mailto:legal@extensilica.com"
              className="text-primary underline"
            >
              legal@extensilica.com
            </a>
            {" "}directly if you prefer.
          </p>

          <div className="pt-4">
            <DmcaForm />
          </div>
        </Section>

      </div>
    </LegalPage>
  );
}
