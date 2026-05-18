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
      updated="May 9, 2026"
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

        <Section id="stewardship" title="3. Stewardship and technical coordination">
          <p>
            ExtenSilica Ltda. operates the Service as interim technical steward of the
            public registry and <C>.xsil</C> format. We coordinate open technical work
            (publication, ownership claims, implementation requests, verification) and
            publish adoption metrics. We do <Strong>not</Strong> hold user funds, process
            payments, set prices, or broker contracts on the Service.
          </p>
          <p>
            Optional funding-contact fields on implementation requests are pointers to
            off-platform arrangements only. See{" "}
            <a href="/governance" className="text-primary underline">
              Governance
            </a>{" "}
            and{" "}
            <a href="/contributing" className="text-primary underline">
              Contributing
            </a>{" "}
            on this site for more detail.
          </p>
        </Section>

        <Section id="catalog-labels" title="4. Catalog Labels and Catalog-Seeded Packages">
          <p>
            <Strong>Honest classification (<C>standardStatus</C>).</Strong> Every
            package on ExtenSilica is labeled with one of five values describing
            its relationship to the RISC-V standard: <C>ratified</C>,{" "}
            <C>draft</C>, <C>vendor</C>, <C>research</C>, or <C>custom</C>. The
            label is set by the publisher (or, for catalog-seeded packages, by
            ExtenSilica based on public upstream sources) and is informational
            only. ExtenSilica does not warrant the accuracy of any label and is
            not a substitute for the canonical specification published by{" "}
            <Strong>RISC-V International</Strong> or any other standards body.
            References to RISC-V International, vendor names, or research groups
            in catalog labels and metadata are descriptive and do not imply
            endorsement, sponsorship, or affiliation.
          </p>
          <p>
            <Strong>Provenance (<C>portStatus</C>).</Strong> ExtenSilica
            additionally tracks how a package was put on the platform:{" "}
            <C>seeded</C> (auto-published by our catalog-seed agent from public
            upstream sources), <C>community_port</C> (ported by a non-upstream
            community member), <C>claimed</C> (the current owner went through
            the ownership-claim flow), <C>official</C> (an ExtenSilica admin
            verified the publisher&rsquo;s identity / affiliation), or{" "}
            <C>archived</C>. This field is set by the Service, never by the
            publisher, and is shown as a badge on the package page.
          </p>
          <p>
            <Strong>Catalog-seeded packages.</Strong> A subset of packages on
            ExtenSilica are auto-published by us using a designated bot account
            (a &ldquo;<Strong>catalog-seed agent</Strong>&rdquo;) sourcing
            metadata and content from public upstream repositories. These
            packages:
          </p>
          <Ul>
            <li>
              Are clearly badged as <C>seeded</C> in the UI so visitors can see
              they have not (yet) been blessed by the upstream maintainer.
            </li>
            <li>
              Are distributed under the same license declared by the upstream
              project. ExtenSilica does not relicense upstream content.
            </li>
            <li>
              Do not imply that the upstream maintainer endorses, sponsors, or
              is affiliated with ExtenSilica.
            </li>
            <li>
              May be claimed by the upstream maintainer at any time via the{" "}
              <Strong>Request authorship</Strong> flow described in Section 4
              below, or removed on request (see Section 8).
            </li>
          </Ul>
        </Section>

        <Section id="ownership-claims" title="5. Ownership and Authorship Claims">
          <p>
            <Strong>Authors retain ownership.</Strong> ExtenSilica does not claim
            any intellectual property rights over packages — whether published by
            their authors or ported by the catalog-seed agent. Each package is
            distributed under the license declared in its manifest.
          </p>
          <p>
            <Strong>Request authorship.</Strong> If you are the upstream
            maintainer of an extension that appears on ExtenSilica under another
            account (typically a catalog-seed bot account, or a community
            porter), you may file an <Strong>ownership request</Strong> from the
            package page. ExtenSilica administrators review each request and, on
            approval, transfer the package ownership to your account and flip
            its <C>portStatus</C> to <C>claimed</C>. Approval is at our
            discretion; we may require evidence of upstream affiliation
            (commit-signing GPG keys, domain control, official repository
            membership, etc.).
          </p>
          <p>
            Filing a knowingly false ownership request, or one made in bad
            faith, may result in account suspension and counts as a violation of
            these Terms.
          </p>
        </Section>

        <Section id="accounts" title="6. Accounts and Registration">
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

        <Section id="content" title="7. Published Content and Package Author Responsibility">
          <p>
            <Strong>License grant.</Strong> By publishing a package you grant
            ExtenSilica and its users a worldwide, royalty-free, non-exclusive
            license to store, distribute, display, and access the package under
            the license you declare in the package manifest. This license is
            necessary to operate the registry. (See Section 4 above for our
            ownership / authorship rules.)
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

        <Section id="intellectual-property" title="8. Intellectual Property of the Service">
          <p>
            The ExtenSilica website, registry infrastructure, and <C>xsil</C> CLI are
            open-source software. The name &ldquo;ExtenSilica&rdquo; and associated
            branding are owned by the project maintainers. You may not use the
            ExtenSilica name or logo in a way that implies endorsement or affiliation
            without prior written permission.
          </p>
        </Section>

        <Section id="prohibited" title="9. Prohibited Conduct">
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
              Impersonate another person, organization, or official project, or
              file an ownership request claiming to represent a project you do
              not actually maintain.
            </li>
            <li>
              Upload content that infringes the intellectual property rights of others.
            </li>
            <li>
              Mislabel a package&rsquo;s <C>standardStatus</C> — in particular,
              labeling a non-frozen extension as <C>ratified</C>. The registry
              audits these labels periodically; repeated misrepresentation may
              result in package removal and account suspension.
            </li>
            <li>
              Use the Service in any manner inconsistent with applicable laws or
              regulations.
            </li>
          </Ul>
        </Section>

        <Section id="moderation" title="10. Content Moderation and Removal">
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
            <Strong>Seeded packages — preferred remedy.</Strong> If you are the
            upstream maintainer of a package that ExtenSilica has auto-published
            under our catalog-seed bot account (badged <C>seeded</C>), the fastest
            remedy in most cases is to <Strong>claim authorship</Strong> via the
            ownership-request flow described in Section 4. Once approved you
            become the owner of the package and can yank, update, or have it
            removed at your discretion. A DMCA or takedown request is also
            available, but claiming the package is usually faster and lets you
            keep its install history and identifiers intact.
          </p>
          <p>
            <Strong>Yanking vs. deletion.</Strong> Because published versions are
            immutable by design, most enforcement actions result in a version being{" "}
            <em>yanked</em> — marked as unsafe and excluded from normal resolution —
            rather than deleted. Deletion of package artifacts is reserved for
            situations involving illegal content or court orders.
          </p>
        </Section>

        <Section id="immutability" title="11. Version Immutability">
          <p>
            Once a package version is successfully published it cannot be overwritten.
            You may publish a new version to supersede an older one, or yank a version
            to flag it as unsafe, but the original artifact and its metadata remain in
            the registry. This immutability is a core guarantee of the Service and
            enables reproducible builds.
          </p>
        </Section>

        <Section id="termination" title="12. Account Suspension and Termination">
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

        <Section id="disclaimer" title="13. Disclaimer of Warranties">
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
          <p>
            <Strong>Catalog labels are informational.</Strong> The{" "}
            <C>standardStatus</C>, <C>authority</C>, and <C>portStatus</C>{" "}
            fields displayed on package pages are best-effort metadata. They do
            not constitute legal advice, technical certification, an
            endorsement, or a representation of conformance with any
            specification or standard. Always consult the canonical
            specification and the upstream maintainer before relying on a
            package for production use.
          </p>
        </Section>

        <Section id="liability" title="14. Limitation of Liability">
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

        <Section id="indemnification" title="15. Indemnification">
          <p>
            You agree to indemnify, defend, and hold harmless ExtenSilica and its
            contributors from and against any claims, damages, obligations, losses,
            liabilities, costs, or expenses (including reasonable legal fees) arising
            from: (a) your use of the Service; (b) your published packages; (c) your
            violation of these Terms; or (d) your violation of any third-party right.
          </p>
        </Section>

        <Section id="changes" title="16. Changes to These Terms">
          <p>
            We may update these Terms from time to time. When we make material changes
            we will update the &ldquo;Last updated&rdquo; date at the top of this page
            and announce the change via the project&rsquo;s GitHub repository. Your
            continued use of the Service after changes take effect constitutes
            acceptance of the revised Terms.
          </p>
        </Section>

        <Section id="governing-law" title="17. Governing Law">
          <p>
            These Terms shall be governed by and construed in accordance with
            applicable law. Any disputes arising under these Terms shall be resolved
            through good-faith negotiation, and if necessary, through binding
            arbitration or the courts of competent jurisdiction.
          </p>
        </Section>

        <Section id="contact" title="18. Contact">
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
