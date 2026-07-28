"""Experimental XSIL semantic schema.

Describes a custom instruction independently of any core: encoding, operands,
the semantic expression that produces each output, architectural effects and
execution timing.

STATUS: experimental. This schema is intentionally NOT the frozen public `.xsil`
format. It is expected to churn until at least two independent hardware backends
(PicoRV32 PCPI and NEORV32 CFU) have validated that it carries enough — and not
too much — information to generate correct integrations.

MVP scope enforced by :func:`validate`:
  * xlen == 32
  * register operands only (no memory, no CSR, no persistent state, no special
    exceptions)
  * up to 3 input operands, exactly 1 output operand
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List

import yaml

from . import expr

XLEN_SUPPORTED = (32,)
MAX_INPUTS = 3
KNOWN_ROLES = {"rd", "rs1", "rs2", "rs3"}


class SchemaError(Exception):
    """Raised when an instruction description violates the schema or MVP scope."""


@dataclass
class Encoding:
    length: int
    mask: int
    match: int

    def matches(self, word: int) -> bool:
        return (word & self.mask) == self.match


@dataclass
class Effects:
    memory: str = "none"
    csr: str = "none"
    exceptions: str = "none"
    persistent_state: bool = False


@dataclass
class Execution:
    latency: str = "fixed"        # "fixed" | "variable"
    cycles: int = 1               # meaningful when latency == "fixed"
    may_stall: bool = False


@dataclass
class Instruction:
    name: str
    xlen: int
    encoding: Encoding
    inputs: List[str]
    outputs: List[str]
    semantics: Dict[str, Any]     # output operand name -> expression tree
    effects: Effects = field(default_factory=Effects)
    execution: Execution = field(default_factory=Execution)
    overflow: str = "wrap"
    description: str = ""

    @property
    def output(self) -> str:
        return self.outputs[0]

    @property
    def output_expr(self) -> Any:
        return self.semantics[self.output]


def _as_int(value: Any, ctx: str) -> int:
    """Accept ints or hex/dec strings (YAML often carries 0x.. as strings)."""
    if isinstance(value, bool):
        raise SchemaError(f"{ctx}: expected an integer, got a bool")
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        try:
            return int(value, 0)
        except ValueError as exc:
            raise SchemaError(f"{ctx}: cannot parse integer from {value!r}") from exc
    raise SchemaError(f"{ctx}: expected an integer, got {type(value).__name__}")


def load_instruction(path: str | Path) -> Instruction:
    path = Path(path)
    with path.open("r", encoding="utf-8") as fh:
        raw = yaml.safe_load(fh)
    if not isinstance(raw, dict):
        raise SchemaError(f"{path}: top-level document must be a mapping")
    instr = from_dict(raw)
    validate(instr)
    return instr


def from_dict(raw: Dict[str, Any]) -> Instruction:
    try:
        name = raw["instruction"]
        xlen = int(raw.get("xlen", 32))
        enc_raw = raw["encoding"]
        operands = raw["operands"]
        semantics = raw["semantics"]
    except KeyError as exc:
        raise SchemaError(f"missing required top-level field: {exc}") from exc

    encoding = Encoding(
        length=int(enc_raw.get("length", 32)),
        mask=_as_int(enc_raw["mask"], "encoding.mask"),
        match=_as_int(enc_raw.get("match", enc_raw.get("value")), "encoding.match"),
    )

    inputs = list(operands.get("inputs", []))
    outputs = list(operands.get("outputs", []))

    effects_raw = raw.get("effects", {}) or {}
    effects = Effects(
        memory=str(effects_raw.get("memory", "none")),
        csr=str(effects_raw.get("csr", "none")),
        exceptions=str(effects_raw.get("exceptions", "none")),
        persistent_state=bool(effects_raw.get("persistent_state", False)),
    )

    exec_raw = raw.get("execution", {}) or {}
    execution = Execution(
        latency=str(exec_raw.get("latency", "fixed")),
        cycles=int(exec_raw.get("cycles", 1)),
        may_stall=bool(exec_raw.get("may_stall", False)),
    )

    # Normalize semantics into {output_name: expression}. Allow the common
    # single-output shorthand `semantics: {expression: <tree>}`.
    if "expression" in semantics and len(outputs) == 1:
        norm_semantics = {outputs[0]: semantics["expression"]}
    else:
        norm_semantics = dict(semantics)

    return Instruction(
        name=str(name),
        xlen=xlen,
        encoding=encoding,
        inputs=inputs,
        outputs=outputs,
        semantics=norm_semantics,
        effects=effects,
        execution=execution,
        overflow=str(raw.get("overflow", "wrap")),
        description=str(raw.get("description", "")),
    )


def validate(instr: Instruction) -> None:
    """Enforce the schema invariants and the MVP capability scope."""
    if instr.xlen not in XLEN_SUPPORTED:
        raise SchemaError(
            f"{instr.name}: xlen={instr.xlen} not supported by MVP (only {XLEN_SUPPORTED})"
        )

    if not instr.inputs:
        raise SchemaError(f"{instr.name}: at least one input operand is required")
    if len(instr.inputs) > MAX_INPUTS:
        raise SchemaError(
            f"{instr.name}: {len(instr.inputs)} inputs exceeds MVP maximum of {MAX_INPUTS}"
        )
    if len(instr.outputs) != 1:
        raise SchemaError(
            f"{instr.name}: MVP requires exactly 1 output operand, got {len(instr.outputs)}"
        )

    for role in instr.inputs + instr.outputs:
        if role not in KNOWN_ROLES:
            raise SchemaError(
                f"{instr.name}: unknown operand role {role!r} (known: {sorted(KNOWN_ROLES)})"
            )

    # MVP scope: pure register-to-register function only.
    if instr.effects.memory != "none":
        raise SchemaError(f"{instr.name}: memory access is out of MVP scope")
    if instr.effects.csr != "none":
        raise SchemaError(f"{instr.name}: CSR access is out of MVP scope")
    if instr.effects.exceptions != "none":
        raise SchemaError(f"{instr.name}: special exceptions are out of MVP scope")
    if instr.effects.persistent_state:
        raise SchemaError(f"{instr.name}: persistent custom state is out of MVP scope")

    if instr.execution.latency not in ("fixed", "variable"):
        raise SchemaError(
            f"{instr.name}: execution.latency must be 'fixed' or 'variable'"
        )

    # Semantics must define exactly the declared output and only read declared inputs.
    if set(instr.semantics) != set(instr.outputs):
        raise SchemaError(
            f"{instr.name}: semantics keys {sorted(instr.semantics)} "
            f"must match outputs {sorted(instr.outputs)}"
        )

    declared = set(instr.inputs)
    for out_name, tree in instr.semantics.items():
        used = expr.referenced_operands(tree)
        unknown = used - declared
        if unknown:
            raise SchemaError(
                f"{instr.name}: semantics for {out_name!r} reads undeclared operand(s) "
                f"{sorted(unknown)}; declared inputs are {sorted(declared)}"
            )
