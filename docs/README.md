# ExtenSilica documentation

**Start here:** **[platform-features.md](./platform-features.md)** — complete feature reference for the **website**, **registry API**, and **`xsil` CLI**.

## Product

| Document | Description |
|----------|-------------|
| [platform-features.md](./platform-features.md) | **Canonical** feature list (web + CLI + API summary) |
| [REPOS_AND_PUBLIC_XSIL.md](./REPOS_AND_PUBLIC_XSIL.md) | Private platform repo vs public `ExtenSilica/xsil` |
| [extensilica-architecture-v3.md](./extensilica-architecture-v3.md) | End-to-end architecture and flows |
| [pre-silicon-bridge.md](./pre-silicon-bridge.md) | Product positioning (RL scale overview) |
| [pre-silicon-bridge-readiness.md](./pre-silicon-bridge-readiness.md) | Readiness levels RL1–5 (full reference) |
| [execution-model.md](./execution-model.md) | How `xsil run` picks simulator vs FPGA |
| [reproducibility.md](./reproducibility.md) | Why XSIL + reproducible runs matter |
| [implementation-plan-rvi-2026.md](./implementation-plan-rvi-2026.md) | 2026 roadmap (coordination, governance; no payments) |

## Registry API & backend

| Document | Description |
|----------|-------------|
| [api-v3.md](./api-v3.md) | REST API reference |
| [auth-v3.md](./auth-v3.md) | Tokens, sessions |
| [backend-v3.md](./backend-v3.md) | Service layout |
| [data-model-v3.md](./data-model-v3.md) | Prisma schema |
| [publishing-flow-v3.md](./publishing-flow-v3.md) | Publish HTTP flow |
| [versioning-v3.md](./versioning-v3.md) | Semver, yank, `latest` |
| [analytics-v3.md](./analytics-v3.md) | Download tracking |
| [reviews-v3.md](./reviews-v3.md) | Package reviews |
| [name-policy-v3.md](./name-policy-v3.md) | Naming and squatting |

## CLI & publishing

| Document | Description |
|----------|-------------|
| [cli-v3.md](./cli-v3.md) | Pointer to CLI reference (canonical copy in public `xsil` repo) |
| [developer-publishing.md](./developer-publishing.md) | Human publisher guide |
| [hero-packages.md](./hero-packages.md) | Production demo slugs + smoke script |
| [agent-publish-extension.md](./agent-publish-extension.md) | Agent playbook (RL≥2) |
| [catalog-seed/catalog.md](./catalog-seed/catalog.md) | Extension catalog seed (102 rows) |
| [catalog-seed/agent-prompt.md](./catalog-seed/agent-prompt.md) | RL1 catalog-seed agent |

## OAuth (website)

| Document | Description |
|----------|-------------|
| [oauth-v1.md](./oauth-v1.md) | OAuth design index |
| [oauth-config.md](./oauth-config.md) | Environment variables |
| [github-oauth-flow.md](./github-oauth-flow.md), [google-oauth-flow.md](./google-oauth-flow.md) | Provider flows |
| [frontend-oauth-ui.md](./frontend-oauth-ui.md), [frontend-auth-callback.md](./frontend-auth-callback.md) | UI integration |
| [cli-auth-v2.md](./cli-auth-v2.md) | CLI stays on API tokens |
| [oauth-launch-checklist.md](./oauth-launch-checklist.md) | OAuth pre-launch checks |

## Operations & legal

| Document | Description |
|----------|-------------|
| [deploy-runbook.md](./deploy-runbook.md) | Production deployment |
| [launch-checklist-v3.md](./launch-checklist-v3.md) | Launch readiness |
| [CLA.md](./CLA.md) | Contributor license (platform PRs only) |
| [security-model.md](./security-model.md) | Integrity model |
| [bitstream-distribution.md](./bitstream-distribution.md) | FPGA responsibilities |
| [zenodo-doi.md](./zenodo-doi.md), [zenodo-automation.md](./zenodo-automation.md) | DOI workflows |
| [cleanup-v3.md](./cleanup-v3.md) | v3 removal audit |

## Other

| Document | Description |
|----------|-------------|
| [Architectural Fidelity Risk in RISC-V Emulation.md](./Architectural%20Fidelity%20Risk%20in%20RISC-V%20Emulation.md) | Technical whitepaper |
| [history/](./history/) | Superseded pivot/architecture docs |
