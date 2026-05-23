import type { Metadata } from "next";
import { LegalPage, Section, Ul, C, Strong } from "@/components/legal-page";
import { LEGAL_EMAIL, SUPPORT_EMAIL } from "@/lib/site-contact";
import { XsilDisclaimerNotice } from "@/components/xsil-disclaimer-notice";

export const metadata: Metadata = {
  title: "Privacy Policy — ExtenSilica",
  description:
    "How ExtenSilica collects, uses, and protects data from registry users.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      subtitle="We collect the minimum amount of data necessary to operate the registry. We do not sell your data, serve advertising, or use third-party analytics."
      updated="May 9, 2026"
      current="/legal/privacy"
    >
      <div className="space-y-10">

        <Section id="overview" title="Overview">
          <p>
            ExtenSilica is a public package registry for <C>.xsil</C> packages. This
            policy explains what data we collect, why we collect it, how we store it,
            and your rights with respect to it.
          </p>
          <p>
            Our analytics model is intentionally <Strong>package-centric, not
            user-surveillance-centric</Strong>. Download statistics track which packages
            and versions are downloaded and on which day — not who downloaded them.
            No user identity is attached to download events.
          </p>
        </Section>

        <Section id="data-collected" title="1. Data We Collect">

          <p><Strong>1.1  Account registration</Strong></p>
          <p>When you create an account we collect:</p>
          <Ul>
            <li><Strong>Username</Strong> — public identifier for your account and packages.</li>
            <li>
              <Strong>Email address</Strong> — used for account management and security
              notices. Never exposed publicly.
            </li>
            <li>
              <Strong>Password</Strong> — stored as a bcrypt hash (rounds ≥ 12).
              We never store or transmit your password in plaintext.
            </li>
            <li>
              <Strong>API token</Strong> — a random opaque token generated at login and
              used to authenticate CLI requests. Stored as a unique token; you can
              invalidate it at any time by logging out.
            </li>
            <li>
              <Strong>Optional profile fields</Strong> — bio text and avatar URL, if you
              choose to add them. Both are public.
            </li>
          </Ul>

          <p className="pt-2"><Strong>1.2  Package publishing</Strong></p>
          <p>When you publish a package we record:</p>
          <Ul>
            <li>
              Package metadata: name, slug, description, version, ISA, targets,
              toolchain, license, keywords, README, repository URL, changelog.
            </li>
            <li>
              Honest-classification fields you set on the package:{" "}
              <C>standardStatus</C> (ratified / draft / vendor / research /
              custom) and <C>authority</C> (free-text spec authority). These
              are public and rendered on the package page.
            </li>
            <li>The <C>.xsil</C> archive file, stored in blob storage.</li>
            <li>
              SHA-256 checksums of the archive and its non-manifest payload
              (computed client-side by the CLI and verified on the server).
            </li>
            <li>Publish timestamp and the authoring account ID.</li>
            <li>
              A server-set <C>portStatus</C> recording how the package was put on
              the platform (<C>seeded</C> for catalog-seed bot publishes,{" "}
              <C>claimed</C> after an approved ownership request,{" "}
              <C>official</C> after admin identity verification, etc.). This
              field is never read from the manifest you upload.
            </li>
          </Ul>

          <p className="pt-2">
            <Strong>1.2.1  Catalog-seeded packages.</Strong> A subset of packages
            on ExtenSilica are auto-published by us using a designated
            catalog-seed bot account sourcing content from public upstream
            repositories. The bot account is operated by ExtenSilica staff; no
            third-party account data is involved. Packages it publishes carry
            the upstream author&rsquo;s attribution (as visible in the upstream
            repository) and are clearly badged <C>seeded</C> in the UI. See{" "}
            <a href="/legal/terms#catalog-labels" className="text-primary underline">
              Terms § 3
            </a>{" "}
            for the policy and{" "}
            <a href="/legal/dmca#seeded-packages" className="text-primary underline">
              DMCA § &ldquo;Seeded packages&rdquo;
            </a>{" "}
            for the upstream-maintainer claim flow.
          </p>

          <p className="pt-2"><Strong>1.3  Download events</Strong></p>
          <p>
            When a <C>.xsil</C> file is downloaded we record a{" "}
            <Strong>daily bucket</Strong>: package ID, version ID, date, and
            download count. No user identity, IP address, or user-agent string is
            stored in this bucket. Download statistics are used solely to display
            per-package and per-version counters on the registry website.
          </p>

          <p className="pt-2"><Strong>1.4  Server access logs</Strong></p>
          <p>
            Our web servers produce standard HTTP access logs that include IP address,
            requested URL, HTTP method, response code, and timestamp. These logs are
            used for security investigation and service diagnostics and are purged
            after <Strong>30 days</Strong>.
          </p>

          <p className="pt-2"><Strong>1.5  Reviews</Strong></p>
          <p>
            When you submit a package review we store your user ID, the package ID,
            your rating (1–5), and your optional comment. Reviews are public and
            attributed to your username.
          </p>

          <p className="pt-2"><Strong>1.6  Organizations</Strong></p>
          <p>
            When you create or join an organization we store the organization
            slug, display name, optional description, optional avatar URL, and
            membership records (which user belongs to which organization, in what
            role — <Strong>owner</Strong>, <Strong>admin</Strong>, or{" "}
            <Strong>member</Strong>). Organization names, slugs, descriptions,
            avatars, and the public list of members are visible on the
            organization profile at <C>/orgs/&lt;slug&gt;</C>. Email addresses of
            members are never exposed through the organization page. Packages
            published under a scoped slug (<C>@org/pkg</C>) are attributed to the
            organization in the registry index.
          </p>

          <p className="pt-2"><Strong>1.7  Wizard generation</Strong></p>
          <p>
            The Extension Wizard (<C>POST /wizard/generate</C> and{" "}
            <C>xsil new</C>) builds a <C>.xsil</C> skeleton on demand. The web
            endpoint does not persist your wizard input; the request body is used
            in-memory to assemble the archive that is streamed back to your
            browser, then discarded. Standard server access logs (see 1.4) record
            the request URL, status, and timestamp without the body. The CLI
            variant runs entirely on your machine — no input or output leaves
            your host.
          </p>

          <p className="pt-2"><Strong>1.8  Ownership requests</Strong></p>
          <p>
            When you file a <Strong>Request authorship</Strong> for a package we
            store: the requesting user ID, the target package ID, the free-text
            <Strong> reason</Strong> you provide, optional <Strong>evidence
            URLs</Strong> (e.g., upstream repository, commit-signing GPG key,
            domain proof), the request status (<C>pending</C>, <C>approved</C>,{" "}
            <C>rejected</C>, <C>withdrawn</C>), and — once a decision is made —
            the deciding admin&rsquo;s user ID, the decision timestamp, and an
            optional decision note. The reason, evidence URLs, and decision note
            are visible to ExtenSilica platform admins reviewing the request.
            The summary of approved requests (who now owns which package) is
            public, as it is reflected in package ownership; the underlying
            reason, evidence URLs, and decision notes are not.
          </p>

        </Section>

        <Section id="use" title="2. How We Use Your Data">
          <Ul>
            <li>
              <Strong>Account data</Strong> (username, email, password hash, API
              token) is used to authenticate you, associate packages with your
              account, and contact you about security issues related to your account.
            </li>
            <li>
              <Strong>Package metadata and files</Strong> are indexed and made
              publicly available through the registry website and API.
            </li>
            <li>
              <Strong>Download event data</Strong> is aggregated to display download
              counts on package pages. It is not used for user profiling or advertising.
            </li>
            <li>
              <Strong>Server access logs</Strong> are used to investigate abuse,
              diagnose service outages, and monitor for unusual traffic patterns that
              may indicate an attack.
            </li>
          </Ul>
          <p>
            We do not use your data for advertising, sell it to third parties, or
            share it with any analytics or marketing service.
          </p>
        </Section>

        <Section id="public-data" title="3. What Is Publicly Visible">
          <p>
            The following information is visible to anyone who visits the registry,
            with or without an account:
          </p>
          <Ul>
            <li>Your username and optional bio / avatar.</li>
            <li>
              All packages you have published, including their full version history,
              metadata, download counts, and README content.
            </li>
            <li>Reviews you have written, attributed to your username.</li>
            <li>
              Ownership transfers resulting from approved authorship requests
              (the fact that user <em>X</em> is now the owner of package{" "}
              <em>Y</em> is public). The textual reason and evidence URLs you
              submitted in the request are <Strong>not</Strong> public — only
              platform admins see them.
            </li>
          </Ul>
          <p>
            Your <Strong>email address is never publicly exposed</Strong>. It is not
            included in any API response or public profile page.
          </p>
        </Section>

        <Section id="security" title="4. Security">
          <p>
            We take reasonable technical and organizational measures to protect your
            data:
          </p>
          <Ul>
            <li>Passwords are hashed with bcrypt (min. 12 rounds).</li>
            <li>
              API tokens are random, opaque strings stored in the database. Tokens
              are transmitted over HTTPS only.
            </li>
            <li>
              Package archive checksums are verified by the server on upload and by
              the CLI on install and run. Tampered or corrupted files are rejected.
            </li>
            <li>
              Access to production infrastructure is limited to authorized
              maintainers.
            </li>
          </Ul>
          <p>
            No security measure is perfect. If you discover a security vulnerability,
            please disclose it responsibly via the project&rsquo;s GitHub repository
            before making it public.
          </p>
        </Section>

        <Section id="retention" title="5. Data Retention">
          <Ul>
            <li>
              <Strong>Published package artifacts and metadata</Strong> are retained
              indefinitely. Version immutability is a core guarantee of the registry;
              users and tools that depend on packages must be able to reproduce their
              builds at any future time.
            </li>
            <li>
              <Strong>Account data</Strong> is retained for as long as your account
              exists. You may request account deletion at any time (see Your Rights
              below). On deletion we remove your email, password hash, and API token.
              Your username and published packages remain in the registry under your
              username to preserve authorship attribution.
            </li>
            <li>
              <Strong>Server access logs</Strong> are automatically purged after 30 days.
            </li>
            <li>
              <Strong>Download event buckets</Strong> are retained indefinitely as
              aggregate counters (no personal data is stored in them).
            </li>
            <li>
              <Strong>Ownership request records</Strong> (reason, evidence URLs,
              decision notes) are retained for audit purposes as long as the
              associated package exists. If you close your account they remain
              associated with the (now-anonymous) user ID; you may request their
              removal at the time you close your account.
            </li>
          </Ul>
        </Section>

        <Section id="cookies" title="6. Cookies and Tracking">
          <p>
            ExtenSilica does not set advertising cookies, cross-site tracking cookies,
            or fingerprinting scripts. No third-party analytics scripts (Google
            Analytics, Mixpanel, etc.) are loaded on any page.
          </p>
          <p>
            The website uses a single session mechanism: an API token stored in{" "}
            <C>localStorage</C> by the browser after you log in. This token is sent
            with authenticated API requests only. It is not a cookie and is not shared
            with any third party.
          </p>
        </Section>

        <Section id="third-parties" title="7. Third-Party Services">
          <p>
            <Strong>File storage.</Strong> <C>.xsil</C> archive files are stored in
            an S3-compatible object store. The storage provider processes file upload
            and download requests. We do not share personal account data with the
            storage provider; it receives only the file bytes and associated path.
          </p>
          <p>
            Beyond file storage, we do not integrate any external services that
            receive personal data. The registry is self-hosted.
          </p>
        </Section>

        <Section id="rights" title="8. Your Rights">
          <p>
            Depending on your jurisdiction you may have the right to:
          </p>
          <Ul>
            <li>
              <Strong>Access</Strong> the personal data we hold about you.
            </li>
            <li>
              <Strong>Correct</Strong> inaccurate data (e.g., update your email or bio
              in your account settings).
            </li>
            <li>
              <Strong>Delete</Strong> your account and the personal data associated
              with it (email, password hash, API token, bio, avatar). Note that
              published package artifacts and metadata cannot be deleted due to
              immutability guarantees and dependency considerations.
            </li>
            <li>
              <Strong>Withdraw consent</Strong> at any time by ceasing to use the
              Service and requesting account deletion.
            </li>
          </Ul>
          <p>
            To exercise any of these rights, open an issue or contact us via the
            project&rsquo;s{" "}
            <a
              href="https://github.com/ExtenSilica/xsil"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              GitHub repository
            </a>
            . We will respond within a reasonable time.
          </p>
        </Section>

        <Section id="children" title="9. Children's Privacy">
          <p>
            The Service is not directed at children under the age of 13. We do not
            knowingly collect personal data from children. If you believe we have
            inadvertently collected such data, please contact us immediately.
          </p>
        </Section>

        <Section id="changes" title="10. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. Material changes will
            be announced via the project&rsquo;s GitHub repository and reflected in
            the &ldquo;Last updated&rdquo; date at the top of this page. Continued
            use of the Service after changes take effect constitutes acceptance of the
            revised policy.
          </p>
        </Section>

        <Section id="xsil-governance" title="11. XSIL governance tokens & wallet linking">
          <p>
            If you participate in the optional XSIL contributor program, we store off-chain grant
            records (amount, reason, reference, status) and aggregate balances tied to your account.
            If you choose to link an Ethereum-compatible wallet, we store the verified address and
            link timestamp for claim workflows. We do not custody private keys.
          </p>
          <XsilDisclaimerNotice variant="box" className="mt-4" />
        </Section>

        <Section id="contact" title="12. Contact">
          <p>
            Privacy questions:{" "}
            <a href={`mailto:${LEGAL_EMAIL}`} className="text-primary underline">
              {LEGAL_EMAIL}
            </a>
            . Account and data requests:{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary underline">
              {SUPPORT_EMAIL}
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
            . We will respond within a reasonable time.
          </p>
        </Section>

      </div>
    </LegalPage>
  );
}
