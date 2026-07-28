# Target capability model (schema_version 1)

Experimental. Describes what a **core interface** can supply, so the
compatibility engine can compare it to what an instruction needs — without
claiming the port works.

Post-test statuses (`Differentially validated`, `Verified on target`) are
**never** produced here. Those come only from `xsil-port test` / simulation.

## File location

```text
portability/targets/<id>.yaml
```

Loaded and validated by `xsil_sem.target_schema` (`schema_version: 1`).

## Target maturity (`status`)

| Value | Meaning |
| ----- | ------- |
| `working` | Adapter backend exists and has passed differential tests for the MVP class |
| `candidate` | Flags filled in; backend incomplete or unproven |
| `not_assessed` | Placeholder for the portability matrix; `assess()` returns **Not assessed** |

## Pre-build assessment vocabulary

Returned by `xsil-port check` / `compat.assess`:

| Status | Meaning |
| ------ | ------- |
| `Not assessed` | Target has `status: not_assessed` |
| `Candidate` | Target is `candidate` and flags look plausible |
| `Looks mappable` | All required operands available natively |
| `Adapter required` | Mappable only with documented adapter ports (e.g. `rd` → `pcpi_rsd`) |
| `Unsupported capability` | Missing xlen / memory / state / stall / operands |

**Never** `Compatible`.

## Stable fields

```yaml
schema_version: 1          # required semantics; must be 1
target: <id>               # unique slug
description: <string>
status: working | candidate | not_assessed

architecture:
  xlen: [<int>, ...]       # e.g. [32] or [32, 64]

interface:
  name: <string>           # pcpi | cfu | cvxif | rocc | reference | …
  operands:
    inputs_native: [...]   # values the stock interface presents
    inputs_adapter: [...]  # values only via adapter / RF tap
    outputs: [...]
  variable_latency: bool
  stall: bool
  ready: bool
  memory_access: bool
  exceptions: none | limited | full
  custom_state: bool
  max_ack_cycles_without_wait: <int> | null
  start_is_pulse: bool     # e.g. NEORV32 CFU start_i

implementation:
  language: verilog | vhdl | none
  adapter_backend: <string> | null   # required if status=working
  reference_core: <string> | null
  entity: <string> | null            # optional HDL entity name

adapter_notes: |                     # optional free text
  ...
```

Operand roles allowed today: `rd`, `rs1`, `rs2`, `rs3`.

## Current registry

| Target | status | Backend |
| ------ | ------ | ------- |
| `reference` | working | golden interpreter |
| `picorv32-pcpi` | working | Verilog / Icarus |
| `neorv32-cfu` | working | VHDL / GHDL |
| `cva6-cvxif` | working | Verilog / Icarus (CV-X-IF MVP) |
| `rocket-rocc` | working | Verilog / Icarus (RoCC MVP) |

List at runtime:

```bash
./bin/xsil-port targets
```
