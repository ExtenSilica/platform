import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";
import { CONTACT_EMAIL, LEGAL_EMAIL, SUPPORT_EMAIL } from "@/lib/site-contact";

export const metadata: Metadata = {
  title: "FAQ — ExtenSilica",
  description:
    "Frequently asked questions about ExtenSilica, .xsil packages, publishing, versioning, security, and your account.",
};

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface FaqItem {
  q: string;
  a: React.ReactNode;
}

interface FaqGroup {
  title: string;
  id: string;
  items: FaqItem[];
}

/* ─── Content ────────────────────────────────────────────────────────────── */

function C({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
      {children}
    </code>
  );
}

const GROUPS: FaqGroup[] = [
  {
    title: "Getting Started",
    id: "getting-started",
    items: [
      {
        q: "What is ExtenSilica?",
        a: (
          <>
            ExtenSilica is a free, public registry for <C>.xsil</C> packages —
            versioned, self-describing archives that bundle RISC-V simulation assets,
            toolchains, test suites, documentation, and optional FPGA artifacts.
            Think of it as <strong>npmjs.com for reproducible RISC-V extensions</strong>:
            you can search for packages, install them with <C>xsil install</C>, publish your own
            work, and view download statistics and reviews.
          </>
        ),
      },
      {
        q: "Is ExtenSilica free to use?",
        a: (
          <>
            Yes — free to use. There are no paid tiers, publishing fees, or download
            quotas. To protect the service from abuse, we may apply reasonable
            rate-limiting or temporary restrictions during unusual traffic or
            incident response.
          </>
        ),
      },
      {
        q: "How do I install the xsil CLI?",
        a: (
          <>
            <p className="mb-3">
              The CLI is written in Rust. Build from source using Cargo:
            </p>
            <pre className="overflow-x-auto rounded-md border bg-muted/50 p-4 font-mono text-sm">
              cargo install xsil
            </pre>
            <p className="mt-3">
              Pre-built binaries for Linux and macOS are available on the{" "}
              <a
                href="https://github.com/ExtenSilica/xsil/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                GitHub releases page
              </a>
              .
            </p>
          </>
        ),
      },
      {
        q: "What RISC-V targets are supported?",
        a: (
          <>
            Targets are declared per-package inside the manifest. The registry does
            not maintain a global platform catalog. Commonly declared target
            identifiers include <C>spike</C>, <C>qemu</C>, and <C>fpga</C>. FPGA
            support is entirely optional; board-specific BSPs are bundled inside the
            package itself, not provided by the platform. Any target string may be
            declared — the registry treats it as opaque metadata.
          </>
        ),
      },
      {
        q: "Do I need an account to browse or install packages?",
        a: (
          <>
            No. Browsing the registry, searching packages, viewing package pages, and
            installing packages with <C>xsil install</C> are all available without an
            account. An account is required only to publish packages or leave reviews.
          </>
        ),
      },
      {
        q: "What is the fastest way to scaffold a new package?",
        a: (
          <>
            <p>
              Use the Extension Wizard. Either fill the web form at{" "}
              <Link href="/wizard" className="text-primary underline">
                extensilica.com/wizard
              </Link>{" "}
              and download a ready-to-edit <C>.xsil</C>, or run the CLI:
            </p>
            <pre className="mt-2 overflow-x-auto rounded-md border bg-muted/50 p-3 font-mono text-sm">
              xsil new my-extension
            </pre>
            <p className="mt-3">
              Both paths produce the same skeleton: <C>manifest.json</C>,{" "}
              <C>opcodes.json</C>, an <C>opcodes.h</C> header with{" "}
              <C>__asm__ .insn</C> macros for each declared instruction, a Spike{" "}
              <C>extension_t</C> stub under <C>sim/spike-extension/</C> with
              <C>Makefile</C>, runnable per-instruction examples in{" "}
              <C>examples/</C>, an SPDX <C>LICENSE</C>, a Keep-a-Changelog{" "}
              <C>CHANGELOG.md</C>, and standard <C>tests/</C>, <C>docs/</C>, and{" "}
              <C>toolchain/</C> placeholders. The wizard requires a repository URL
              (use the future GitHub URL if the repo does not exist yet).
            </p>
            <p className="mt-3">
              The wizard never publishes for you — the output is a local archive you
              can edit, version, and ship with <C>xsil publish</C> when ready.
            </p>
          </>
        ),
      },
      {
        q: "What does \"standard status\" mean on a package?",
        a: (
          <>
            <p>
              Every package on ExtenSilica must declare its honest relationship
              to the RISC-V standard. The label appears as a badge on the
              package page and powers the homepage counts. Five values are
              allowed:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <C>ratified</C> — frozen specification approved by RISC-V
                International. The encoding is locked.
              </li>
              <li>
                <C>draft</C> — working draft from RISC-V International or
                another standards body. Not ratified yet — the encoding may
                still change.
              </li>
              <li>
                <C>vendor</C> — custom extension defined and shipped by a
                commercial vendor (T-Head, SiFive, Qualcomm, Andes, Ventana,
                …).
              </li>
              <li>
                <C>research</C> — academic / experimental extension, often used
                in research papers or pre-production prototypes.
              </li>
              <li>
                <C>custom</C> — bespoke or one-off extension that does not fit
                the categories above.
              </li>
            </ul>
            <p className="mt-3">
              The accompanying <C>authority</C> field is free text (2–200
              characters) identifying who defines the spec — for example{" "}
              <C>RISC-V International</C>, <C>T-Head / XuanTie</C>, or{" "}
              <C>University of Michigan</C>. Both fields are stored at the top
              of <C>manifest.json</C>, validated by the registry, and required
              by both the web wizard and <C>xsil new</C>. Do not label a
              package <C>ratified</C> unless RISC-V International has actually
              frozen the spec — the registry checks this and we audit the
              catalog regularly.
            </p>
          </>
        ),
      },
      {
        q: "What does provenance mean on a package?",
        a: (
          <>
            <p>
              Provenance is orthogonal to <C>standardStatus</C>:
              the latter describes the specification, while provenance describes who put the
              package on ExtenSilica and whether the upstream maintainer has
              blessed it. It is <strong>always server-set</strong> — we never
              read it from the uploaded manifest, so publishers cannot lie
              about being the official maintainer. Five values exist:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <C>seeded</C> — auto-published by the ExtenSilica catalog-seed
                agent from public sources. The upstream maintainer has not
                (yet) claimed authorship.
              </li>
              <li>
                <C>community_port</C> — a legacy database value for a package
                contributed by a non-upstream community member. Useful, but not vetted as official.
              </li>
              <li>
                <C>claimed</C> — the current owner went through the{" "}
                <em>Request authorship</em> flow and was approved by a platform
                admin.
              </li>
              <li>
                <C>official</C> — a platform admin verified the publisher's
                identity / affiliation with the upstream project.
              </li>
              <li>
                <C>archived</C> — upstream is dead or the package has been
                intentionally frozen. Still installable; no further updates
                expected.
              </li>
            </ul>
            <p className="mt-3">
              Packages published directly by a user are unmarked
              (&quot;self-published&quot;) until either an ownership claim or
              an admin verification flips them. Approving an ownership request
              on a <C>seeded</C> or <C>community_port</C> package automatically
              promotes it to <C>claimed</C>.
            </p>
          </>
        ),
      },
    ],
  },

  {
    title: "Packages and Publishing",
    id: "publishing",
    items: [
      {
        q: "What is a .xsil package?",
        a: (
          <>
            A <C>.xsil</C> file is a gzip-compressed tar archive. It must contain a{" "}
            <C>manifest.json</C> at its root that declares at minimum:
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <C>name</C>, <C>version</C>, <C>description</C>, <C>author</C>,{" "}
                <C>license</C>
              </li>
              <li>
                <C>isa</C> — required base ISA metadata when known (e.g. <C>rv64gc</C>,{" "}
                <C>rv64imafc</C>)
              </li>
              <li>
                <C>repository</C> — http(s) URL to the source (required for
                wizard-generated packages)
              </li>
            </ul>
            <p className="mt-3">
              Common companion files (all optional but produced by{" "}
              <C>xsil new</C> and the web wizard):
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <C>opcodes.json</C> — schema-versioned descriptor of custom
                instructions (mnemonic, format, opcode, funct3/funct7, operands,
                summary)
              </li>
              <li>
                <C>opcodes.h</C> — C header with <C>__asm__</C> macros that emit
                the custom instructions via GAS <C>.insn</C>, no toolchain patch
                required
              </li>
              <li>
                <C>examples/</C> and <C>docs/</C> — encoding examples and prose documentation
              </li>
              <li>
                <C>README.md</C>, <C>CHANGELOG.md</C>, <C>LICENSE</C>,{" "}
                <C>.xsilignore</C> — standard surface metadata
              </li>
              <li>
                <C>targets</C>, <C>toolchain</C>, <C>entry</C>, <C>testEntry</C>, tests,
                RTL, and bitstreams — optional metadata and artifacts when they actually exist
              </li>
            </ul>
          </>
        ),
      },
      {
        q: "How do I publish a package?",
        a: (
          <>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                Create a free account at{" "}
                <Link href="/register" className="text-primary underline">
                  extensilica.com/register
                </Link>
                .
              </li>
              <li>
                Authenticate the CLI:
                <pre className="mt-2 rounded-md border bg-muted/50 px-3 py-2 font-mono text-sm">
                  xsil login
                </pre>
              </li>
              <li>
                Create your package directory with a valid <C>manifest.json</C>. Run
                a dry-run to validate it:
                <pre className="mt-2 rounded-md border bg-muted/50 px-3 py-2 font-mono text-sm">
                  xsil publish ./my-package/ --dry-run
                </pre>
              </li>
              <li>
                Set <C>resolution.mode</C> to <C>bundled</C>, <C>resolved</C>, or{" "}
                <C>host-dependent</C> per your reproducibility story. If you use{" "}
                <C>resolved</C> with <C>dependencies.tools</C>, you can upload matching
                binaries to ExtenSilica artifacts so installs resolve with auth; it is
                optional for other modes.
              </li>
              <li>
                Publish when ready:
                <pre className="mt-2 rounded-md border bg-muted/50 px-3 py-2 font-mono text-sm">
                  xsil publish ./my-package/
                </pre>
              </li>
            </ol>
            <p className="mt-3">
              The CLI validates your manifest, computes SHA-256 checksums, packs the
              directory into a <C>.xsil</C> archive, and uploads it to the registry.
              The backend stores your declared <C>resolution.mode</C> and dependencies;
              strict artifact linkage is applied only when every declared resolved tool
              matches a registered ExtenSilica artifact.
            </p>
          </>
        ),
      },
      {
        q: "Can I publish host-dependent or bundled packages to the marketplace?",
        a: (
          <>
            Yes. <C>bundled</C>, <C>resolved</C>, and <C>host-dependent</C> manifests
            can be published. When you use <C>resolved</C> with{" "}
            <C>dependencies.tools</C> pointing at ExtenSilica artifact URLs, the
            registry can record artifact linkage for installs; otherwise the manifest
            JSON alone is kept and users follow your docs for host prerequisites.
          </>
        ),
      },
      {
        q: "What are the package naming rules?",
        a: (
          <>
            Package names must:
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Contain only lowercase letters (<C>a–z</C>), digits (<C>0–9</C>),
                and hyphens (<C>-</C>) — <strong>no underscores</strong>
              </li>
              <li>
                Start and end with a letter or digit (no leading or trailing
                hyphen)
              </li>
              <li>Be between 2 and 64 characters</li>
              <li>Be unique across the entire registry</li>
              <li>
                Not match a reserved name (e.g. <C>extensilica</C>, <C>admin</C>,{" "}
                <C>api</C>, <C>system</C>) — the full list is enforced server-side
              </li>
            </ul>
            <p className="mt-3">
              Pattern:{" "}
              <C>{"^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$|^[a-z0-9]{1,2}$"}</C>
            </p>
            <p className="mt-3">
              Organizations and scoped slugs use the form{" "}
              <C>@&lt;org&gt;/&lt;package&gt;</C>; both segments follow the same
              rules above.
            </p>
            <p className="mt-3">
              Names that impersonate popular projects, contain offensive language, or
              are reserved for abuse purposes may be removed.
            </p>
          </>
        ),
      },
      {
        q: "Can I update or delete a published package?",
        a: (
          <>
            <p>
              You <strong>cannot overwrite or delete a published version</strong>.
              Version immutability is a core design principle: once{" "}
              <C>rvx-demo@1.2.0</C> is published, its bytes are permanent. This
              ensures reproducible builds for anyone who depends on that version.
            </p>
            <p className="mt-3">
              What you <em>can</em> do:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>Publish a new version</strong> — use semantic versioning to
                supersede the old one.
              </li>
              <li>
                <strong>Yank a version</strong> — mark it as unsafe. Yanked versions
                are excluded from normal installs but remain in the registry for
                auditability.
              </li>
              <li>
                <strong>Deprecate a package</strong> — mark the entire package as
                deprecated (e.g., if it has been renamed). A deprecation notice is
                shown on the package page.
              </li>
              <li>
                <strong>Edit metadata</strong> — description, keywords, links, and
                README can be updated at any time via the dashboard or{" "}
                <C>xsil publish</C>. Version artifacts are immutable; metadata is not.
              </li>
            </ul>
          </>
        ),
      },
      {
        q: "What happens after I publish — is there a review process?",
        a: (
          <>
            <p>
              There is no manual review gate. Packages are indexed and publicly
              visible immediately upon successful upload. We perform integrity
              verification (checksum validation) at upload time but do not perform
              automated behavioral analysis of package contents.
            </p>
            <p className="mt-3">
              Authors are solely responsible for the content of their packages. See
              the{" "}
              <Link href="/legal/terms" className="text-primary underline">
                Terms of Service
              </Link>{" "}
              for the full acceptable-use policy.
            </p>
          </>
        ),
      },
      {
        q: "Does ExtenSilica support organizations or scoped packages?",
        a: (
          <>
            Yes. ExtenSilica supports organizations and scoped package slugs (e.g.,{" "}
            <C>@myorg/package</C>).
            <p className="mt-3">
              Organization profiles live under <C>/orgs/&lt;slug&gt;</C>. Package
              pages and CLI commands accept scoped slugs wherever a package name is
              accepted.
            </p>
          </>
        ),
      },
    ],
  },

  {
    title: "Versioning",
    id: "versioning",
    items: [
      {
        q: "What versioning scheme is required?",
        a: (
          <>
            All package versions must follow{" "}
            <a
              href="https://semver.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Semantic Versioning 2.0.0
            </a>{" "}
            (semver). Examples of valid versions: <C>1.0.0</C>, <C>2.3.1</C>,{" "}
            <C>0.1.0-alpha</C>, <C>1.0.0-rc.1+build.42</C>. Non-semver strings are
            rejected at publish time.
          </>
        ),
      },
      {
        q: "How does 'latest' work?",
        a: (
          <>
            <p>
              The <C>latest</C> tag always points to the semver-greatest non-yanked
              version of a package. It is recomputed automatically after every
              publish. This means publishing a backport patch (e.g., <C>1.0.1</C>{" "}
              after <C>1.1.0</C> is already live) does not move the <C>latest</C> tag.
            </p>
            <p className="mt-3">
              You can explicitly target <C>latest</C> in the CLI:
            </p>
            <pre className="mt-2 rounded-md border bg-muted/50 px-3 py-2 font-mono text-sm">
              xsil install rvx-demo@latest{"\n"}
              xsil info    rvx-demo@latest
            </pre>
          </>
        ),
      },
      {
        q: "How do I install a specific version?",
        a: (
          <>
            <p>
              Use the <C>@version</C> suffix with any <C>xsil</C> command that
              accepts a package name:
            </p>
            <pre className="mt-2 overflow-x-auto rounded-md border bg-muted/50 px-3 py-2 font-mono text-sm">
              xsil install rvx-demo@1.2.0{"\n"}
              xsil run     rvx-demo@1.1.0{"\n"}
              xsil info    rvx-demo@1.0.0-rc.1
            </pre>
            <p className="mt-3">
              The version history table on every package page shows per-version install
              commands that you can copy with one click.
            </p>
          </>
        ),
      },
      {
        q: "What does 'yanking' a version mean?",
        a: (
          <>
            <p>
              Yanking marks a version as unsafe without deleting it. Yanked versions:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Are excluded from normal resolution (<C>latest</C>, bare installs).</li>
              <li>
                Appear in the version history with a <strong>yanked</strong> badge.
              </li>
              <li>
                Can only be installed explicitly with{" "}
                <C>xsil install pkg@version --override-security</C>.
              </li>
              <li>
                Are not deleted — the artifact remains accessible for auditing and for
                systems that were already pinned to that version.
              </li>
            </ul>
          </>
        ),
      },
    ],
  },

  {
    title: "Security and Trust",
    id: "security",
    items: [
      {
        q: "What does 'reproducible' mean?",
        a: (
          <>
            <p>
              Every <C>.xsil</C> package records a SHA-256 checksum of all
              non-manifest files at publish time. The <C>xsil</C> CLI recomputes this
              checksum on every install and before every <C>run</C> or <C>test</C>. If
              the bytes do not match — the file was tampered with, corrupted in
              transit, or silently replaced — the CLI refuses to execute it and prints
              an error.
            </p>
            <p className="mt-3">
              This gives you a strong integrity check: what runs matches the
              author-published payload checksum, regardless of how the file was
              served.
            </p>
          </>
        ),
      },
      {
        q: "Is it safe to run packages from unknown authors?",
        a: (
          <>
            <p>
              <strong>Exercise caution.</strong> <C>.xsil</C> packages may contain
              executable scripts and binaries. The registry verifies archive integrity
              (checksums match what the author published) but does not perform
              behavioral analysis.
            </p>
            <p className="mt-3">Before running a package from an unknown author:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Review the package description, README, and repository link.</li>
              <li>
                Inspect the entry point and any scripts listed in the manifest.
              </li>
              <li>
                Check download counts and reviews — popular, well-reviewed packages
                from active authors are lower risk.
              </li>
              <li>Consider running inside a sandbox or container.</li>
            </ul>
          </>
        ),
      },
      {
        q: "How do I report a malicious or abusive package?",
        a: (
          <>
            <p>
              For <strong>IP / copyright infringement</strong>, use the formal{" "}
              <Link href="/legal/dmca" className="text-primary underline">
                DMCA / Takedown Request
              </Link>
              {" "}page.
            </p>
            <p className="mt-3">
              For <strong>malware, abuse, or policy violations</strong>, email{" "}
              <a
                href={`mailto:${LEGAL_EMAIL}`}
                className="text-primary underline"
              >
                {LEGAL_EMAIL}
              </a>
              {" "}or open an issue on the project&rsquo;s{" "}
              <a
                href="https://github.com/ExtenSilica/xsil"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                GitHub repository
              </a>
              {" "}with the package name, version(s), and a description of the concern.
              We treat security and abuse reports as high priority and will investigate
              promptly. Confirmed malicious packages will be yanked and the publishing
              account suspended.
            </p>
          </>
        ),
      },
      {
        q: "How are checksums computed and verified?",
        a: (
          <>
            <p>
              At publish time the CLI computes two SHA-256 digests:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>Payload checksum</strong> — SHA-256 over all non-manifest
                files (sorted by path), stored in <C>manifest.json</C>.
              </li>
              <li>
                <strong>Archive checksum</strong> — SHA-256 of the full{" "}
                <C>.xsil</C> archive byte stream, verified by the server on upload
                and stored in the registry database.
              </li>
            </ul>
            <p className="mt-3">
              At install time the CLI re-downloads the archive, recomputes the archive
              checksum, and recomputes the payload checksum from the extracted files.
              Any mismatch causes an immediate abort.
            </p>
            <p className="mt-3">
              For <C>resolved</C> mode with <C>dependencies.tools</C>, the CLI may
              download each declared tool archive, verify SHA-256, and cache it before
              execution. <C>bundled</C> and <C>host-dependent</C> flows skip those downloads.
            </p>
          </>
        ),
      },
      {
        q: "What is the CLI authentication model?",
        a: (
          <>
            <p>
              Running <C>xsil login</C> prompts for your email and password. On
              success the registry returns a random opaque <strong>API token</strong>.
              The CLI stores this token in <C>~/.extensilica/config.json</C>. All
              subsequent authenticated requests (publish, etc.) send the token as a{" "}
              <C>Bearer</C> header.
            </p>
            <p className="mt-3">
              The token is not a session cookie and is not stored in the browser.
              Running <C>xsil logout</C> invalidates the token on the server and
              removes it from the config file.
            </p>
            <p className="mt-3">
              Keep your config file and token private. Do not commit it to version
              control.
            </p>
          </>
        ),
      },
    ],
  },

  {
    title: "Account and Data",
    id: "account",
    items: [
      {
        q: "What personal data does ExtenSilica store?",
        a: (
          <>
            We store your username, email address (hashed password, never plaintext),
            and optional bio/avatar. Download events are recorded as aggregate
            daily counts with no user identity attached. Full details are in the{" "}
            <Link href="/legal/privacy" className="text-primary underline">
              Privacy Policy
            </Link>
            .
          </>
        ),
      },
      {
        q: "Can I delete my account?",
        a: (
          <>
            <p>
              Yes. Email{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-primary underline"
              >
                {SUPPORT_EMAIL}
              </a>
              {" "}or open an issue on{" "}
              <a
                href="https://github.com/ExtenSilica/xsil"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                GitHub
              </a>{" "}
              to request account deletion. We will remove your email, password hash,
              and API token.
            </p>
            <p className="mt-3">
              Your published packages will remain in the registry — they are attributed
              to your username but no longer linked to active account credentials.
              Other users&rsquo; builds may depend on your packages, so we do not
              delete artifacts on account closure.
            </p>
          </>
        ),
      },
      {
        q: "How do I transfer ownership of a package to another user?",
        a: (
          <>
            Package ownership transfer is available through the maintainers
            dashboard. Add the new owner as a maintainer, then contact us to update
            the owner record. Full self-service ownership transfer is planned for a
            future release.
          </>
        ),
      },
      {
        q: "Can I add other people as maintainers of my package?",
        a: (
          <>
            Yes. Go to the <strong>Maintainers</strong> tab in your package dashboard
            (or navigate to <C>/publish/[slug]/maintainers</C>) and enter the
            username of the person you want to add. Maintainers can publish new
            versions and edit metadata, but cannot manage other maintainers or transfer
            ownership. Only the package owner can add or remove maintainers.
          </>
        ),
      },
      {
        q: "Where are .xsil archive files stored?",
        a: (
          <>
            Archive files are stored in an S3-compatible object store separate from
            the registry database. The registry holds only metadata and a URL pointing
            to the blob. Download links served to the CLI point directly to the
            storage URL. No personal data is transmitted to the storage provider.
          </>
        ),
      },
    ],
  },
  {
    title: "Governance & stewardship",
    id: "governance",
    items: [
      {
        q: "Who operates ExtenSilica?",
        a: (
          <>
            ExtenSilica operates the public registry and <C>.xsil</C> packaging
            platform as an <strong>interim technical steward</strong>, with a stated goal
            of neutral long-term governance (including possible transfer to RISC-V
            International or an affiliated foundation). ExtenSilica is{" "}
            <strong>not affiliated with RISC-V International</strong>.
          </>
        ),
      },
      {
        q: "Does ExtenSilica process payments or hold funds?",
        a: (
          <>
            No. The registry is free to use and has no paid tiers, wallets, escrow, or
            payout flows in the platform schema. Implementation requests may list an
            optional off-platform funding contact; that is not an offer, contract, or
            payment rail operated by ExtenSilica.
          </>
        ),
      },
      {
        q: "Where can I see adoption metrics?",
        a: (
          <>
            Public page-view and download aggregates are on the{" "}
            <Link href="/adoption" className="text-primary underline">
              Adoption
            </Link>{" "}
            dashboard (<C>GET /stats/adoption</C>). They support transparency for
            stewards and contributors, not billing.
          </>
        ),
      },
    ],
  },
];

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function FaqPage() {
  return (
    <LegalPage
      title="Frequently Asked Questions"
      subtitle="Everything you need to know about ExtenSilica, .xsil packages, publishing, versioning, security, and your account."
      updated="May 2026"
      current="/faq"
    >
      {/* Group nav */}
      <div className="mb-10 flex flex-wrap gap-2">
        {GROUPS.map((g) => (
          <a
            key={g.id}
            href={`#${g.id}`}
            className="rounded-full border bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            {g.title}
          </a>
        ))}
      </div>

      <div className="space-y-14">
        {GROUPS.map((group) => (
          <div key={group.id} id={group.id} className="scroll-mt-24">
            <h2 className="mb-6 text-sm font-bold uppercase tracking-widest text-muted-foreground">
              {group.title}
            </h2>
            <div className="space-y-8">
              {group.items.map(({ q, a }) => (
                <div
                  key={q}
                  className="border-b pb-8 last:border-0 last:pb-0"
                >
                  <h3 className="mb-3 text-base font-semibold">{q}</h3>
                  <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                    {a}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer CTA */}
      <div className="mt-14 rounded-lg border bg-muted/20 p-6 text-center">
        <p className="font-semibold">Still have questions?</p>
        <p className="mt-2 text-sm text-muted-foreground">
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">
            {CONTACT_EMAIL}
          </a>
          {" "}(general),{" "}
          <a href={`mailto:${LEGAL_EMAIL}`} className="text-primary underline">
            {LEGAL_EMAIL}
          </a>
          {" "}(legal), or{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary underline">
            {SUPPORT_EMAIL}
          </a>
          {" "}(support). You can also open an issue on{" "}
          <a
            href="https://github.com/ExtenSilica/xsil"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            GitHub
          </a>
          , or review the{" "}
          <a
            href="https://github.com/ExtenSilica/xsil/blob/main/spec/xsil.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            .xsil specification
          </a>
          .
        </p>
      </div>
    </LegalPage>
  );
}
