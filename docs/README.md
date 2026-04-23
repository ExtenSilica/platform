# ExtenSilica Documentation

## Platform Overview

**ExtenSilica** is a **standard for publishing reproducible RISC-V extensions**.

**Core:** `.xsil` format (standard) + **`xsil` CLI** (public [ExtenSilica/xsil](https://github.com/ExtenSilica/xsil)) + **registry** (this private repo: hosted API + website).

See **[REPOS_AND_PUBLIC_XSIL.md](./REPOS_AND_PUBLIC_XSIL.md)** for the split between this **private** platform repository and the **public** `xsil` tooling repo.

See **[architecture-v2.md](./architecture-v2.md)** for the consolidated architecture (format, CLI, registry, flows). Historical pivot notes: **[pivot-v2.md](./pivot-v2.md)**.

RISC-V softcore extension packages are delivered as FPGA bitstreams and toolchains inside `.xsil` archives.

An extension package (`.xsil`) contains:

- **Optional FPGA bitstreams** (paths and ids declared per package, not from a global board list)
- **Custom GCC/toolchain** for the extended ISA
- **Example software**
- **Metadata and signatures** for integrity and trust

**Primary user command:**

```bash
xsil run <package>
```

## Examples

- **Public `xsil` repo** — `xsil init`, `examples/rvx-demo`, and the normative spec: **[github.com/ExtenSilica/xsil](https://github.com/ExtenSilica/xsil)**.
- **Publisher workflow** in this repo’s docs still applies; for scaffolding see the copy of [developer-publishing.md](./developer-publishing.md) in the public tree (or clone `ExtenSilica/xsil` and open `docs/developer-publishing.md` there).

## Documents

- **[deploy-runbook.md](./deploy-runbook.md)** — **Production deploy:** target host setup (DB, TLS, DNS, env vars), backend + frontend rollout, post-deploy checks. Pair with **[launch-checklist-v3.md](./launch-checklist-v3.md)** §12.
- **[architecture-v2.md](./architecture-v2.md)** — XSIL standard architecture: format, CLI, registry, execution / developer / user flows.
- **[publishing.md](./publishing.md)** — Minimal publishing workflow: `xsil build`, `xsil publish`; package structure, required files, `entry`, simulator vs FPGA targets.
- **[reproducibility.md](./reproducibility.md)** — Why many RISC-V extension artifacts are not reproducible today; how XSIL + `xsil run` establish a reproducibility foundation; example *paper → xsil → xsil run*.
- **[execution-model.md](./execution-model.md)** — How `xsil run` selects simulator (default) vs FPGA (optional); automatic target selection.
- **[pivot-v2.md](./pivot-v2.md)** — Pivot v2: previous vs new model; what is removed (marketplace, licensing, monetization, Web3); what remains (xsil, CLI, registry).
- **[extensilica-architecture.md](./extensilica-architecture.md)** — System architecture (CLI, registry, optional API/UI; no monetization).
- **[pivot-baseline.md](./pivot-baseline.md)** — Snapshot of repo state and terminology before the RISC-V bitstream pivot (historical reference).
- **[Architectural Fidelity Risk in RISC-V Emulation.md](./Architectural%20Fidelity%20Risk%20in%20RISC-V%20Emulation.md)** — Technical whitepaper on LR/SC coherence granularity and verification assurance in RISC-V tooling.
- **[security-model.md](./security-model.md)** — Integrity and optional signatures (technical trust only).
- **[license-wrapper.md](./license-wrapper.md)** — Historical note; commercial runtime license model removed.
