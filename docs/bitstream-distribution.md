# ExtenSilica Bitstream Distribution Model

This document describes how ExtenSilica distributes RISC-V extension packages and where synthesis, packaging, and distribution responsibilities lie.

## Distribution model

- **Developers synthesize bitstreams themselves.** The FPGA bitstream (e.g. `.bit`) is produced by the developer’s own toolchain (e.g. Yosys, Vivado, nextpnr) from their RTL and constraints.
- **Developers declare hardware targets inside each `.xsil`.** Bitstream paths, optional flash commands, and target **ids** are **publisher-defined** in that package’s manifest. **There is no ExtenSilica-wide board list**—the CLI and registry never substitute or validate ids against a global catalog (see [execution-model.md](./execution-model.md), [spec/xsil.md](../spec/xsil.md)).
- **ExtenSilica does not perform FPGA synthesis.** The platform never runs synthesis tools or generates bitstreams. It only stores and serves artifacts that developers have already built.
- **ExtenSilica distributes artifacts only.** The platform’s role is to host, verify, and deliver signed packages (bitstreams, toolchains, software). It does not build or modify their contents.

## User flows

### Installation

Users install an extension package from the registry:

```bash
xsil install <package>
```

This fetches the `.xsil`, verifies integrity (and optional signatures), and installs contents to local storage (e.g. `~/.extensilica/extensions/<name>/<version>/`).

### Execution

Primary execution is **`xsil run`** using the manifest **`entry`** and **`targets`** (simulator first by default; optional FPGA per package). Any FPGA or bitstream flow must use **only** paths and ids **declared in that package**—not a platform default board.

## Responsibilities

### Developer

- **Build the CPU / RTL** — Design and implement the RISC-V core and any custom ISA extensions.
- **Synthesize bitstreams** — Run the FPGA toolchain to produce bitstreams for **hardware they name** in their manifest.
- **Package as .xsil** — Assemble `manifest.json`, optional `bitstream/`, `toolchain/`, `tests/`, `docs/`, etc.; set `targets` and any optional per-manifest `boards` / FPGA metadata; compute `payloadHash` and sign as required.
- **Publish** — Upload the `.xsil` and register version metadata (see [publishing.md](./publishing.md)).

### Platform (ExtenSilica)

- **Registry** — Store and serve `.xsil` packages; expose integrity hashes and download URLs.
- **Verification** — Verify payload hashes and optional signatures.
- **Installation / run** — Support `xsil install` and **`xsil run`**; resolve packages and versions; **do not** maintain a global board directory.

The platform does **not** build, synthesize, or modify bitstreams or toolchains; it only distributes and verifies artifacts supplied by developers.
