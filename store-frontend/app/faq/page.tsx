import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";

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
            you can search for packages, install them with one command, publish your own
            work, and view download statistics and reviews.
          </>
        ),
      },
      {
        q: "Is ExtenSilica free to use?",
        a: (
          <>
            Yes — completely free. There are no paid tiers, publishing fees, download
            quotas, or rate limits for ordinary use. The registry is operated as an
            open infrastructure project for the RISC-V community.
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
            <C>manifest.json</C> at its root that declares:
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <C>name</C>, <C>version</C>, <C>description</C>, <C>author</C>
              </li>
              <li>
                <C>isa</C> — RISC-V ISA string (e.g. <C>rv64imac</C>)
              </li>
              <li>
                <C>targets</C> — supported execution platforms
              </li>
              <li>
                <C>entry</C> — primary execution entry point
              </li>
              <li>
                <C>checksums</C> — SHA-256 of the payload for integrity verification
              </li>
            </ul>
            <p className="mt-3">
              Optional directories include <C>sim/</C>, <C>toolchain/</C>,{" "}
              <C>tests/</C>, <C>docs/</C>, and <C>bitstream/</C> (FPGA).
            </p>
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
                Publish when ready:
                <pre className="mt-2 rounded-md border bg-muted/50 px-3 py-2 font-mono text-sm">
                  xsil publish ./my-package/
                </pre>
              </li>
            </ol>
            <p className="mt-3">
              The CLI validates your manifest, computes SHA-256 checksums, packs the
              directory into a <C>.xsil</C> archive, and uploads it to the registry.
              Your package is indexed immediately.
            </p>
          </>
        ),
      },
      {
        q: "What are the package naming rules?",
        a: (
          <>
            Package names must:
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Start with a lowercase letter (<C>a–z</C>)</li>
              <li>
                Contain only lowercase letters, digits, hyphens (<C>-</C>), and
                underscores (<C>_</C>)
              </li>
              <li>Be between 2 and 64 characters</li>
              <li>Be unique across the entire registry</li>
            </ul>
            <p className="mt-3">
              Pattern:{" "}
              <C>{"^[a-z][a-z0-9_-]{1,63}$"}</C>
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
            Organization accounts and scoped package names (e.g.,{" "}
            <C>@myorg/package</C>) are planned for a future release. Today, all
            packages live in a single global namespace.
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
                href="mailto:legal@extensilica.com"
                className="text-primary underline"
              >
                legal@extensilica.com
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
                href="mailto:legal@extensilica.com"
                className="text-primary underline"
              >
                legal@extensilica.com
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
];

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function FaqPage() {
  return (
    <LegalPage
      title="Frequently Asked Questions"
      subtitle="Everything you need to know about ExtenSilica, .xsil packages, publishing, versioning, security, and your account."
      updated="March 2026"
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
          Email us at{" "}
          <a
            href="mailto:legal@extensilica.com"
            className="text-primary underline"
          >
            legal@extensilica.com
          </a>
          , open an issue on{" "}
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
