# Zenodo DOI — manual workflow (PR-G6a)

ExtenSilica coordinates **open technical work** on the registry; it does **not** mint a DOI for every package automatically. This document describes when and how maintainers or stewards assign a **Zenodo DOI** manually for citable artifacts.

**Automation** (post-publish hooks, registry-triggered deposits) is explicitly **out of scope** until [zenodo-automation.md](./zenodo-automation.md) (PR-G6b). Do not promise per-package DOIs in UI or marketing until then.

---

## When a Zenodo DOI makes sense

| Artifact | Typical use |
|----------|-------------|
| A **released `.xsil` version** you want papers to cite | Software record linked to semver |
| A **registry snapshot** or steward report | Annual adoption / catalog export |
| **Platform code** (this repo or public `xsil`) | Archive tag aligned with `cli/v*` release |

Skip Zenodo for: draft uploads, yanked versions, or packages that fail `xsil test` / verification — fix readiness first.

---

## Prerequisites

1. **Stable identity** — package slug and version exist on the registry (`xsil publish` succeeded).
2. **License** — SPDX id in `manifest.json` matches what you upload (Apache-2.0, BSD-3-Clause, etc.).
3. **Citation metadata** — authors, title, version, repository URL. When [PR-G2b](./implementation-plan-rvi-2026.md) ships, prefer `GET /packages/:slug/citation` for CFF/BibTeX; until then, draft CFF by hand (see below).
4. **Zenodo account** — [https://zenodo.org](https://zenodo.org) (ORCID linked recommended).

---

## Manual deposit (recommended path)

### 1. Prepare the upload file

- **Software:** the published `.xsil` for that version, or a `.tar.gz` of the package root used to build it.
- Include `manifest.json` inside the archive or as a sidecar so reviewers see ISA, targets, and checksums.

Verify locally:

```bash
xsil info my-pkg@1.0.0
xsil test my-pkg@1.0.0
```

### 2. Create a new upload on Zenodo

1. Zenodo → **Upload** → **New upload**.
2. **Upload type:** Software (or Dataset if you are archiving a catalog export).
3. **Title:** `{package name} — version {semver}` (match registry slug/name).
4. **Authors:** upstream maintainers + port author if different; align with `manifest.author`.
5. **Description:** short technical summary; link to the registry package page.
6. **License:** same SPDX as the package.
7. **Version:** semver (e.g. `1.0.0`).
8. **Related identifiers:**
   - **URL** → registry package page (`https://extensilica.com/package/{slug}`).
   - **URL** → source repository from `manifest.repository` when public.

### 3. Minimal CFF (optional but useful)

Save as `CITATION.cff` next to the upload or in the repo tag:

```yaml
cff-version: 1.2.0
title: "my-extension"
version: "1.0.0"
authors:
  - family-names: Maintainer
    given-names: Pat
message: "Cite this software using the DOI below."
license: Apache-2.0
repository-code: "https://github.com/org/my-extension"
doi: 10.5281/zenodo.XXXXXXX
```

Replace `doi` after Zenodo publishes.

### 4. Publish and record the DOI

1. **Publish** the Zenodo record (mint DOI).
2. Store the DOI in your **paper / grant / README** — not in `manifest.json` (the `.xsil` format does not carry registry DOIs; see spec).
3. Optionally add an **external citation** on the registry when [PR-G2](./implementation-plan-rvi-2026.md) is live (`POST /admin/citations` with `kind: doi`).

---

## Steward checklist (ExtenSilica operators)

- [ ] Package is public and not yanked for that version.
- [ ] Verification or upstream sign-off documented if claiming “verified” work.
- [ ] Zenodo metadata does **not** imply ExtenSilica holds funds or brokered payment.
- [ ] DOI landing page license matches the `.xsil` license.
- [ ] Registry package page links to Zenodo (via G2 citation or README), not the reverse only.

---

## What we do not do (G6a)

- No automatic DOI on every `xsil publish`.
- No wallet, escrow, or payment fields tied to DOI minting.
- No “pay to get a DOI” product surface.

---

## See also

- [zenodo-automation.md](./zenodo-automation.md) — future automation (PR-G6b)
- [implementation-plan-rvi-2026.md](./implementation-plan-rvi-2026.md) — Phase G roadmap
- [REPOS_AND_PUBLIC_XSIL.md](./REPOS_AND_PUBLIC_XSIL.md) — where the CLI and spec live
