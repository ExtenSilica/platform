# ExtenSilica Pivot v2 — Standard & Reproducible Execution

**Status:** Target mental model (codebase not yet updated)  
**Date:** March 2025

This document resets the product definition of ExtenSilica. It supersedes marketplace- and commerce-oriented framing in favor of a **technical standard** for **reproducible RISC-V extensions**.

---

## Previous model

After earlier pivots, ExtenSilica was described as a **distribution platform** combining:

- A **store** (frontend + backend) with browse, search, extension detail, and developer dashboards
- **Registry** (Verdaccio) for `.xsil` artifact storage
- **CLI** for install, flash, pack, and sign
- **Commercial and access-control layers:** pay-per-flash **licensing**, **credits**, **license tokens**, **Stripe** payments, **developer revenue share**, **Web3 wallet** authentication, and **marketplace** language (storefront, purchase flows, “extension marketplace”)

Security docs also described **runtime license enforcement** (e.g. boot wrapper gating CPU on token) and **device fingerprint** binding tied to **monetization** and **authorization to flash**.

That model positioned ExtenSilica as a **platform business** with monetization and licensing as first-class concerns.

---

## New model

**ExtenSilica is a standard for publishing reproducible RISC-V extensions.**

The goal is **reproducibility** and **interoperability**: a clear **package format**, **validation**, and **distribution** so that anyone can build, verify, and run the same extension artifacts on supported hardware.

**Core components (non-negotiable):**

| Component | Role |
|-----------|------|
| **`.xsil` format** | The **standard** — schema, archive layout, integrity hashes, and developer signatures so packages are reproducible and verifiable. |
| **CLI** | **Execution** and **validation** — install/extract, verify signatures and hashes, run documented commands (e.g. flash), pack/sign; no commercial gatekeeping. |
| **Registry** | **Distribution** — host and resolve `.xsil` blobs; version metadata and download URLs. |

Everything else (store UI, rich backend, payments) is **optional infrastructure** around the standard, not the definition of ExtenSilica.

---

## What is removed (conceptual scope)

The following are **out of scope** for the ExtenSilica *product definition* going forward:

- **Marketplace** framing — no “store” as the primary identity; no commerce-first UX as the core story
- **Licensing platform** — no pay-per-flash, license tokens as product access, or “you must own a license to install” as the default model
- **Monetization** — no credits, Stripe checkout, revenue share, or developer payouts as part of the standard
- **Web3** — wallet login, on-chain identity, or token-gated flows as required or central to the platform
- **Optional:** Runtime license wrapper / device fingerprint **when tied to** commercial enforcement (can be replaced by pure technical verification and reproducibility)

**Note:** Code, APIs, and docs that still implement the removed concepts are **legacy** until a follow-up change removes or refactors them. This document does not modify code.

---

## What remains

| Area | Remains |
|------|----------------|
| **`.xsil` / XSil spec** | Format, manifest (`isa`, optional per-package FPGA metadata, `payloadHash`, signatures, etc.), layout (`toolchain/`, `sim/`, …), integrity rules |
| **CLI** | Pack, sign, install, verify, list/info, flash **as mechanical execution** of manifest commands; validation of hashes and signatures |
| **Registry** | Storing and serving `.xsil` packages; integrity metadata (e.g. package hash) for downloads |
| **Cryptographic trust** | Developer (and optionally org) signatures for **integrity and authorship**, not for **sales** or **entitlement** |
| **Reproducibility** | Same inputs → same verified payload; documented commands and board metadata |

**Documentation split** — Older docs such as:

- Legacy commerce docs removed; see current [security-model.md](./security-model.md) and [extensilica-architecture.md](./extensilica-architecture.md).

describe the **previous model** until they are rewritten or archived.

---

## Summary

| | Previous (post–bitstream, pre–v2) | Pivot v2 (target) |
|---|-----------------------------------|---------------------|
| **Identity** | Distribution platform + marketplace + licensing | **Standard** for reproducible RISC-V extensions |
| **Money** | Credits, licenses, Stripe, Web3 | **None** in core definition |
| **Core** | Store + backend + registry + CLI + licensing | **`.xsil` + CLI + registry** |
| **Success** | Paid flashes, revenue share | Reproducible builds, verified artifacts, shared tooling |

---

## Next steps (out of band)

Future work (not part of this document): align `spec/xsil.md`, READMEs, `extensilica-architecture.md`, and code with this model; remove or isolate backend/frontend paths that only serve licensing and Web3; simplify CLI to validation + execution without commercial APIs.
