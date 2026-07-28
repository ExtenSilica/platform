# xmac-port-neorv32-cfu

Evidence that **XMAC** can be adapted to the NEORV32 **CFU** interface.

| Field | Value |
| ----- | ----- |
| Parent | `xmac` |
| Target | `neorv32-cfu` |
| Pre-build | Adapter required (`rd` → `rsd_i`) |
| RTL | `rtl/xsil_cfu.vhd` (compiled from semantic IR) |
| Evidence | `evidence/differential.json` |

Stock CFU only presents `rs1_i`/`rs2_i`. Same adapter story as PCPI, different
HDL and handshake. Differential cases share seed `0xC0FFEE` with the PCPI port.

## Run

```bash
sh tests/run.sh
XSIL_LIVE=1 sh tests/run.sh   # re-run GHDL differential if tools present
```
