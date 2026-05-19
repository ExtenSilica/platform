# Individual Contributor License Agreement (CLA)

**Version 1.0 — May 2026**

Thank you for your interest in contributing to ExtenSilica platform software (the "Project"), operated by ExtenSilica Ltda. ("Project Steward").

This agreement applies to contributions to the **private platform repository** (registry API, website, deploy tooling). It does **not** replace upstream licenses on `.xsil` packages published by third parties on the registry.

## What this CLA does **not** cover

**Publishing a `.xsil` package on the registry does not require this CLA.**

The public product accepts versioned **`.xsil` archives** via `xsil publish` (and related API flows). That is separate from git pull requests to the platform codebase:

| Activity | Requires this CLA? |
|----------|-------------------|
| `xsil publish` / upload a `.xsil` package | **No** |
| Package license in `manifest.json` / files inside the `.xsil` | Your upstream SPDX license |
| Optional `repository` URL pointing at GitHub (or elsewhere) | Governed by **that** repo, not ExtenSilica |
| Pull request to the **ExtenSilica platform** repository (API, website, ops) | **Yes** |

If you only publish packages, follow [Contributing on the site](https://extensilica.com/contributing) and your package license. Sign this CLA only when you intend to contribute **platform source code** in the private repository.

## 1. Definitions

- **"You"** means the individual or legal entity submitting a contribution.
- **"Contribution"** means any original work of authorship submitted for inclusion in the Project (code, documentation, configuration, or other material).

## 2. Grant of rights

Subject to the terms of this agreement, You grant the Project Steward and recipients of the Project:

1. A perpetual, worldwide, non-exclusive, royalty-free copyright license to reproduce, prepare derivative works of, publicly display, publicly perform, sublicense, and distribute Your Contributions and such derivative works under the **Apache License, Version 2.0**, or another license the Project Steward designates for the affected files.

2. A perpetual, worldwide, non-exclusive, royalty-free patent license to make, have made, use, offer to sell, sell, import, and otherwise transfer the Contribution, where such license applies only to patent claims licensable by You that are necessarily infringed by Your Contribution alone or by combination of Your Contribution with the Project.

## 3. Representations

You represent that:

- You are legally entitled to grant the above licenses.
- Each Contribution is Your original creation or You have sufficient rights to submit it.
- You will notify the Project Steward if any representation becomes inaccurate.

## 4. No obligation

You are under no obligation to provide support for Your Contributions unless You agree separately in writing.

## 5. No employment

This agreement does not create an employment, agency, or partnership relationship.

## 6. Governance transfer

You acknowledge the Project Steward's goal of neutral, long-term governance (including possible transfer to RISC-V International or an affiliated foundation). Licenses granted here are intended to survive such transfer so the codebase remains usable under Apache-2.0.

## 7. How to accept

Sign this agreement by:

- Including in your first pull request: `I have read and agree to the Individual CLA at docs/CLA.md`, **or**
- Emailing the Project Steward a signed copy with your name, GitHub username, and date.

Until the Project enables automated CLA Assistant, maintainers may require the PR comment above before merge.

## 8. Questions

Contact the Project Steward using the channels listed in the public [Terms of Service](https://extensilica.com/legal/terms).
