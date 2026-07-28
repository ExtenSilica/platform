# RoCC backend (MVP subset)

Experimental ExtenSilica portability backend for the Rocket **Custom Coprocessor
(RoCC)** interface. Fourth hardware target after PCPI, CFU, and CV-X-IF.

## What is implemented

| Piece | Status |
| ----- | ------ |
| Decoupled `cmd` accept + latch | Yes |
| Decoupled `resp` writeback | Yes |
| `busy` while in flight | Yes |
| IR → Verilog datapath | Yes |
| Adapter `cmd_rsd` for rd-as-source | Yes |
| HellaCache / TileLink memory | **No** |
| Persistent custom state / IRQ / PTW | **No** |
| Full Rocket tile integration | **No** (BFM only) |

XLEN in this MVP is **32** (matches the PoC instruction class). A production
Rocket tile is often RV64 — widening is future work.

## Pre-build status

- XMAC / XROLADD → **Adapter required** (`rd` → `cmd_rsd`)
- CLZ → **Looks mappable**

Never **Compatible** from flags.

## Run

```bash
cd portability
./bin/xsil-port check instructions/ --target rocket-rocc
./bin/xsil-port port  instructions/ --target rocket-rocc --out generated/rocc
./bin/xsil-port test  instructions/ --target rocket-rocc --random 500
```

## Files

```text
backends/rocc/generate.py
backends/rocc/tb_xsil_rocc.v
targets/rocket-rocc.yaml
packages/xmac-port-rocket-rocc/
```
