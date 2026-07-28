# ExtenSilica Portability PoC — Comparative Report

Generated: 20260727T214239Z
Seed: `0xc0ffee`
Random cases per instruction: 2000

> One extension description. Two independent RISC-V cores. Two different interfaces. The same results.

## Instructions (single source of truth)

| Instruction | Semantics |
| ----------- | --------- |
| XMAC | `rd = rd + rs1 × rs2` (mod 2³²) |
| XROLADD | `rd = rotate_left(rs1, rs2[4:0]) + rd` (mod 2³²) |

Described once under `instructions/*.yaml`. No backend reimplements the arithmetic.

## Results

| Target | Interface | Pre-build | Post-test | Cases |
| ------ | --------- | --------- | --------- | ----- |
| Reference interpreter | golden model | — | Differentially validated | 6000 |
| PicoRV32 | PCPI (Verilog / Icarus) | Adapter required (`pcpi_rsd`) | Differentially Validated | 6000/6000 |
| NEORV32 | CFU (VHDL / GHDL) | Adapter required (`rsd_i`) | Differentially Validated | 6000/6000 |

## Proof obligations met

- [x] XMAC and XROLADD defined once
- [x] Reference interpreter executes both
- [x] PicoRV32 PCPI passes shared differential tests
- [x] NEORV32 CFU passes the same tests (same seed)
- [x] Handshake assertions on both targets
- [x] Datapath compiled from IR in both backends

## Notes

Both hardware interfaces natively supply only `rs1`/`rs2` values. Because
XMAC/XROLADD also read `rd`, each backend exposes an adapter port
(`pcpi_rsd` / `rsd_i`). Pre-build status is therefore **Adapter required**,
never a fake Compatible. Post-test status is earned by simulation.
