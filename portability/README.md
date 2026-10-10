# ExtenSilica Portability PoC

[![Portability — pytest](https://github.com/ExtenSilica/platform/actions/workflows/ci.yml/badge.svg)](https://github.com/ExtenSilica/platform/actions/workflows/ci.yml)

> One extension description. Two independent RISC-V cores. Two different interfaces. The same results.

This directory holds the **local, offline** proof that a custom RISC-V instruction can be described once, executed by a golden model, and later integrated into multiple cores with shared differential tests.

**Public positioning of ExtenSilica is intentionally unchanged.** This is the engine; the website comes after the proof works.

## Status

| Phase | Deliverable | Status |
| ----- | ----------- | ------ |
| 1 | Experimental semantic schema + reference interpreter + differential harness | **Passed** |
| 2 | PicoRV32 PCPI backend | **Passed** (6000/6000 + protocol assertions) |
| 3 | NEORV32 CFU backend | **Passed** (6000/6000 + protocol assertions, same seed) |
| 4 | Reproducible comparative report | **Passed** — see `reports/latest.md` |

## MVP instruction class

Only:

- RV32
- register operands
- no memory / CSR / persistent state / special exceptions
- ≤ 3 inputs, exactly 1 output

First instructions (single source of truth under `instructions/`):

| Instruction | Provenance | Semantics |
| ----------- | ---------- | --------- |
| `XMAC` | PoC demo | `rd = rd + rs1 × rs2` (mod 2³²) |
| `XROLADD` | PoC demo | `rd = rotate_left(rs1, rs2[4:0]) + rd` (mod 2³²) |
| `CLZ` | **RISC-V Zbb** (ratified) | `rd = clz(rs1)` |

CLZ is an external published ISA operation run through the same pipeline (opcode remapped to custom-0 for PCPI/CFU delivery). Two demo instructions prove the framework is reusable; the third kills “you only hardcoded your own ops.”

A broader **corpus** under `corpus/` (saturation, selection, CLZ, signed max) loads against the same schema to keep the IR from collapsing into “whatever XMAC needs”. Those are **not** MVP targets.

## Layout

```text
portability/
├── instructions/          # MVP instructions (XMAC, XROLADD)
├── corpus/                # schema-fitness only
├── targets/               # capability models (schema_version 1)
├── docs/
│   ├── rd-adapter.md
│   └── target-capability-model.md
├── xsil_sem/              # experimental engine
│   ├── schema.py
│   ├── expr.py
│   ├── interpreter.py
│   ├── diff_harness.py
│   ├── target_schema.py   # Target YAML validation
│   ├── compat.py          # Candidate / Adapter required / …
│   ├── cli.py
│   └── verilog_expr.py    # IR → Verilog datapath
├── backends/pcpi/         # PicoRV32 PCPI generator + TB
├── backends/cfu/          # NEORV32 CFU generator + TB
├── backends/cvxif/        # CV-X-IF MVP generator + TB
├── backends/rocc/         # Rocket RoCC MVP generator + TB
├── third_party/           # picorv32 (ref) + oss-cad-suite (gitignored)
├── tools/fetch_sim.sh
├── tools/fetch_cores.sh
├── bin/xsil-port          # offline CLI (analyze/check/port/test/targets)
├── packages/              # xmac + port evidence packages (step 6)
├── run_phase1.py
├── run_phase2_pcpi.py
└── requirements.txt
```

The schema is marked **experimental**. It is **not** the frozen public `.xsil` format.

Target maturity (`working` / `candidate` / `not_assessed`) is separate from
pre-build instruction assessment. See [`docs/target-capability-model.md`](docs/target-capability-model.md).

## Honest PCPI / CFU status

Pre-build for XMAC / XROLADD × PicoRV32 PCPI and NEORV32 CFU:

```text
Adapter required
```

Reason: both interfaces forward only `rs1`/`rs2` values. Both instructions also read `rd`. Generated modules expose `pcpi_rsd` / `rsd_i`. See [`docs/rd-adapter.md`](docs/rd-adapter.md).

Post-test (after simulation of the generated RTL):

```text
Differentially validated
```

## Status vocabulary (enforced by process, not marketing)

Before build/test:

```text
Not assessed | Candidate | Looks mappable | Adapter required | Unsupported capability
```

After real execution:

```text
Built | Tested | Differentially validated | Verified on target
```

Never call something `Compatible` just because capability flags look similar.

## Offline CLI (`xsil-port`)

The Rust `xsil` CLI still owns registry install/run. The **portability engine** is
exposed offline as `xsil-port` (experimental) — same verbs the product brief uses:

```bash
cd portability
chmod +x bin/xsil-port   # once

./bin/xsil-port targets
./bin/xsil-port analyze instructions/
./bin/xsil-port check   instructions/ --target picorv32-pcpi
./bin/xsil-port check   instructions/clz.yaml --target neorv32-cfu
./bin/xsil-port check   instructions/ --target cva6-cvxif
./bin/xsil-port test    instructions/ --target cva6-cvxif --random 500
./bin/xsil-port check   instructions/ --target rocket-rocc
./bin/xsil-port test    instructions/ --target rocket-rocc --random 500
./bin/xsil-port port    instructions/ --target picorv32-pcpi --out generated/pcpi
./bin/xsil-port port    instructions/ --target neorv32-cfu   --out generated/cfu
./bin/xsil-port test    instructions/ --target reference --random 200
./bin/xsil-port test    instructions/ --target picorv32-pcpi --random 500
./bin/xsil-port test    instructions/ --target neorv32-cfu   --random 500
```

Or: `python3 -m xsil_sem.cli …` from `portability/`.

`check` never prints Compatible from flags. `test` is what earns
`Differentially validated`. CV-X-IF MVP: [`docs/cvxif-backend.md`](docs/cvxif-backend.md).
RoCC MVP: [`docs/rocc-backend.md`](docs/rocc-backend.md).

## Run Phase 1


```bash
cd portability
python3 -m pip install -r requirements.txt   # or use .venv
python3 run_phase1.py
python3 -m pytest tests/ -q
```

## Run Phase 2 (PCPI)

```bash
cd portability
bash tools/fetch_sim.sh          # once — portable Icarus Verilog
python3 run_phase2_pcpi.py       # default: 2000 random + edges per insn
python3 run_phase2_pcpi.py --random 5000
```

Expected outcome:

- Pre-build: `Adapter required` (rd-as-source)
- Generated `backends/pcpi/build/xsil_pcpi.v` (datapath from IR)
- TB asserts: wait/ready/wr coincidence, no duplicate ready, silent on unrecognized, idle after reset
- `TB_STATUS DIFFERENTIALLY_VALIDATED` with thousands of cases

## Run Phase 3 (CFU)

```bash
cd portability
bash tools/fetch_sim.sh          # includes GHDL
python3 run_phase3_cfu.py        # same seed 0xC0FFEE as PCPI
```

## Run Phase 4 (comparative report)

```bash
python3 run_phase4_report.py
# → reports/latest.md
```

## Success criterion for the full PoC

The PoC is done when XMAC and XROLADD, described once:

1. run on the reference interpreter;                    ← done
2. pass differential tests on PicoRV32/PCPI;            ← done
3. pass the **same** cases on NEORV32/CFU;              ← done
4. have handshake assertions on both targets;           ← done
5. and **no backend reimplements the instruction semantics by hand**.  ← done

## Port packages (evidence)

Local packages ready to publish as proof, not empty catalog rows:

| Package | Role |
| ------- | ---- |
| `packages/xmac` | extension description + golden check |
| `packages/xmac-port-picorv32-pcpi` | PCPI adapter + differential evidence |
| `packages/xmac-port-neorv32-cfu` | CFU adapter + differential evidence |
| `packages/xmac-port-cva6-cvxif` | CV-X-IF MVP adapter + differential evidence |
| `packages/xmac-port-rocket-rocc` | RoCC MVP adapter + differential evidence |

```bash
python3 tools/build_port_packages.py --random 500
sh packages/xmac/tests/run.sh
sh packages/xmac-port-picorv32-pcpi/tests/run.sh
sh packages/xmac-port-neorv32-cfu/tests/run.sh
sh packages/xmac-port-cva6-cvxif/tests/run.sh
sh packages/xmac-port-rocket-rocc/tests/run.sh
```

Details: [`docs/port-packages.md`](docs/port-packages.md). Registry upload is a
separate authorized step (`xsil publish …`).

## Registry

Published (v1.0.0):

| Package | Page |
| ------- | ---- |
| `xmac` | https://extensilica.com/package/xmac |
| `xmac-port-picorv32-pcpi` | https://extensilica.com/package/xmac-port-picorv32-pcpi |
| `xmac-port-neorv32-cfu` | https://extensilica.com/package/xmac-port-neorv32-cfu |
| `xmac-port-cva6-cvxif` | https://extensilica.com/package/xmac-port-cva6-cvxif |
| `xmac-port-rocket-rocc` | https://extensilica.com/package/xmac-port-rocket-rocc |

```bash
xsil install xmac
xsil install xmac-port-rocket-rocc
```

