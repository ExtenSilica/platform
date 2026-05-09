import type { Metadata } from "next";
import { LegalPage, Section, Ul, C, Strong } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service — ExtenSilica",
  description:
    "Terms governing your use of the ExtenSilica .xsil package registry.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      subtitle="Please read these terms carefully before using the ExtenSilica registry."
      updated="May 2026"
      current="/legal/terms"
    >
      <div className="space-y-10">

        <Section id="acceptance" title="1. Acceptance of Terms">
          <p>
            By accessing or using ExtenSilica (the &ldquo;Service&rdquo;) — including
            the website, the registry API, and the <C>xsil</C> command-line tool —
            you agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If
            you do not agree to these Terms you must not use the Service.
          </p>
          <p>
            If you are using the Service on behalf of an organization, you represent
            that you have the authority to bind that organization to these Terms.
          </p>
        </Section>

        <Section id="service" title="2. Description of the Service">
          <p>
            ExtenSilica is a free, public package registry for{" "}
            <C>.xsil</C> packages — versioned, self-describing archives containing
            RISC-V simulation assets, toolchains, test suites, documentation, and
            optional FPGA artifacts. The Service allows registered users to publish
            packages and permits anyone to discover, browse, and download them.
          </p>
          <p>
            The Service additionally offers an <Strong>Extension Wizard</Strong>{" "}
            (web form at <C>/wizard</C> and CLI command <C>xsil new</C>) that
            scaffolds a <C>.xsil</C> skeleton — manifest, opcode header, Spike
            extension stub, examples, tests, license, and changelog — without
            requiring an account. The wizard generates files locally (CLI) or
            streams them in-memory to your browser (web); it does not publish on
            your behalf.
          </p>
          <p>
            The Service is provided free of charge. We reserve the right to
            introduce usage limits or modify the feature set at any time with
            reasonable notice.
          </p>
        </Section>

        <Section id="accounts" title="3. Accounts and Registration">
          <p>
            Publishing packages requires a registered account. When you create an
            account you agree to:
          </p>
          <Ul>
            <li>
              Provide accurate, complete, and current registration information.
            </li>
            <li>
              Maintain the confidentiality of your password and API token. You are
              solely responsible for all activity that occurs under your credentials.
            </li>
            <li>
              Notify us immediately if you become aware of any unauthorized use of
              your account.
            </li>
            <li>
              Not create accounts programmatically, in bulk, or for the purpose of
              abusing the Service.
            </li>
          </Ul>
          <p>
            You may not share, transfer, or sell your account or API token to another
            person or entity. Each account is personal to the individual or
            organization that created it.
          </p>
        </Section>

        <Section id="content" title="4. Published Content and Package Author Responsibility">
          <p>
            <Strong>Authors retain ownership.</Strong> ExtenSilica does not claim any
            intellectual property rights over packages you publish. By publishing a
            package you grant ExtenSilica and its users a worldwide, royalty-free,
            non-exclusive license to store, distribute, display, and access the package
            under the license you declare in the package manifest. This license is
            necessary to operate the registry.
          </p>
          <p>
            <Strong>Authors are responsible for their content.</Strong> By publishing a
            package you represent and warrant that:
          </p>
          <Ul>
            <li>
              You have the legal right to publish the package and all files it contains
              under the declared license.
            </li>
            <li>
              The package does not contain malware, ransomware, spyware, cryptocurrency
              miners, rootkits, or any code designed or likely to cause harm to users,
              their systems, or third parties.
            </li>
            <li>
              The package does not infringe any patent, trademark, trade secret,
              copyright, or other intellectual property right of any third party.
            </li>
            <li>
              The package does not contain content that is defamatory, fraudulent,
              deceptive, or that violates applicable law.
            </li>
            <li>
              Any executable artifacts included in the package (simulation binaries,
              scripts, FPGA bitstreams) perform only the functions described in the
              package documentation.
            </li>
          </Ul>
          <p>
            <Strong>Executable artifacts.</Strong> Because <C>.xsil</C> packages may
            contain executable code (simulation entry points, test scripts, RISC-V
            binaries), users who install and run packages do so at their own risk. We
            strongly recommend reviewing package source and checksums before executing
            content from unknown authors. ExtenSilica verifies archive integrity via
            SHA-256 checksums but does not perform behavioral analysis of package
            contents.
          </p>
        </Section>

        <Section id="intellectual-property" title="5. Intellectual Property of the Service">
          <p>
            The ExtenSilica website, registry infrastructure, and <C>xsil</C> CLI are
            open-source software. The name &ldquo;ExtenSilica&rdquo; and associated
            branding are owned by the project maintainers. You may not use the
            ExtenSilica name or logo in a way that implies endorsement or affiliation
            without prior written permission.
          </p>
        </Section>

        <Section id="prohibited" title="6. Prohibited Conduct">
          <p>You may not use the Service to:</p>
          <Ul>
            <li>
              Publish or distribute malicious, harmful, unlawful, or abusive content
              of any kind.
            </li>
            <li>
              Circumvent, disable, or otherwise interfere with security features of
              the Service.
            </li>
            <li>
              Attempt to gain unauthorized access to the Service, other accounts, or
              any connected systems.
            </li>
            <li>
              Conduct denial-of-service attacks, excessive automated scraping, or any
              activity that degrades the Service for others.
            </li>
            <li>
              Register usernames or package names with the intent to squat, sell, or
              mislead (e.g., typosquatting popular packages).
            </li>
            <li>
              Impersonate another person, organization, or official project.
            </li>
            <li>
              Upload content that infringes the intellectual property rights of others.
            </li>
            <li>
              Use the Service in any manner inconsistent with applicable laws or
              regulations.
            </li>
          </Ul>
        </Section>

        <Section id="moderation" title="7. Content Moderation and Removal">
          <p>
            ExtenSilica reserves the right — but not the obligation — to review,
            moderate, and remove content that violates these Terms or that we
            determine in our sole discretion to be harmful, unlawful, or abusive.
          </p>
          <p>
            <Strong>Takedown requests.</Strong> If you believe a package infringes
            your intellectual property rights, please use our formal{" "}
            <a href="/legal/dmca" className="text-primary underline">
              DMCA / Takedown Request
            </a>
            {" "}page. You will be asked to provide:
          </p>
          <Ul>
            <li>The package name and version(s) at issue.</li>
            <li>A description and URL of your original work.</li>
            <li>An explanation of how the package infringes your rights.</li>
            <li>Your contact information and electronic signature.</li>
          </Ul>
          <p>
            We aim to acknowledge receipt promptly and take appropriate action — typically
            yanking or removing the affected version(s) — within a reasonable timeframe,
            depending on the completeness of the request and the nature of the claim.
          </p>
          <p>
            <Strong>Yanking vs. deletion.</Strong> Because published versions are
            immutable by design, most enforcement actions result in a version being{" "}
            <em>yanked</em> — marked as unsafe and excluded from normal resolution —
            rather than deleted. Deletion of package artifacts is reserved for
            situations involving illegal content or court orders.
          </p>
        </Section>

        <Section id="immutability" title="8. Version Immutability">
          <p>
            Once a package version is successfully published it cannot be overwritten.
            You may publish a new version to supersede an older one, or yank a version
            to flag it as unsafe, but the original artifact and its metadata remain in
            the registry. This immutability is a core guarantee of the Service and
            enables reproducible builds.
          </p>
        </Section>

        <Section id="termination" title="9. Account Suspension and Termination">
          <p>
            We reserve the right to suspend or terminate accounts that violate these
            Terms, engage in abusive behavior, or that have been inactive for an
            extended period. We will generally provide notice before taking such action
            except where immediate action is necessary to protect the Service or its
            users.
          </p>
          <p>
            You may close your account at any time. Account closure removes your
            personal data (subject to the retention rules in our Privacy Policy) but
            does not delete packages you have published, as other users may depend on
            them. Packages from closed accounts remain in the registry under their
            last recorded authorship.
          </p>
        </Section>

        <Section id="disclaimer" title="10. Disclaimer of Warranties">
          <p>
            The Service is provided <Strong>&ldquo;as is&rdquo;</Strong> and{" "}
            <Strong>&ldquo;as available&rdquo;</Strong> without warranty of any kind,
            express or implied, including but not limited to warranties of
            merchantability, fitness for a particular purpose, non-infringement, or
            uninterrupted availability.
          </p>
          <p>
            We do not warrant that the Service will be error-free, that defects will
            be corrected, or that the Service or the servers that make it available are
            free of viruses or other harmful components. We do not endorse, verify, or
            accept any responsibility for the accuracy, completeness, or safety of
            third-party packages published on the registry.
          </p>
        </Section>

        <Section id="liability" title="11. Limitation of Liability">
          <p>
            To the maximum extent permitted by applicable law, ExtenSilica and its
            contributors, maintainers, and operators shall not be liable for any
            indirect, incidental, special, consequential, or punitive damages —
            including loss of data, loss of revenue, or damage to systems — arising
            out of or related to your use of or inability to use the Service, even if
            advised of the possibility of such damages.
          </p>
          <p>
            Our total liability to you for any claim arising out of these Terms or the
            Service shall not exceed the amount you paid us in the twelve months
            preceding the claim (which, given that the Service is free, is zero). Some
            jurisdictions do not allow the exclusion of certain warranties or
            limitation of certain liabilities; those limitations apply only to the
            extent permitted by law.
          </p>
        </Section>

        <Section id="indemnification" title="12. Indemnification">
          <p>
            You agree to indemnify, defend, and hold harmless ExtenSilica and its
            contributors from and against any claims, damages, obligations, losses,
            liabilities, costs, or expenses (including reasonable legal fees) arising
            from: (a) your use of the Service; (b) your published packages; (c) your
            violation of these Terms; or (d) your violation of any third-party right.
          </p>
        </Section>

        <Section id="changes" title="13. Changes to These Terms">
          <p>
            We may update these Terms from time to time. When we make material changes
            we will update the &ldquo;Last updated&rdquo; date at the top of this page
            and announce the change via the project&rsquo;s GitHub repository. Your
            continued use of the Service after changes take effect constitutes
            acceptance of the revised Terms.
          </p>
        </Section>

        <Section id="governing-law" title="14. Governing Law">
          <p>
            These Terms shall be governed by and construed in accordance with
            applicable law. Any disputes arising under these Terms shall be resolved
            through good-faith negotiation, and if necessary, through binding
            arbitration or the courts of competent jurisdiction.
          </p>
        </Section>

        <Section id="contact" title="15. Contact">
          <p>
            Questions, abuse reports, and takedown requests can be sent to{" "}
            <a
              href="mailto:legal@extensilica.com"
              className="text-primary underline"
            >
              legal@extensilica.com
            </a>
            {" "}or submitted via the project&rsquo;s{" "}
            <a
              href="https://github.com/ExtenSilica/xsil"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              GitHub repository
            </a>
            .
          </p>
        </Section>

      </div>
    </LegalPage>
  );
}
