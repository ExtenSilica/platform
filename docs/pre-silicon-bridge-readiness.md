# Pre-silicon bridge — Readiness Levels & Capabilities (Reference)

**Status:** Draft (reference / TODO driver)  
**Audience:** ExtenSilica platform (registry + webapp) and `xsil` CLI maintainers  
**Purpose:** Single source of truth for the **“pre-silicon bridge”** product claim and the **one** readiness scale shown in UI/CLI.

---

## Positioning (must be explicit in UI)

ExtenSilica is the **pre-silicon bridge** for RISC‑V extensions:

- We do **not** make an extension “silicon-ready”.
- We make it **evaluable**: runnable, testable, reproducible, and traceable—so teams can decide whether to invest in RTL/FPGA/ASIC work.

Suggested public line (safe / credible):

> **ExtenSilica is the pre-silicon bridge: runnable, testable, reproducible RISC‑V extension packages that teams can evaluate on the path to RTL, FPGA, and ASIC decisions.**

Non-goals wording (never promise):

- “ASIC-ready”, “sign-off”, “tape-out guaranteed”, “silicon in one click”.

---

## Execution plan (do in order)

This section is the “one-by-one” checklist. Each item is meant to become an issue/PR scope.

### ~~Step 1 — Make “pre-silicon bridge” explicit in the UI (A1)~~ ✅ DONE

**Goal:** A user should see “pre-silicon bridge” as a first-class concept on the primary discovery and evaluation surfaces.

**Change scope (webapp):**
- **Homepage (`/`)**: add a short tagline under the main headline: **“Pre-silicon bridge for RISC‑V extensions.”**
- **Registry / search (`/search`)**: show a small header blurb near the results title: **“Pre-silicon bridge: evaluate extensions before RTL/FPGA/ASIC decisions.”**
- **Package page (`/package/<slug>`)**: show the same concept near the package name (subtitle or small badge): **“Pre-silicon bridge artifact.”**

**Copy constraints:**
- Must include the literal phrase **“pre-silicon bridge”**.
- Must avoid “ASIC-ready”, “tape-out”, “sign-off”, “guarantee”.
- Prefer “evaluate/evaluable”.

**Done when:**
- All three surfaces above display the phrase **“pre-silicon bridge”** (visible without scrolling, on desktop).
- Copy is consistent (same meaning, no contradictory claims).

---

### ~~Step 2 — Rename “Maturity/Level” → Readiness (RL) across the UI (A2)~~ ✅ DONE

**Goal:** The product exposes a single, consistent readiness scale in UI copy: **Readiness** with **RLx**.

**Done when:**
- Search filters and summaries say **Readiness** and **RLx** (not “maturity/level”).
- Package detail uses **Readiness** (not “maturity”).
- Listing chips show **RLx** as the primary level label.

---

## Core UX rule

Every surface that lists or displays a package must show:

1) **Pre-silicon bridge** (explicit label/tagline in the UI)  
2) **One readiness level** (single number + name)  
3) **Capabilities** (facts / checkboxes) as secondary detail  

Avoid parallel scales (no SRL vs maturity vs registry level vs silicon level).

---

## Readiness Levels (single scale)

This is the **only** level number shown in product UI/CLI today.

> **Readiness Level (RL):** **RL1–RL5** are computed and stored for the semver-latest non-yanked version. **RL6–RL7** are **reserved** for future, evidence-backed stages—do **not** infer them from `targets` alone or show them in UI until an explicit schema exists.

### RL1–RL5 (shipped) — names and ladder

UI/CLI labels match `readinessName()` / `xsil info` (conservative wording):

| RL | Name | What moves the number (summary) |
|----|------|----------------------------------|
| **1** | Packaged | Baseline when no stronger step below applies (often ISA-only / no sim target declared). |
| **2** | Runnable | `targets` JSON includes **`spike`** or **`qemu`** (simulation/emulation declared). |
| **3** | Reproducible | Already ≥RL2 **and** toolchain JSON has **`external: false`** (bundled-toolchain path). |
| **4** | Testable | Already ≥RL2 **and** execution indicates tests (`testEntry` or legacy `tests` string). |
| **5** | HW-evaluable | Already ≥RL2 **and** `targets` includes **`rtl`** and/or **`fpga`**. |

**Normative implementation:** `store-frontend/lib/xsil-parser.ts` → `computeCapabilityBadges` (derives `level` + badge set). The registry mirrors the same level at publish in `store-backend/src/lib/readiness.ts` (`Version.readinessLevel`, `Extension.latestReadinessLevel`).

**Checklist vs level:** the package **capabilities checklist** still surfaces **`entry`** / **`testEntry`** / repro modes as **facts**; they are not a second “level” scale. RL is **one** number from the ladder above.

### RL6–RL7 (reserved)

Future: stronger FPGA/ASIC claims should require **evidence beyond v0** (see **Evidence (v0)** below). RL6+ must not be inferred from `targets` alone.

---

## Decisions (product)

- **RL0 vs RL1:** **RL1 is the minimum** level used for XSIL packages in the catalog today. **RL0 (“indexed only”) is not used**; anything published as a `.xsil` version is at least a packaged artifact (RL1 floor in the shipped ladder).

---

## Evidence (v0) — optional `manifest.evidence`

**Goal:** Let authors attach **checkable pointers** (HTTPS links, optional content hashes) without implying silicon sign-off. This is the **minimal** schema to start; RL6/RL7 may extend it later.

### Where it lives

- **Manifest (author):** optional top-level key **`evidence`** — a JSON **array** (max **24** items). Omitted or `[]` means “no evidence block”.
- **Registry:** echoed on publish as **`Version.evidence`** (TEXT, canonical JSON). The webapp package page shows an **Evidence** section when this array is non-empty.

### Item shape (each array element)

| Field | Required | Constraints |
|-------|-----------|---------------|
| `kind` | yes | One of: `documentation`, `ci`, `artifact`, `other` |
| `url` | yes | **HTTPS** only; must parse as a URL; length ≤ 2048 |
| `label` | no | Short human title; ≤ 200 characters |
| `sha256` | no | Exactly **64** lowercase **hex** characters (content digest the URL or artifact is expected to match) |

Unknown keys on items are **dropped** at publish; only the four fields above are stored.

### Validation (registry)

Implemented in `store-backend/src/lib/xsilPublishValidate.ts` → `validateAndStringifyManifestEvidence` (called during `.xsil` publish validation). Invalid `evidence` → **400** with a clear error.

### UI / copy rules

- Treat entries as **pointers and optional digests**, not proof of tape-out.
- Prefer labels like “CI run”, “Documentation”, “Bitstream build log”, not “ASIC-ready”.

---

## Capabilities (facts, not marketing)

Capabilities are displayed as chips/checklist and must be derived from **verifiable metadata** already stored in the registry (primarily from manifest echo fields).

### Execution & reproducibility
- **Capability:** `entry` — present when `execution.entry` exists
- **Capability:** `testEntry` — present when `execution.testEntry` exists
- **Capability:** `Resolution: bundled | resolved | host-dependent` — from `resolutionMode`
- **Capability:** `Dependencies: tools` — present when `dependencies.tools` is a non-empty array

### Targets (evaluation surfaces)
Derived from `targets` JSON keys (or equivalent canonical representation):
- **Capability:** `Sim: Spike`
- **Capability:** `Emu: QEMU`
- **Capability:** `RTL`
- **Capability:** `FPGA`

### Toolchain (strategy)
Derived from `toolchain` metadata:
- **Capability:** `Toolchain: bundled` (toolchain external=false)
- **Capability:** `Toolchain: external` (toolchain external=true)

### Evaluation evidence (optional, separate from RL)
- **Echo:** optional **`manifest.evidence`** → stored as **`Version.evidence`** (see **Evidence (v0)**). Shown on the package page when present. **Does not** change RL1–RL5 by itself.

---

## How readiness is computed (implemented)

1. **Version:** pick the **semver-latest non-yanked** row (fallback to semver-latest among yanked if all yanked)—same rule as `Extension.latestVersion` and `packageReadinessSummary` / list trimming.
2. **Level:** run the **RL1–RL5 ladder** in the table above (identical logic to `computeCapabilityBadges` in `xsil-parser.ts` / `maturity.ts` on the backend).
3. **Persist:** store `readinessLevel` + `capabilities[]` on `Version` at publish; maintain **`Extension.latestReadinessLevel`** for indexed `GET /packages?level=` filters; profile/admin/org APIs prefer stored values with maturity recompute as fallback.

This ladder is intentionally conservative: it rewards **declared evaluation surfaces** (sim, bundled toolchain, tests, RTL/FPGA targets), not marketing claims.

---

## TODO List (implementation reference)

### ~~A) Webapp UX (explicit “pre-silicon bridge”)~~ ✅ DONE
- ~~**A1** Add an explicit UI element that says **“Pre-silicon bridge”**:~~
  - ~~Homepage hero/subtitle~~
  - ~~Registry/search header area~~
  - ~~Package page header area~~
- ~~**A2** Replace any “Maturity” labeling with **Readiness** (RL + name).~~
- ~~**A3** Package cards and listing rows~~ ✅ DONE:
  - ~~Show `Readiness: RLx — <name>` compactly~~
  - ~~Capabilities appear as secondary chips (limited + “+N”)~~
- ~~**A4** Package detail page~~ ✅ DONE:
  - ~~Readiness shown prominently~~
  - ~~Capabilities checklist (✓/✗)~~
  - ~~**Evidence** section when `manifest.evidence` is present (v0 schema)~~

**Done when:** every listing + package detail makes “pre-silicon bridge” explicit and uses the single readiness scale.

### B) Registry backend (make readiness first-class)
- ~~**B1** Add canonical computation utility~~ ✅ DONE:
  - ~~Compute `readinessLevel` and `capabilities[]` from a version’s stored metadata (`execution`, `toolchain`, `targets`, `dependencies`, `resolutionMode`).~~
- ~~**B2** Persist readiness for each version at publish time~~ ✅ DONE:
  - ~~New fields on `Version`: `readinessLevel`, `capabilities` (JSON), optional `evidence` (manifest echo)~~
- ~~**B3** Ensure list endpoints return readiness without expensive recompute~~ ✅ DONE:
  - ~~`GET /packages` includes readiness + capabilities for the latest semver version~~
  - ~~Filtering by readiness: `GET /packages?level=` uses denormalized `Extension.latestReadinessLevel` (SQL + index), synced on publish/yank; version rows still carry `readinessLevel` / `capabilities`.~~
- ~~**B4** Backfill~~ ✅ DONE:
  - ~~For existing versions, compute and store readiness/capabilities~~
  - **Run:** `cd store-backend && npx prisma migrate deploy && npm run backfill:readiness` (uses `DATABASE_URL`)

**Done when:** readiness/capabilities are stored per version and returned consistently; filters/sort can rely on DB fields.

### ~~C) `xsil` CLI (`xsil info`)~~ ✅ DONE
- ~~**C1** `xsil info <slug>` prints:~~
  - ~~Readiness level + name~~
  - ~~Capabilities summary (same vocabulary as webapp)~~
  - ~~Repro fields (resolution/targets/toolchain/deps/entry/testEntry) remain visible~~
- ~~**C2** `xsil info <slug@ver>` prints the same for the pinned version.~~

**Done when:** `xsil info` output matches the webapp’s readiness/capabilities meaning and wording.

### ~~D) Docs~~ ✅ DONE
- ~~**D1** Update CLI docs to reflect the new `xsil info` output and readiness semantics.~~ (`ExtenSilica-xsil/docs/cli-v3.md`)
- ~~**D2** Add a short platform doc page referencing “pre-silicon bridge” and the readiness scale (this document is the reference; link it from `docs/README.md`).~~ (`docs/pre-silicon-bridge.md` + `docs/README.md`)

**Done when:** docs reflect the single readiness scale and the explicit “pre-silicon bridge” claim.

### ~~E) List filter: denormalized latest readiness~~ ✅ DONE

- ~~**E1** `Extension.latestReadinessLevel` + index; `syncExtensionLatestReadiness` after publish and yank; `GET /packages?level=` filters in the DB; `backfill:readiness` syncs all packages after version rows are updated.~~

### ~~F) Evidence v0 (manifest + registry + package UI)~~ ✅ DONE

- ~~**F1** Optional `manifest.evidence` validated at publish; stored as `Version.evidence`; package page **Evidence** section + in-page nav when non-empty (see **Evidence (v0)**).~~

---

## Open questions (remaining)

- **RL6+ / “ASIC-evaluable”:** what additional **required** fields (beyond Evidence v0) should gate RL6–RL7 so claims stay factual (e.g. provenance chain, SBOM linkage, signer identity)?
- **Non-XSIL indexes:** if the product ever lists non-`.xsil` repos, do we introduce a separate **catalog** notion (still not RL0), or keep XSIL-only?
