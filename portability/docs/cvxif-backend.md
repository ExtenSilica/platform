# CV-X-IF backend (MVP subset)

Experimental ExtenSilica portability backend for the OpenHW **Core-V eXtension
interface (CV-X-IF)**. This is the third hardware target after PicoRV32 PCPI and
NEORV32 CFU.

## What is implemented

| Piece | Status |
| ----- | ------ |
| Issue accept/reject + writeback flags | Yes |
| Register operands rs1/rs2 (SPLIT=0 style with BFM) | Yes |
| Commit before result (spec rule) | Yes |
| Result writeback to `rd` | Yes |
| IR → Verilog datapath | Yes (shared `verilog_expr`) |
| Adapter `register_rsd` for rd-as-source | Yes |
| Compressed interface | **No** |
| Memory / exceptions beyond reject | **No** |
| Full CVA6 SoC integration | **No** (BFM only) |

XLEN in this MVP is **32** only (target YAML lists `[32]`).

## Pre-build status

Same honesty as PCPI/CFU:

- XMAC / XROLADD → **Adapter required** (`rd` → `register_rsd`)
- CLZ → **Looks mappable** (rs1 only)

Never **Compatible** from flags.

## Run

```bash
cd portability
./bin/xsil-port check instructions/ --target cva6-cvxif
./bin/xsil-port port  instructions/ --target cva6-cvxif --out generated/cvxif
./bin/xsil-port test  instructions/ --target cva6-cvxif --random 500
```

## Files

```text
backends/cvxif/generate.py   # IR → xsil_cvxif.v
backends/cvxif/tb_xsil_cvxif.v
targets/cva6-cvxif.yaml
packages/xmac-port-cva6-cvxif/   # evidence package (sibling of PCPI/CFU ports)
```
