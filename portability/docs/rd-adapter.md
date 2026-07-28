# PicoRV32 / NEORV32 RF tap for rd-as-source

XMAC and XROLADD read the current value of `rd` as well as `rs1`/`rs2`.

Stock interfaces do **not** forward that value:

| Target | Native operand values | Missing |
| ------ | --------------------- | ------- |
| PicoRV32 PCPI | `pcpi_rs1`, `pcpi_rs2` | current `rd` |
| NEORV32 CFU | `rs1_i`, `rs2_i` | current `rd` |

The generated adapters therefore expose an extra port:

| Backend | Adapter port | Meaning |
| ------- | ------------ | ------- |
| PCPI | `pcpi_rsd` | value of the destination register before the write |
| CFU | `rsd_i` | same |

## What the PoC already proves

The differential testbenches drive a **bus-functional model** that supplies
`pcpi_rsd` / `rsd_i`. That validates:

- IR → datapath compilation
- handshake (wait/ready or start/valid)
- bit-exact agreement with the golden model

It does **not** yet prove a drop-in on an unmodified upstream CPU.

## Full-core integration (minimal RF tap)

### PicoRV32

When `pcpi_valid` is high, also present the register file value selected by the
instruction's `rd` field on `pcpi_rsd`:

```verilog
// Conceptual — wire into the generated xsil_pcpi instance:
wire [31:0] pcpi_rsd = cpuregs[mem_rdata_q[11:7]]; // rd field
```

Exact signal names depend on the PicoRV32 configuration and where the PCPI
coprocessor is instantiated; the contract is: **same cycle as `pcpi_rs1`/`pcpi_rs2`,
value of `rd` before the writeback of this instruction**.

### NEORV32

When the CFU is triggered (`start_i`), also present the destination register
value on `rsd_i`. The clean integration point is the ALU CFU proxy that already
forwards `rs1`/`rs2` — add a parallel read of `rd` from the register file.

Upstream `neorv32_cpu_alu_cfu` does not have this port; our generated entity
adds it. A full-core port therefore either:

1. patches the CFU request record to include `rsd`, or
2. keeps a thin wrapper outside the stock entity.

## Pre-build vs post-test status

| Stage | Status |
| ----- | ------ |
| Capability flags only | `Adapter required` |
| After BFM differential sim | `Differentially validated` |
| After RF tap + full-core sim | `Verified on target` (not claimed yet) |

Never call this `Compatible` from flags alone.
