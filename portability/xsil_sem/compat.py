"""Minimal pre-build compatibility check (capability flags only).

Produces Candidate / Looks mappable / Adapter required / Unsupported capability.
Never emits a post-test status such as Compatible or Differentially validated.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List

import yaml

from .schema import Instruction


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
    with Path(path).open("r", encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def assess(instr: Instruction, target: Dict[str, Any]) -> CompatResult:
    reasons: List[str] = []
    iface = target.get("interface", {})
    arch = target.get("architecture", {})

    if instr.xlen not in arch.get("xlen", []):
        return CompatResult(
            instr.name, target.get("target", "?"),
            "Unsupported capability",
            [f"instruction xlen={instr.xlen} not in target {arch.get('xlen')}"],
        )

    if instr.effects.memory != "none" and not iface.get("memory_access", False):
        return CompatResult(
            instr.name, target.get("target", "?"),
            "Unsupported capability",
            ["instruction requires memory access; target does not provide it"],
        )

    if instr.effects.persistent_state and not iface.get("custom_state", False):
        return CompatResult(
            instr.name, target.get("target", "?"),
            "Unsupported capability",
            ["instruction requires persistent custom state; target does not"],
        )

    native = set(iface.get("operands", {}).get("inputs_native", []))
    adapter = set(iface.get("operands", {}).get("inputs_adapter", []))
    needed = set(instr.inputs)

    missing = needed - native - adapter
    if missing:
        return CompatResult(
            instr.name, target.get("target", "?"),
            "Unsupported capability",
            [f"no path to supply operand(s) {sorted(missing)}"],
        )

    needs_adapter = bool(needed & adapter)
    if needs_adapter:
        reasons.append(
            f"operands {sorted(needed & adapter)} require an adapter port "
            f"(native interface only supplies {sorted(native)})"
        )
        if instr.execution.may_stall and iface.get("stall"):
            reasons.append("variable latency / stall supported by target handshake")
        return CompatResult(
            instr.name, target.get("target", "?"),
            "Adapter required", reasons,
        )

    reasons.append("all operands available on the native interface")
    if instr.execution.may_stall and not iface.get("stall"):
        return CompatResult(
            instr.name, target.get("target", "?"),
            "Unsupported capability",
            ["instruction may stall; target has no stall/wait signal"],
        )
    return CompatResult(
        instr.name, target.get("target", "?"),
        "Looks mappable", reasons,
    )
