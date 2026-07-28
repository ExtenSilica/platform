# xmac-port-picorv32-pcpi

Evidence that **XMAC** can be adapted to the PicoRV32 **PCPI** interface.

| Field | Value |
| ----- | ----- |
| Parent | `xmac` |
| Target | `picorv32-pcpi` |
| Pre-build | Adapter required (`rd` → `pcpi_rsd`) |
| RTL | `rtl/xsil_pcpi.v` (compiled from semantic IR) |
| Evidence | `evidence/differential.json` |

Stock PCPI only presents `rs1`/`rs2`. XMAC also reads `rd`, so the generated
module exposes `pcpi_rsd`. Differential tests use a bus-functional model that
supplies that port. Full-core RF tap is documented in the portability docs — not
claimed as `Verified on target` here.

## Run

```bash
sh tests/run.sh           # verify frozen evidence
XSIL_LIVE=1 sh tests/run.sh   # re-run Icarus differential if tools present
```
