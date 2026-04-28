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
      updated="March 2026"
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
