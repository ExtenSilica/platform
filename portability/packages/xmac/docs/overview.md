# Overview

XMAC is the hero instruction of the ExtenSilica portability PoC:

```text
rd ← rd + rs1 × rs2   (wrap at 2³²)
```

Encoding uses RISC-V `custom-0` (opcode `0x0b`) with a dedicated funct7/funct3
match — see `instructions/xmac.yaml`.

## What this package proves

1. One core-independent semantic description.
2. A golden reference model (self-check in `tests/run.sh`).
3. Links to independently generated PCPI and CFU adapters that pass the same
   differential vectors.

It does **not** claim drop-in integration into an unmodified PicoRV32/NEORV32
without the documented `rd` RF tap.
