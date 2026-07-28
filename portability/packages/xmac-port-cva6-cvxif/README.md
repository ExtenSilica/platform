# xmac-port-cva6-cvxif

Evidence that **XMAC** can be adapted to the OpenHW **CV-X-IF** interface
(MVP subset used by ExtenSilica’s portability PoC).

| Field | Value |
| ----- | ----- |
| Parent | `xmac` |
| Target | `cva6-cvxif` |
| Pre-build | Adapter required (`rd` → `register_rsd`) |
| RTL | `rtl/xsil_cvxif.v` (compiled from semantic IR) |
| Evidence | `evidence/differential.json` |

Stock CV-X-IF presents `rs1`/`rs2` on the register interface. XMAC also reads
`rd`, so the generated module exposes `register_rsd`. Differential tests drive a
BFM through issue → register → commit → result. This is **not** a full CVA6 SoC
integration and does not claim `Verified on target`.

MVP limits (honest): RV32 only, no compressed interface. See
`portability/docs/cvxif-backend.md`.

## Run

```bash
sh tests/run.sh
XSIL_LIVE=1 sh tests/run.sh   # re-run Icarus differential if tools present
```
