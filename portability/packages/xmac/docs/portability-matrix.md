# Portability matrix (XMAC)

Frozen snapshot for package pages. Pre-build ≠ post-test.

| Target | Pre-build | Adapter | Build | Tests | Port package |
| ------ | --------- | ------- | ----- | ----- | ------------ |
| reference | Looks mappable | Native | — | see `evidence/reference.json` | — |
| picorv32-pcpi | Adapter required | Generated (`pcpi_rsd`) | Passed | see port evidence | `xmac-port-picorv32-pcpi` |
| neorv32-cfu | Adapter required | Generated (`rsd_i`) | Passed | see port evidence | `xmac-port-neorv32-cfu` |
| cva6-cvxif | Adapter required | Generated (`register_rsd`) | Passed | see port evidence | `xmac-port-cva6-cvxif` |
| rocket-rocc | Adapter required | Generated (`cmd_rsd`) | Passed | see port evidence | `xmac-port-rocket-rocc` |

Never label a row **Compatible** from flags alone.

Structured fields live on `manifest.targets`. Counts are refreshed by
`tools/build_port_packages.py`. CV-X-IF and RoCC are MVP subsets — see
`portability/docs/cvxif-backend.md` and `portability/docs/rocc-backend.md`.
