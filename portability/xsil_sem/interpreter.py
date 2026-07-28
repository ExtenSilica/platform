"""Reference interpreter — the golden model.

Executes an :class:`~xsil_sem.schema.Instruction` directly from its semantic
description and produces the architectural result. Every hardware backend must
reproduce these results bit-for-bit; when they disagree, the golden model is
right by definition and the backend is wrong.
"""

from __future__ import annotations

from typing import Dict, Mapping

from . import expr
from .schema import Instruction


class Interpreter:
    def __init__(self, instr: Instruction):
        self.instr = instr

    def run(self, inputs: Mapping[str, int]) -> Dict[str, int]:
        """Compute output register(s) from input register values.

        ``inputs`` maps operand roles (e.g. "rd", "rs1", "rs2") to unsigned
        register values. Every declared input must be provided. The result maps
        the output role(s) to their computed unsigned value(s).
        """
        instr = self.instr
        missing = set(instr.inputs) - set(inputs)
        if missing:
            raise ValueError(f"{instr.name}: missing input operand(s): {sorted(missing)}")

        env = {role: (int(inputs[role]) & expr.mask(instr.xlen)) for role in instr.inputs}

        result: Dict[str, int] = {}
        for out_name, tree in instr.semantics.items():
            result[out_name] = expr.evaluate(tree, env, instr.xlen) & expr.mask(instr.xlen)
        return result

    def run_scalar(self, inputs: Mapping[str, int]) -> int:
        """Convenience for single-output instructions: return just the value."""
        out = self.run(inputs)
        return out[self.instr.output]
