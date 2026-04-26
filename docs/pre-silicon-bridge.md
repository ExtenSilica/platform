# Pre-silicon bridge (platform)

**ExtenSilica is the pre-silicon bridge for RISC‑V extensions:** runnable, testable, reproducible packages teams can **evaluate** before committing to RTL, FPGA, or ASIC work. We do **not** claim silicon sign-off or “ASIC-ready” in one step.

## Readiness (RL)

The product uses **one** scale everywhere (registry, webapp, `xsil info`): **Readiness Level RL1–RL5** today, with conservative names:

| RL | Name (short) | Idea (matches registry ladder) |
|----|----------------|----------------------------------|
| 1 | Packaged | Baseline when no sim target (`spike` / `qemu`) is declared in `targets` |
| 2 | Runnable | `targets` includes Spike and/or QEMU |
| 3 | Reproducible | RL2 + bundled toolchain (`toolchain.external === false` when JSON) |
| 4 | Testable | RL2 + tests (`execution.testEntry` or legacy `execution.tests`) |
| 5 | HW-evaluable | RL2 + `targets` includes `rtl` and/or `fpga` |

**Capabilities** (repro modes, toolchain, Spike/QEMU, RTL, FPGA, tests, etc.) are **secondary facts** derived from stored manifest echoes—not a parallel “maturity” scale.

Authors may optionally add **`manifest.evidence`** (HTTPS links and optional SHA-256 digests); the registry echoes it per version and the package page shows an **Evidence** section when it is present. That block does **not** change RL1–RL5 by itself.

## Where this is enforced

- **Webapp:** discovery, package pages, and admin surfaces show the phrase *pre-silicon bridge* and RL + capability chips/checklists.
- **CLI:** `xsil info` prints the same readiness line and checklist vocabulary as the webapp (see the public `xsil` repo’s `docs/cli-v3.md`).

## Full reference

Normative vocabulary, capability strings, RL6/RL7 notes, and the engineering checklist live in:

**[pre-silicon-bridge-readiness.md](./pre-silicon-bridge-readiness.md)**

Use that document when changing schema, API fields, or copy so UI, backend, and CLI stay aligned.
