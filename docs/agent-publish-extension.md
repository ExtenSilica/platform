# Agent Publishing Procedure — `.xsil` packages (RL ≥ 2, reproducible)

**Status:** Canonical playbook (May 2026)
**Audience:** An autonomous coding agent (e.g. Claude / Codex / Cursor) that has shell, filesystem, and internet access.
**Goal:** Take **one** row from a catalog of RISC-V extensions and produce a fully reproducible `.xsil` package, prove it runs and passes its tests with the public `xsil` CLI, and publish it (when explicitly authorized).

> **Looking for the lightweight catalog-seed variant?** If the goal is to seed the registry with **RL 1 spec-derived scaffolds** (no working simulator, no pinned toolchain — just extracted opcodes + skeleton), use **[`catalog-seed/agent-prompt.md`](./catalog-seed/agent-prompt.md)** instead. It runs row by row across the 91 rows in [`catalog-seed/catalog.md`](./catalog-seed/catalog.md). This document is the **upgrade path** for a maintainer (or a follow-up agent run) that wants to take a seeded scaffold to RL ≥ 2.

This replaces the ad-hoc prompt that was used to publish `riscv-zbkb v1.0.0`. It folds in everything that has changed since:

- `xsil` is now on **crates.io** — install with one command.
- A new **`xsil new`** command produces a far richer skeleton than `xsil init`.
- `xsil publish --dry-run` is supported natively (no fallback needed).
- The web wizard at `https://extensilica.com/wizard` produces the same skeleton through a UI.

---

## How to use this document

The agent should be given:

1. The **input row** describing the extension to package.
2. This document (or the prompt block under [§Prompt](#prompt-paste-into-the-agent), which is the canonical text to paste).
3. Permission scope (defaults to **dry-run only**; explicit authorization required to publish).

When the agent finishes, it returns the deliverables enumerated under [§Deliverables](#deliverables).

---

## Input format

Single-row table; same columns the catalog uses everywhere else in the project:

```
| # | Extension | Standard | Authority | Category | Description | Repository URL | Support |
```

Where:

- `Standard` is one of `ratified`, `draft`, `vendor`, `research`, `custom` (see `spec/xsil.md` §4.7).
- `Authority` is the body that defines the extension (e.g. `RISC-V International`, `T-Head / XuanTie`, `University of Michigan`). 2–200 characters.
- `Support` is a comma-separated list drawn from `Spec`, `Simulator`, `Toolchain`, `Tests`, `RTL`, `FPGA`. Every asset listed in `Support` **must** end up represented in the package — either bundled in the archive or resolved by pinned URL + sha256.

Both `Standard` and `Authority` are mandatory and propagate into the generated `manifest.json` at the top level (`standardStatus`, `authority`). The registry rejects publishes with unknown `standardStatus` values, and the homepage groups packages by this field — never label something `ratified` unless RISC-V International has actually frozen the spec.

Example (the row used for `riscv-zbkb`):

```
| 1 | riscv-zbkb | ratified | RISC-V International | Standard crypto extension | Basic bit-manipulation crypto helper extension | https://github.com/riscv/riscv-crypto | Spec, Simulator, Toolchain, Tests |
```

---

## Prompt (paste into the agent)

````
You are a packaging agent for the ExtenSilica `.xsil` format.
Your job: take ONE row from the catalog below and produce a fully reproducible
`.xsil` package, then prove it runs and passes its tests with the public `xsil`
CLI. You must do everything yourself: clone the upstream repo, build, package,
verify, and report.

══════════════════════════════════════════════════════════════════════════════
INPUT (row to process — single row table)
══════════════════════════════════════════════════════════════════════════════
| # | Extension | Standard | Authority | Category | Description | Repository URL | Support |
| 1 | <FILL>    | <FILL>   | <FILL>    | <FILL>   | <FILL>      | <FILL>         | <FILL>  |

`Standard` is one of: ratified, draft, vendor, research, custom (xsil spec §4.7).
`Authority` is free text (2–200 chars) identifying who defines the spec.
Both fields MUST be copied verbatim into manifest.standardStatus / manifest.authority.
Do NOT label the package `ratified` unless RISC-V International has frozen it;
the registry validates this and the homepage groups packages by status.

Every asset listed in `Support` MUST end up represented in the final package,
either **bundled** in the archive or **resolved** by pinned URL + sha256.
Nothing in `Support` may be silently dropped.

══════════════════════════════════════════════════════════════════════════════
NORMATIVE REFERENCES (read these first, no shortcuts)
══════════════════════════════════════════════════════════════════════════════
1. Spec:    https://github.com/ExtenSilica/xsil/blob/main/spec/xsil.md  (v0.2)
              Required manifest fields  → §4.1
              Execution block           → §4.4
              Resolution modes          → §4.5
              Dependencies              → §4.6
              Targets                   → §5
              Toolchain                 → §6
              Checksums                 → §7
              Normative rules           → §10
2. Example: https://github.com/ExtenSilica/xsil/tree/main/examples/rvx-demo
              Use it as the structural template (manifest + targets + checksums).
3. CLI:     https://crates.io/crates/xsil  (binary `xsil`)
              `xsil new`     — interactive wizard, generates a richer skeleton
              `xsil init`    — minimal scaffold (no opcode table / no Spike skel)
              `xsil publish --dry-run` is natively supported.
4. Web:     https://extensilica.com/wizard  (alternative to `xsil new` if the
              agent has only a browser; output is byte-identical).

══════════════════════════════════════════════════════════════════════════════
TOOLS REQUIRED (install if missing — log every install command)
══════════════════════════════════════════════════════════════════════════════
- git, curl, tar, gzip, sha256sum, jq
- Rust toolchain (stable) — only needed if the agent has to build `xsil` itself
- xsil CLI:
      cargo install xsil          # preferred, from crates.io
      # OR a prebuilt binary from https://github.com/ExtenSilica/xsil/releases
- A working RISC-V simulator (pick ONE and stick to it for the run):
      Spike   (riscv-isa-sim)        ← preferred, especially for crypto/bitmanip
      QEMU    (qemu-riscv64-static)  ← fallback when Spike is awkward to build
- A RISC-V toolchain matching the chosen ISA (e.g. for zbkb:
      triple   riscv64-unknown-elf
      compiler GCC ≥ 12 or Clang ≥ 15  — must understand `_zbkb` / `-march=rv64g_zbkb`).

══════════════════════════════════════════════════════════════════════════════
WORKFLOW (do them in order; do not skip steps)
══════════════════════════════════════════════════════════════════════════════

STEP 0 — Bootstrap a skeleton
  Prefer `xsil new` over hand-rolling the directory. Run:
      xsil new <slug> --non-interactive \
                       --description     "<one-liner>" \
                       --author          "<your-username>" \
                       --version         "1.0.0" \
                       --isa             "<ISA, e.g. RV64G_Zbkb>" \
                       --license         "<SPDX, e.g. Apache-2.0>" \
                       --repository      "<upstream URL>" \
                       --standard-status "<ratified|draft|vendor|research|custom>" \
                       --authority       "<Authority, e.g. RISC-V International>"
  This generates:
      manifest.json            (with all required fields per §4.1)
      opcodes.json             (machine-readable encoding table — empty list ok)
      opcodes.h                (C macros built on `.insn`-based inline asm)
      examples/<mn>.S          (one runnable example per declared instruction)
      tests/instructions.S     (combined regression — extend it)
      sim/spike-extension/     (Spike `extension_t` skeleton + Makefile + README)
      toolchain/, LICENSE (full SPDX text), CHANGELOG.md, README.md

  If the slug contains hyphens, ensure that `sim/spike-extension/<slug>_extension.cc`
  uses the SAFE IDENTIFIER (hyphens → underscores) inside `REGISTER_EXTENSION(...)`.
  `xsil new` does this automatically; if you hand-edit the file, preserve it.

STEP 1 — Discover (read-only)
  1.1  `git clone <Repository URL> upstream/`
  1.2  Walk the tree. For each item in `Support`, locate the actual asset:
         Spec       → markdown / asciidoc / pdf describing the opcodes
         Simulator  → reference C/C++/Sail model OR Spike patches
         Toolchain  → required gcc/clang version + flags
         Tests      → test vectors, golden outputs, hex/elf traces
  1.3  Pin upstream by **commit SHA** (not branch). Record it in `docs/UPSTREAM.md`.
  1.4  Classify maturity → choose ONE `resolution.mode` per spec §4.5:
         "bundled"        : you can put toolchain binaries + sim binary inside
                            the .xsil archive (ok when ≤ ~200 MB and license allows)
         "resolved"       : declare each binary as a dependency with url+sha256
                            (preferred when the toolchain is large or upstream
                            already publishes signed releases)
         "host-dependent" : only allowed if Spec/Tests cannot be exercised without
                            host-installed tools you cannot bundle or resolve
       Justify the choice in one paragraph in `docs/RESOLUTION.md`.

STEP 2 — Fill in the package directory  (./pkg/<slug>/)
  Required layout (per spec §3, augmented by `xsil new` output):
    manifest.json
    README.md
    docs/
      spec.md              (instruction set, copied/adapted from upstream)
      UPSTREAM.md          (commit SHA, source URLs, license notes)
      RESOLUTION.md        (which mode and why)
    sim/
      run.sh               (entry point — exits 0 on success)
      spike.yaml           (Spike config: isa=<…>)
      spike-extension/     (already scaffolded by `xsil new`)
      bin/                 (compiled test program, if bundled)
    tests/
      run.sh               (test driver — exits 0 on success)
      instructions.S       (already scaffolded by `xsil new` — extend it)
      vectors/             (golden inputs/outputs)
      expected.txt
    examples/<mn>.S        (one per declared instruction; from `xsil new`)
    opcodes.json           (from `xsil new`)
    opcodes.h              (from `xsil new`)
    toolchain/             (only when mode=bundled; otherwise list as dependency)
    src/                   (the actual C/asm program(s) that exercise the extension)

  The minimum viable execution must:
    1. Compile `src/<slug>_demo.c` (or equivalent) with the ISA-appropriate
       `-march=…` flag using the bundled or resolved toolchain.
    2. Run it under Spike (or QEMU) — the binary must execute at least one
       extension-specific instruction (verifiable in the simulator trace).
    3. `tests/run.sh` must compare actual output to `tests/vectors/expected.txt`
       with `diff -u` and exit non-zero on mismatch.

STEP 3 — Final `manifest.json` (must satisfy §4.1 required fields)
  Starting from what `xsil new` generated, set/refine:
    {
      "name":        "<slug>",
      "version":     "1.0.0",
      "description": "<one line>",
      "author":      "<your-username>",
      "license":     "<SPDX>",
      "repository":  "<upstream URL>",
      "homepage":    "https://extensilica.com/package/<slug>",
      "keywords":    ["riscv", "<ext-tag>", ...],
      "isa":         "<e.g. RV64G_Zbkb>",
      "execution": {
        "entry":     "sh sim/run.sh",
        "testEntry": "sh tests/run.sh",
        "env": {
          "PATH": "$XSIL_TOOLCHAIN_ROOT/bin:$XSIL_SPIKE_ROOT/bin:$PATH"
        }
      },
      "toolchain": {
        "root":    "toolchain",
        "triple":  "riscv64-unknown-elf",
        "version": "<detected gcc/clang version>"
      },
      "targets": {
        "spike": { "config": "sim/spike.yaml" },
        "qemu":  { "machine": "virt", "cpu": "rv64,<flag>=true" }
      },
      "checksums": {
        "payload": "sha256:<computed>",
        "archive": "sha256:<computed-after-tar-gz>"
      },
      "resolution": { "mode": "<bundled|resolved>" },
      "dependencies": { /* ONLY when mode == "resolved"; every entry MUST
                          have url + sha256, version != "latest" */ }
    }

STEP 4 — Verify locally (do not push anywhere yet)
      xsil run     ./pkg/<slug>            # entry must exit 0
      xsil test    ./pkg/<slug>            # tests must exit 0
      xsil publish ./pkg/<slug> --dry-run  # validate + show what would upload

STEP 5 — Produce + reproducibility check
  5.1  Pack:                 tar -czf <slug>-1.0.0.xsil -C pkg <slug>
       (or let `xsil publish` do it; both routes must yield the same archive
       once `--dry-run` is satisfied.)
  5.2  Recompute and confirm both checksums match the manifest.
  5.3  Install + run from the archive on a fresh temp dir:
           xsil install ./<slug>-1.0.0.xsil
           xsil run     <slug>
           xsil test    <slug>
  5.4  Reproducibility probe: rebuild from scratch (delete `pkg/<slug>/`,
       re-run STEPS 0-5) and confirm `checksums.archive` is byte-identical
       between builds. If it is not, find the source of nondeterminism
       (timestamps, file order, build flags) and fix it before reporting
       success.

STEP 6 — Publish (ONLY when explicitly authorized)
  Default mode is dry-run-only. To actually upload:
      xsil login                                # interactive
      xsil publish ./pkg/<slug> \
        --changelog "Initial public release of <slug>."
  After publish, verify the round-trip:
      xsil install <slug>          # from registry, fresh slate
      xsil run     <slug>
      xsil test    <slug>

══════════════════════════════════════════════════════════════════════════════
ACCEPTANCE CRITERIA (must ALL be true to declare success)
══════════════════════════════════════════════════════════════════════════════
  [ ] Manifest has every required field from spec §4.1.
  [ ] `resolution.mode` ∈ {bundled, resolved}; "host-dependent" requires
      explicit justification.
  [ ] If mode == "resolved", every entry under `dependencies.tools[]` has
      a pinned version (≠ "latest") and a sha256 per platform.
  [ ] `xsil run <slug>` exits 0 and the run executes ≥ 1 extension-specific
      instruction (verifiable in the simulator trace).
  [ ] `xsil test <slug>` exits 0 and `diff` against expected.txt is empty.
  [ ] `xsil publish --dry-run` exits 0.
  [ ] `checksums.payload` recomputed from the unpacked archive matches
      the manifest.
  [ ] Re-building from a clean tree yields the same `checksums.archive`.

══════════════════════════════════════════════════════════════════════════════
CONSTRAINTS (hard rules)
══════════════════════════════════════════════════════════════════════════════
- Pin upstream by commit SHA. No floating branches. No "latest".
- Do not fabricate test vectors. Either:
   (a) reuse upstream vectors, citing the source file in `docs/UPSTREAM.md`, or
   (b) derive vectors directly from the spec encoding and document the
       derivation in `tests/README.md`.
- Do not mark a package as "bundled" while pulling anything from the network
  at run-time. "bundled" means the archive is fully self-contained.
- Do not push, publish, or `xsil login` unless STEP 6 is explicitly
  authorized in the task instructions. Stop at local verification by default.
- Do not modify the global system. Use `~/.cache/xsil-build/` for scratch.
- Every external download must be checksum-verified before use.
- If the slug contains hyphens, use the underscored identifier inside the
  Spike `REGISTER_EXTENSION(...)` macro and the C++ class name. (`xsil new`
  does this automatically — preserve it if you hand-edit.)

══════════════════════════════════════════════════════════════════════════════
DELIVERABLES (return to the user at the end)
══════════════════════════════════════════════════════════════════════════════
1. Absolute path to `<slug>-1.0.0.xsil`.
2. The final `manifest.json` (printed inline).
3. Stdout/stderr of `xsil run`, `xsil test`, and `xsil publish --dry-run`.
4. SHA-256 of the produced archive (output of `sha256sum`).
5. Detected maturity / readiness level (1–5) + 3-sentence justification.
6. Reproducibility report: archive sha256 from build #1 vs build #2.
7. List of anything in the `Support` column that could not be honored 1:1
   (e.g. "Toolchain bundled as dependency, not embedded — 230 MB exceeds
   reasonable archive size; pinned by sha256").
8. The same prompt with the input row replaced by an empty template, so the
   operator can reuse it for the next row of the master catalog.

START NOW. Stream progress logs as you go.
````

---

## Why this is different from the previous version

| Topic | Previous (riscv-zbkb run) | Now |
|---|---|---|
| Install `xsil` | `cargo install --git … --path cli` | `cargo install xsil` (crates.io) |
| Bootstrap directory | `xsil init`, then hand-write opcode table | `xsil new` (interactive wizard or `--non-interactive` flags) ships opcodes.json/.h, examples/<mn>.S, tests/instructions.S, sim/spike-extension/, full SPDX LICENSE, CHANGELOG.md |
| `xsil publish --dry-run` | Was missing, agent had to fall back to install + run | Native, must be used |
| Spike skeleton | None — agent had to author it | Generated; agent only fills in handler bodies |
| Hyphenated slug → C identifier | Not flagged | Hard rule (REGISTER_EXTENSION must use underscored name) |
| Web alternative | Not mentioned | `https://extensilica.com/wizard` produces the same skeleton |
| Authority to publish | Implicit (often left ambiguous) | Default = dry-run only; STEP 6 must be explicitly authorized |

---

## Deliverables

When the agent reports back, expect:

1. Path to the produced `.xsil`.
2. Final `manifest.json` (inline).
3. Stdout/stderr of `xsil run`, `xsil test`, and `xsil publish --dry-run`.
4. `sha256sum` of the archive.
5. Detected RL (1–5) with 3-sentence justification.
6. Reproducibility check: archive SHA from build #1 vs build #2 (must match).
7. Honest list of anything in `Support` that was downgraded (e.g. "Toolchain resolved, not bundled, due to 230 MB size").
8. The same prompt with the input row blanked, ready for the next catalog row.

---

## Authorization gate (STEP 6)

`xsil publish` is irreversible: a published `(slug, version)` pair is permanently locked. Therefore the procedure defaults to **dry-run only**, and explicit instructions are required to actually upload. A typical authorization phrase is:

> "Verified the dry-run output. Authorized to publish `<slug>` v1.0.0 to production."

If the agent does not see that, it stops at STEP 5 and surfaces the dry-run output for review.

---

## Cross-references

- Catalog-seed variant (RL 1 scaffolds): [`catalog-seed/agent-prompt.md`](./catalog-seed/agent-prompt.md), with the 91-row tracker in [`catalog-seed/catalog.md`](./catalog-seed/catalog.md).
- Format spec: [`spec/xsil.md`](https://github.com/ExtenSilica/xsil/blob/main/spec/xsil.md) (v0.2)
- Reference example: [`examples/rvx-demo`](https://github.com/ExtenSilica/xsil/tree/main/examples/rvx-demo)
- Backend publishing flow: [`publishing-flow-v3.md`](./publishing-flow-v3.md)
- Human publisher guide: [`developer-publishing.md`](./developer-publishing.md)
- Pre-silicon readiness ladder: [`pre-silicon-bridge-readiness.md`](./pre-silicon-bridge-readiness.md)
