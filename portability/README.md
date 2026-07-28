# ExtenSilica Portability PoC

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

| Instruction | Semantics |
| ----------- | --------- |
| `XMAC` | `rd = rd + rs1 × rs2` (mod 2³²) |
| `XROLADD` | `rd = rotate_left(rs1, rs2[4:0]) + rd` (mod 2³²) |

A broader **corpus** under `corpus/` (saturation, selection, CLZ, signed max) loads against the same schema to keep the IR from collapsing into “whatever XMAC needs”. Those are **not** MVP targets.

## Layout

```text
portability/
├── instructions/          # MVP instructions (XMAC, XROLADD)
├── corpus/                # schema-fitness only
├── targets/               # capability models (pre-build status only)
├── xsil_sem/              # experimental engine
│   ├── schema.py
│   ├── expr.py
│   ├── interpreter.py
│   ├── diff_harness.py
│   ├── compat.py          # Candidate / Adapter required / …
│   └── verilog_expr.py    # IR → Verilog datapath
├── backends/pcpi/         # PicoRV32 PCPI generator + TB
├── third_party/           # picorv32 (ref) + oss-cad-suite (gitignored)
├── tools/fetch_sim.sh
├── run_phase1.py
├── run_phase2_pcpi.py
└── requirements.txt
```

The schema is marked **experimental**. It is **not** the frozen public `.xsil` format.

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

## Next (out of PoC scope)

CV-X-IF / RoCC, site repositioning, GitHub Action badge — only after this local proof stays green.
