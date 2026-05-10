# Catalog seed agent — one row, one published `.xsil`

**Status:** Canonical playbook for the catalog seeding campaign (May 2026)
**Audience:** A single autonomous coding agent with shell, filesystem, and internet access.
**Goal:** Take **one** row from [`catalog.md`](./catalog.md), fetch the upstream source, extract whatever opcode/encoding metadata is available, build a valid `.xsil` package, and **publish** it to the production registry.

This is the lightweight cousin of [`docs/agent-publish-extension.md`](../agent-publish-extension.md). That document targets *reproducible RL ≥ 2* packages (a working simulator, runnable tests, pinned toolchains). This document targets **RL 1 — spec-derived scaffold**: opcodes extracted from upstream, examples and tests scaffolded, simulator handlers stubbed with `TODO`. It is honest, useful, fast, and runs 91 times in a row without requiring 91 working RISC-V toolchains on the agent's host.

---

## The contract

For each row the agent processes, exactly **one** of these things happens:

1. **Published.** A `.xsil` package goes live on https://extensilica.com under the slug from the catalog row, at version `1.0.0`, with `readinessLevel: 1` and the keyword `catalog-seed`. The catalog checkbox flips to `☑ 1.0.0`.
2. **Skipped (with reason).** The agent reports why the row is not seedable (404 repo, license forbids redistribution, slug already taken by another author, etc.) and the catalog checkbox is updated to `⊘ <reason>`.

Nothing in between. No half-published packages. No silent failures.

---

## Honest scope (read this first)

The agent is **not** porting the simulator, the toolchain, or the RTL. It is producing an *opcode reference + scaffold* package suitable as a starting point for a real port. Every package the agent ships:

- Has `readinessLevel: 1`.
- Carries the keyword `catalog-seed` (so the registry can filter / badge it).
- Carries the keyword `spec-derived` if encodings were extracted from upstream.
- Sets `standardStatus` and `authority` at the **top level of `manifest.json`**, taken verbatim from the catalog row's columns of the same name. Allowed `standardStatus` values: `ratified | draft | vendor | research | custom`.
- Has a clearly worded `README.md` paragraph titled **“What this package is (and is not).”**
- Has a `docs/UPSTREAM.md` with the **exact commit SHA**, the upstream license, and the file paths the encodings were extracted from.
- Has a `sim/spike-extension/` skeleton where every handler body is exactly `// TODO(catalog-seed): semantics not yet implemented`.

If you cannot satisfy any of these, you skip. You do not lie about readiness or about whether the extension is a RISC-V International ratified standard. The whole point of this campaign is that the catalog grows *with* trust, not against it.

---

## Workflow (per row)

### Step 0 — Bootstrap

1. Confirm `xsil --version` works (install with `cargo install xsil` if missing).
2. `xsil login` once at the start of the campaign. The agent should not re-login per row.
3. Choose a clean scratch directory: `~/.cache/xsil-seed/<slug>/`.

### Step 1 — Fetch (upstream pinned by commit SHA)

```bash
mkdir -p ~/.cache/xsil-seed/<slug>
cd       ~/.cache/xsil-seed/<slug>
git clone <Repository URL> upstream/
cd upstream/
git rev-parse HEAD            # record this — call it $SHA
cd ..
```

Record `$SHA`, the upstream license file path, and the **clone date** (UTC).

### Step 2 — Extract encodings (best-effort, format-agnostic)

The upstream may use **any** of these source formats. Try them in order:

| Format                                        | Where it shows up                                                            | How to extract                                                                                                                       |
| --------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `riscv-opcodes`-style YAML / `.idl`           | `riscv/riscv-crypto`, `quic/riscv-unified-db`, T-Head spec repos             | Parse YAML / IDL → mnemonic, format, opcode, funct3, funct7. Highest-fidelity; trust it directly.                                    |
| AsciiDoc / Markdown / PDF instruction tables  | Most vendor specs (T-Head, SpacemiT, Rivos, SiFive)                          | Find the encoding tables; transcribe **only what you can read with high confidence**. Anything ambiguous goes into `docs/UPSTREAM.md` as a known gap. |
| Sail model                                    | `riscv/sail-riscv` and forks                                                 | Read the `clause encdec` blocks; extract the mnemonic + bit pattern.                                                                 |
| C/C++ decoder header                          | Spike, QEMU `target/riscv/insn32.decode`                                     | Read the `.decode` file or `MATCH_*` / `MASK_*` macros.                                                                              |
| SystemVerilog decoder                         | `cv32e40p`, `snitch_cluster`, `ibex`                                         | Read `*_decoder.sv` `casez` patterns.                                                                                                |
| Toolchain-only repo (Andes, some SiFive)      | `andestech/nds-gnu-toolchain`                                                | Look in `gas/config/tc-riscv.c`, `opcodes/riscv-opc.c`, intrinsic header docs.                                                       |
| Nothing usable                                | Anywhere                                                                     | **Skip the row.** Report `⊘ no extractable encodings`.                                                                               |

The agent must produce, for each instruction it can recover with confidence:

```
mnemonic   format   opcode(7b)   funct3(3b)   funct7(7b)   summary
```

Anything the agent is not confident about must be **omitted**, not guessed. A package with 4 well-extracted instructions and 6 listed-but-unencoded ones is far more valuable than a package with 10 invented encodings.

### Step 3 — Scaffold via `xsil new`

```bash
xsil new <slug> --non-interactive \
  --description "<the catalog row's Description column>" \
  --author      <your-username> \
  --version     "1.0.0" \
  --isa         "<best-fit ISA string, e.g. RV64G_<Slug>>" \
  --license     "<SPDX of upstream — the package's own license, see §License below>" \
  --repository  "<Repository URL from the catalog row>"
```

This generates the full skeleton (`manifest.json`, `opcodes.json`, `opcodes.h`, `examples/`, `tests/instructions.S`, `sim/spike-extension/`, `LICENSE`, `CHANGELOG.md`, `README.md`).

Then **populate** it from Step 2's extracted encodings:

- `opcodes.json` — one entry per recovered instruction with `format`, `opcode`, `funct3`, `funct7`, `summary`.
- `opcodes.h` — `xsil new` regenerates the header from `opcodes.json`; rerun the regen step (or rerun `xsil new` to a temp dir and copy the header in).
- `examples/<mnemonic>.S` — keep the wizard-generated stubs.
- `tests/instructions.S` — keep the assemble-only smoke test.
- `sim/spike-extension/<safe_slug>_extension.cc` — leave handler bodies as `// TODO(catalog-seed)`. Do not fake semantics.

### Step 4 — Patch `manifest.json` for catalog-seed mode

The wizard generates a baseline manifest. Apply these **mandatory** edits before publishing:

```jsonc
{
  // ...wizard-generated fields...
  "version":        "1.0.0",
  "readinessLevel": 1,
  "standardStatus": "<ratified | draft | vendor | research | custom>",
  "authority":      "<verbatim from the catalog row's Authority column>",
  "keywords":       ["riscv", "<category-tag>", "catalog-seed", "spec-derived"],
  "metadata": {
    "catalogSeed": {
      "upstreamCommit":  "<$SHA>",
      "upstreamLicense": "<SPDX of upstream>",
      "extractedFrom":   ["<file path 1>", "<file path 2>"],
      "instructionsExtracted": <int>,
      "instructionsListedButUnencoded": <int>,
      "fetchedAt":       "<ISO-8601 UTC>"
    }
  }
}
```

`standardStatus` and `authority` MUST come straight from the catalog row — do not improvise. If the agent disagrees with the catalog (e.g. upstream was demoted from "draft" to "abandoned"), it stops and surfaces the discrepancy instead of silently overriding. If `keywords` already contains `riscv` from the wizard, do not duplicate.

### Step 5 — Author the “What this package is (and is not)” block

In `README.md`, immediately under the title, insert this paragraph (verbatim, with the placeholders filled):

```markdown
> **Catalog-seed package.** This is a **spec-derived scaffold** for `<slug>`,
> generated automatically from upstream commit
> [`<short SHA>`](<repo URL>/commit/<full SHA>). It contains an extracted
> opcode table (`opcodes.json` / `opcodes.h`), one stub assembly example per
> instruction, an assemble-only test, and a Spike `extension_t` skeleton with
> **un-implemented handlers** (`// TODO(catalog-seed)`). It does **not**
> include a working simulator, runnable tests against golden vectors, or a
> pinned toolchain. To turn this scaffold into an RL ≥ 2 package, a maintainer
> needs to implement the Spike handlers, supply test vectors, and re-publish.
> See [`docs/UPSTREAM.md`](docs/UPSTREAM.md) for provenance and
> [Request authorship](https://extensilica.com/package/<slug>) if you want to
> own this package.
```

### Step 6 — Author `docs/UPSTREAM.md`

```markdown
# Upstream provenance

- **Repository:** <Repository URL>
- **Commit:** <full SHA> (fetched <ISO-8601 UTC>)
- **License:** <SPDX>, see upstream `<path/to/LICENSE>`
- **Encodings extracted from:**
  - `<path/to/file1>`
  - `<path/to/file2>`
- **Instructions extracted with confidence:** <N>
- **Instructions listed but not encoded:** <M>  (see below)

## Listed but not encoded

| Mnemonic | Why omitted |
|---|---|
| ... | encoding ambiguous in upstream `<path>` |

## Known gaps vs upstream

- ...
```

### Step 7 — License & redistribution check (gate)

Before packaging anything, verify the upstream license **permits redistribution of derived encoding metadata**. Permissive licenses (Apache-2.0, BSD-2/3, MIT, ISC, MPL-2.0, CC-BY-4.0, CC-BY-SA-4.0) are fine — copy the upstream `LICENSE` file's SPDX into the package's `LICENSE` and reference it. For copyleft (GPL-2.0/3.0): only metadata files (`opcodes.json`, `opcodes.h`) may be derived, and the package must declare the same SPDX. For unknown / proprietary / no-license upstreams: **skip the row** with `⊘ license unclear`.

### Step 8 — Local verify

```bash
xsil publish --dry-run ./pkg/<slug>
```

This must exit 0. The dry-run validates manifest fields, checksum integrity, and archive layout. If it fails, fix the package; do not publish a broken archive just to grow the count.

### Step 9 — Publish

```bash
xsil publish ./pkg/<slug> \
  --changelog "Initial catalog-seed scaffold for <slug>, derived from upstream <short SHA>."
```

### Step 10 — Verify round-trip

```bash
xsil install <slug>
xsil run     <slug>     # for catalog-seed packages, the entry script just prints "scaffold only"
```

Confirm the package page resolves at `https://extensilica.com/package/<slug>`.

### Step 11 — Update the catalog

Edit [`catalog.md`](./catalog.md), flipping the row's status column from `☐` to `☑ 1.0.0` (or to `⊘ <short reason>` if skipped). Commit:

```bash
git add docs/catalog-seed/catalog.md
git commit -m "catalog-seed: publish <slug> v1.0.0 (or: skip <slug> — <reason>)"
```

Do **not** push automatically. The operator handles batched pushes.

---

## Skip rules (the agent must skip — no exceptions)

| Trigger                                                                                                | Catalog status entry                |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| Repository URL returns 404 / private / archived without a public mirror                                | `⊘ repo unavailable`                |
| Upstream license is missing, proprietary, or explicitly forbids redistribution of opcode metadata      | `⊘ license unclear`                 |
| Slug is already published on the registry under another author and authorship is not yours to claim   | `⊘ slug taken`                      |
| Zero instructions can be extracted with confidence and the row is *not* a CSR-only / pseudo-extension | `⊘ no extractable encodings`        |
| Upstream is a binary-only release (no spec, no decoder, no headers)                                    | `⊘ no machine-readable spec`        |

A skip is a successful outcome. The campaign's measurable progress is `published + skipped == catalog rows`, not just `published`.

---

## What the agent reports back per row

```
ROW:        <#> <slug>
ACTION:     published | skipped
SLUG URL:   https://extensilica.com/package/<slug>     (if published)
ARCHIVE:    /abs/path/to/<slug>-1.0.0.xsil             (if published)
ARCHIVE SHA: <sha256>                                  (if published)
INSTRUCTIONS EXTRACTED: <N>
INSTRUCTIONS LISTED-BUT-UNENCODED: <M>
UPSTREAM SHA: <full SHA>
NOTES:      <one paragraph; especially: any Support claim that was downgraded,
             any encoding the agent had to omit, any place a maintainer must
             pick up the work>
```

---

## Hard rules (read once, internalize, never violate)

1. **Never invent encodings.** Omit anything you cannot read directly from upstream.
2. **Never claim RL > 1** in a catalog-seed run.
3. **Never lie about `standardStatus`.** Never label a draft / vendor extension as `ratified`. The catalog row is the source of truth — copy it, don't improvise.
4. **Never publish without a passing `xsil publish --dry-run`.**
5. **Never publish a slug that already exists** unless authorship is yours.
6. **Never skip the “What this package is (and is not)” block in the README.**
7. **Never re-login per row** — `xsil login` is once per campaign.
8. **Always pin upstream by commit SHA, never by branch.**
9. **Always update `catalog.md`** in the same git commit that records the result of the row.

---

## Prompt block (paste into the agent verbatim, with `<ROW>` filled)

````
You are the ExtenSilica catalog-seed agent. Process exactly ONE row and stop.

Authoritative procedure: docs/catalog-seed/agent-prompt.md (in this repo).
Authoritative catalog:   docs/catalog-seed/catalog.md       (in this repo).

═══════════════════════════════════════════════════════════════════════════
INPUT (one row from the catalog)
═══════════════════════════════════════════════════════════════════════════
| # | Extension | Category | Description | Repository URL | Support |
| <ROW>                                                                  |

═══════════════════════════════════════════════════════════════════════════
SCOPE
═══════════════════════════════════════════════════════════════════════════
Produce an RL 1 catalog-seed `.xsil` for the slug above and PUBLISH it,
or SKIP per the rules in §Skip rules of agent-prompt.md.

DO NOT:
  - port a simulator
  - implement Spike handler bodies
  - bundle or pin a toolchain
  - mark readinessLevel > 1
  - invent any encoding you cannot read directly from upstream

DO:
  - clone upstream, pin the commit SHA
  - extract opcodes/encodings only where you can read them with confidence
  - run `xsil new` and patch the manifest as documented
  - write the "What this package is (and is not)" README block VERBATIM
  - write docs/UPSTREAM.md with provenance
  - run `xsil publish --dry-run`, then `xsil publish`
  - verify the round-trip with `xsil install` + `xsil run`
  - update docs/catalog-seed/catalog.md and commit (no push)

═══════════════════════════════════════════════════════════════════════════
DELIVERABLE
═══════════════════════════════════════════════════════════════════════════
Stream progress logs as you go, and at the end print the report block from
§"What the agent reports back per row" (in agent-prompt.md).

START NOW. One row. Stop after the catalog commit.
````

---

## Cross-references

- Catalog (the 91 rows): [`catalog.md`](./catalog.md)
- Reproducible (RL ≥ 2) playbook: [`../agent-publish-extension.md`](../agent-publish-extension.md)
- `.xsil` format spec: [`spec/xsil.md`](https://github.com/ExtenSilica/xsil/blob/main/spec/xsil.md)
- Reference example: [`examples/rvx-demo`](https://github.com/ExtenSilica/xsil/tree/main/examples/rvx-demo)
- Pre-silicon readiness ladder: [`../pre-silicon-bridge-readiness.md`](../pre-silicon-bridge-readiness.md)
