# xmac

Portable description of the **XMAC** custom instruction:

```text
rd = rd + rs1 × rs2   (mod 2³²)
```

This package is **evidence**, not a catalog placeholder. It ships the
experimental semantic YAML and a self-contained golden-model check. Hardware
ports live in sibling packages:

| Target | Package | Pre-build | Post-test |
| ------ | ------- | --------- | --------- |
| Reference interpreter | *(this package)* | Looks mappable | Differentially validated |
| PicoRV32 PCPI | `xmac-port-picorv32-pcpi` | Adapter required | Differentially validated |
| NEORV32 CFU | `xmac-port-neorv32-cfu` | Adapter required | Differentially validated |
| CVA6 / CV-X-IF (MVP) | `xmac-port-cva6-cvxif` | Adapter required | Differentially validated |
| Rocket / RoCC (MVP) | `xmac-port-rocket-rocc` | Adapter required | Differentially validated |

Status vocabulary never uses **Compatible** from capability flags alone.
Post-test status is earned by shared differential tests.

## Run

```bash
sh tests/run.sh
```

## Source of truth

`instructions/xmac.yaml` — experimental ExtenSilica semantic IR (not the frozen
public `.xsil` schema).

Built from the offline PoC under `portability/` (`xsil-port check|port|test`).
