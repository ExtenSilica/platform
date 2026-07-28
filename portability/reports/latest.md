# ExtenSilica Portability PoC — Comparative Report

Generated: 20260727T220207Z
Seed: `0xc0ffee`
Random cases per instruction: 2000

> One extension description. Two independent RISC-V cores. Two different interfaces. The same results.

## Instructions (single source of truth)

| Instruction | Provenance | Semantics |
| ----------- | ---------- | --------- |
| XMAC | PoC demo | `rd = rd + rs1 × rs2` (mod 2³²) |
| XROLADD | PoC demo | `rd = rotate_left(rs1, rs2[4:0]) + rd` |
| CLZ | **RISC-V Zbb** (ratified) | `rd = clz(rs1)` |

CLZ is an external published ISA operation (not invented for this demo),
run through the same pipeline. Opcode remapped to custom-0 for PCPI/CFU delivery.

## Results

| Target | Interface | Notes | Post-test | Cases |
| ------ | --------- | ----- | --------- | ----- |
| Reference interpreter | golden model | — | Differentially validated | 8010 |
| PicoRV32 | PCPI (Verilog / Icarus) | XMAC/XROLADD: Adapter required; CLZ: Looks mappable | Differentially validated | 8010/8010 |
| NEORV32 | CFU (VHDL / GHDL) | same pre-build split | Differentially validated | 8010/8010 |

## Proof obligations met

- [x] Three instructions defined once (2 demo + 1 external Zbb CLZ)
- [x] Reference interpreter executes all
- [x] PicoRV32 PCPI passes shared differential tests
- [x] NEORV32 CFU passes the same tests (same seed)
- [x] Handshake assertions on both targets
- [x] Datapath compiled from IR in both backends

## Notes

XMAC/XROLADD need `rd` as a source → `Adapter required` (`pcpi_rsd` / `rsd_i`).
CLZ only reads `rs1` → `Looks mappable` on the native interface.
Post-test status is earned by simulation, never by capability flags alone.
