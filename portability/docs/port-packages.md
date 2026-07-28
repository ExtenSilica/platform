# Port packages (step 6)

Local, publishable **evidence** packages for the XMAC portability proof.
They are not empty catalog rows.

## Packages

| Slug | Kind | Contents |
| ---- | ---- | -------- |
| `xmac` | extension | semantic YAML + golden check + matrix stub |
| `xmac-port-picorv32-pcpi` | port | generated PCPI Verilog + differential evidence |
| `xmac-port-neorv32-cfu` | port | generated CFU VHDL + differential evidence |
| `xmac-port-cva6-cvxif` | port | generated CV-X-IF MVP Verilog + differential evidence |
| `xmac-port-rocket-rocc` | port | generated RoCC MVP Verilog + differential evidence |

Layout:

```text
portability/packages/
├── xmac/
├── xmac-port-picorv32-pcpi/
├── xmac-port-neorv32-cfu/
├── xmac-port-cva6-cvxif/
├── xmac-port-rocket-rocc/
└── dist/                    # *.xsil archives (gitignored)
```

## Build (regenerate RTL + evidence + pack)

From `portability/`:

```bash
# needs tools/fetch_sim.sh once
python3 tools/build_port_packages.py --random 500
```

Dev-only (no Icarus/GHDL):

```bash
python3 tools/build_port_packages.py --skip-sim
```

`--skip-sim` writes `SKIPPED` evidence and must **not** be published.

## Verify locally

```bash
sh packages/xmac/tests/run.sh
sh packages/xmac-port-picorv32-pcpi/tests/run.sh
sh packages/xmac-port-neorv32-cfu/tests/run.sh
sh packages/xmac-port-cva6-cvxif/tests/run.sh
sh packages/xmac-port-rocket-rocc/tests/run.sh

# optional live re-sim
XSIL_LIVE=1 sh packages/xmac-port-picorv32-pcpi/tests/run.sh
```

## Registry publish (authorized only)

Packaging ≠ publishing. When ready and authorized:

```bash
xsil publish packages/xmac
xsil publish packages/xmac-port-picorv32-pcpi
xsil publish packages/xmac-port-neorv32-cfu
xsil publish packages/xmac-port-cva6-cvxif
xsil publish packages/xmac-port-rocket-rocc
```

Manifest `metadata.portability` carries the fields the package page (step 7)
will use for the matrix — without ever emitting **Compatible** from flags.

The live matrix is driven by structured fields on `manifest.targets`
(`preBuild`, `adapter`, `build`, `tests`, `postTest`, `portPackage`). See
[`portability-matrix-ui.md`](portability-matrix-ui.md).
