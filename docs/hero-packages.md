# Hero packages — demo and smoke targets

Curated registry slugs used for **LinkedIn demos**, conference walkthroughs, and
**`store-backend/scripts/smoke-heroes.sh`**. If smoke fails before a post or
talk, do not claim `xsil run` works on packages you have not verified.

## Prerequisites

```bash
cargo install xsil   # or a release from github.com/ExtenSilica/xsil
```

Point the CLI at the registry (production by default):

```bash
export XSIL_REGISTRY=https://api.extensilica.com
# or: jq -n --arg r "$XSIL_REGISTRY" '{registry:$r,token:""}' > ~/.extensilica/config.json
```

## Tier 1 — Primary reference demo (`rvx-demo`)

| Field | Value |
|-------|--------|
| Slug | `rvx-demo` |
| Purpose | Full **RL ≥ 2** reference package (Spike/QEMU or honest demo mode) |
| Source | [ExtenSilica/xsil `examples/rvx-demo`](https://github.com/ExtenSilica/xsil/tree/main/examples/rvx-demo) |
| Publish once | `bash scripts/publish-rvx-demo.sh` (see [deploy-runbook.md](./deploy-runbook.md) §9) |

**Expected run (after publish):**

```bash
xsil run rvx-demo
# rvx-demo: Hello from RISC-V!
```

Smoke treats `rvx-demo` as **optional** until it is live on the registry. Set
`REQUIRE_PRIMARY=1` when running smoke after the first production publish.

## Tier 2 — Catalog heroes (always-on smoke)

Ratified **catalog-seed** scaffolds (`readinessLevel: 1`, `portStatus: seeded`).
`xsil run` exits 0 and prints a **demo-mode** banner when no Spike/QEMU is
installed — that is expected for marketing smoke, not a failed port.

| Slug | Why it is a hero |
|------|------------------|
| `riscv-zbkb` | First ratified row in [catalog-seed/catalog.md](./catalog-seed/catalog.md); crypto bit-manip; stable name for posts |
| `riscv-zvbb` | Vector crypto scaffold; shows vector extension line in the catalog |
| `riscv-zknh` | SHA-256/512 subset; recognizable crypto story |

**Demo commands (copy-paste):**

```bash
xsil info riscv-zbkb
xsil run  riscv-zbkb
```

Package pages: `https://extensilica.com/package/<slug>`

## What smoke checks

For each Tier 2 slug (and optionally Tier 1):

1. `GET /packages/<slug>` returns 200 on the registry API
2. `xsil info <slug>` exits 0
3. `xsil run <slug>` exits 0

Run from the repo root:

```bash
bash store-backend/scripts/smoke-heroes.sh
```

Environment:

| Variable | Default | Meaning |
|----------|---------|---------|
| `REGISTRY_URL` | `https://api.extensilica.com` | API base (no trailing slash) |
| `REQUIRE_PRIMARY` | unset | If `1`, fail when `rvx-demo` is missing |

## Homepage vs heroes

The marketing homepage still shows example commands with `rvv-demo` (historical
slug in copy). **Operational demos should use the slugs in this file** until
homepage copy is aligned.

## Updating heroes

- Add a slug here only after `xsil run` passes against production.
- Update `HERO_CATALOG_SLUGS` in `smoke-heroes.sh` in the same PR.
- Do not list seeded packages you have not smoke-tested — RL1 scaffolds can still
  fail if a version is yanked or the tarball is corrupt.
