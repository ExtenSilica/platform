# xmac-port-rocket-rocc

Evidence that **XMAC** can be adapted to the Rocket **RoCC** interface
(MVP subset used by ExtenSilica’s portability PoC).

| Field | Value |
| ----- | ----- |
| Parent | `xmac` |
| Target | `rocket-rocc` |
| Pre-build | Adapter required (`rd` → `cmd_rsd`) |
| RTL | `rtl/xsil_rocc.v` (compiled from semantic IR) |
| Evidence | `evidence/differential.json` |

Stock RoCC presents `rs1`/`rs2` values on the command channel. XMAC also reads
`rd`, so the generated module exposes `cmd_rsd`. Differential tests drive a BFM
through cmd → busy → resp. This is **not** a full Rocket tile and does not
claim `Verified on target`.

MVP limits: RV32 datapath, no HellaCache/TileLink, no persistent custom state.
See `portability/docs/rocc-backend.md`.

## Run

```bash
sh tests/run.sh
XSIL_LIVE=1 sh tests/run.sh
```
