"""Minimal pre-build compatibility check (capability flags only).

Produces Candidate / Looks mappable / Adapter required / Unsupported capability /
Not assessed. Never emits Compatible or any post-test status.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Union

from .schema import Instruction
from .target_schema import Target, TargetSchemaError, load_target_doc

TargetLike = Union[Target, Dict[str, Any]]


@dataclass
class CompatResult:
    instruction: str
    target: str
    status: str
    reasons: List[str]

    def format(self) -> str:
        lines = [f"{self.instruction} × {self.target}: {self.status}"]
        for r in self.reasons:
            lines.append(f"  - {r}")
        return "\n".join(lines)


def load_target(path: str | Path) -> Dict[str, Any]:
    """Load and validate a target YAML; return the legacy dict shape."""
    return load_target_doc(path).to_dict()


def _as_target(target: TargetLike) -> Target:
    if isinstance(target, Target):
        return target
    from .target_schema import from_dict

    return from_dict(target)


def assess(instr: Instruction, target: TargetLike) -> CompatResult:
    t = _as_target(target)
    iface = t.interface
    name = t.id

    # Target itself has not been exercised by a backend yet.
    if t.status == "not_assessed":
        return CompatResult(
            instr.name,
            name,
            "Not assessed",
            [
                "target capability flags are recorded but no adapter backend "
                "has been validated yet",
                f"interface={iface.name} native_inputs={iface.operands.inputs_native}",
            ],
        )

    if instr.xlen not in t.xlen:
        return CompatResult(
            instr.name,
            name,
            "Unsupported capability",
            [f"instruction xlen={instr.xlen} not in target {t.xlen}"],
        )

    if instr.effects.memory != "none" and not iface.memory_access:
        return CompatResult(
            instr.name,
            name,
            "Unsupported capability",
            ["instruction requires memory access; target does not provide it"],
        )

    if instr.effects.persistent_state and not iface.custom_state:
        return CompatResult(
            instr.name,
            name,
            "Unsupported capability",
            ["instruction requires persistent custom state; target does not"],
        )

    if instr.effects.csr != "none":
        return CompatResult(
            instr.name,
            name,
            "Unsupported capability",
            ["instruction requires CSR access; target capability model has no CSR path"],
        )

    native = set(iface.operands.inputs_native)
    adapter = set(iface.operands.inputs_adapter)
    needed = set(instr.inputs)

    missing = needed - native - adapter
    if missing:
        return CompatResult(
            instr.name,
            name,
            "Unsupported capability",
            [f"no path to supply operand(s) {sorted(missing)}"],
        )

    reasons: List[str] = []
    if t.status == "candidate":
        reasons.append("target backend is a candidate (not yet marked working)")

    needs_adapter = bool(needed & adapter)
    if needs_adapter:
        reasons.append(
            f"operands {sorted(needed & adapter)} require an adapter port "
            f"(native interface only supplies {sorted(native)})"
        )
        if instr.execution.may_stall and iface.stall:
            reasons.append("variable latency / stall supported by target handshake")
        status = "Candidate" if t.status == "candidate" else "Adapter required"
        return CompatResult(instr.name, name, status, reasons)

    reasons.append("all operands available on the native interface")
    if instr.execution.may_stall and not iface.stall:
        return CompatResult(
            instr.name,
            name,
            "Unsupported capability",
            ["instruction may stall; target has no stall/wait signal"],
        )

    if t.status == "candidate":
        return CompatResult(instr.name, name, "Candidate", reasons)
    return CompatResult(instr.name, name, "Looks mappable", reasons)


__all__ = [
    "CompatResult",
    "assess",
    "load_target",
    "TargetSchemaError",
]
