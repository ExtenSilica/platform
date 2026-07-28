"""Differential test harness.

Generates deterministic edge cases plus seeded pseudo-random cases, runs them on
the golden reference interpreter and on a target implementation, and reports any
divergence. Fixed vectors alone are never treated as sufficient evidence — the
random sweep is what turns "the demo passed" into "the port is differentially
validated".

A *target* is any callable ``inputs -> {output_role: value}`` (or a bare int for
single-output instructions). In this phase targets are Python callables; later
they will be thin adapters that drive PicoRV32/NEORV32 simulations and return the
observed result register.
"""

from __future__ import annotations

import itertools
import random
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Mapping, Sequence, Union

from . import expr
from .interpreter import Interpreter
from .schema import Instruction

TargetResult = Union[int, Mapping[str, int]]
Target = Callable[[Mapping[str, int]], TargetResult]

# Values that historically expose sign / overflow / shift-amount bugs.
def _edge_values(xlen: int) -> List[int]:
    m = expr.mask(xlen)
    return [
        0,
        1,
        2,
        m,                       # -1 / max unsigned
        m >> 1,                  # 0x7FFF_FFFF  max signed
        (m >> 1) + 1,            # 0x8000_0000  min signed
        0x55555555 & m,
        0xAAAAAAAA & m,
        31,                      # shift-amount boundary
        32,
    ]


@dataclass
class Mismatch:
    inputs: Dict[str, int]
    expected: Dict[str, int]
    got: Dict[str, int]

    def format(self, xlen: int) -> str:
        def hexmap(d: Mapping[str, int]) -> str:
            return ", ".join(f"{k}=0x{v & expr.mask(xlen):08x}" for k, v in d.items())
        return (
            f"  inputs   : {hexmap(self.inputs)}\n"
            f"  expected : {hexmap(self.expected)}\n"
            f"  got      : {hexmap(self.got)}"
        )


@dataclass
class Report:
    instruction: str
    target: str
    xlen: int
    total: int = 0
    passed: int = 0
    mismatches: List[Mismatch] = field(default_factory=list)

    @property
    def failed(self) -> int:
        return len(self.mismatches)

    @property
    def ok(self) -> bool:
        return self.failed == 0 and self.total > 0

    def format(self, max_shown: int = 5) -> str:
        head = (
            f"{self.instruction} vs {self.target}\n"
            f"  cases    : {self.total}\n"
            f"  passed   : {self.passed}/{self.total}\n"
            f"  status   : {'DIFFERENTIALLY VALIDATED' if self.ok else 'MISMATCH'}"
        )
        if self.ok:
            return head
        shown = self.mismatches[:max_shown]
        lines = [head, f"  first {len(shown)} mismatch(es):"]
        for i, mm in enumerate(shown, 1):
            lines.append(f"  [{i}]")
            lines.append(mm.format(self.xlen))
        if self.failed > len(shown):
            lines.append(f"  ... and {self.failed - len(shown)} more")
        return "\n".join(lines)


def _normalize(result: TargetResult, output_role: str, xlen: int) -> Dict[str, int]:
    if isinstance(result, Mapping):
        return {k: int(v) & expr.mask(xlen) for k, v in result.items()}
    return {output_role: int(result) & expr.mask(xlen)}


def generate_cases(
    instr: Instruction,
    num_random: int = 2000,
    seed: int = 0xC0FFEE,
    max_deterministic: int = 4096,
) -> List[Dict[str, int]]:
    """Deterministic edge-value combinations followed by seeded random cases."""
    xlen = instr.xlen
    edges = _edge_values(xlen)
    cases: List[Dict[str, int]] = []
    seen: set[tuple] = set()

    def add(values: Sequence[int]) -> None:
        case = {role: v & expr.mask(xlen) for role, v in zip(instr.inputs, values)}
        key = tuple(case[r] for r in instr.inputs)
        if key not in seen:
            seen.add(key)
            cases.append(case)

    for combo in itertools.product(edges, repeat=len(instr.inputs)):
        if len(cases) >= max_deterministic:
            break
        add(combo)

    rng = random.Random(seed)
    for _ in range(num_random):
        add([rng.getrandbits(xlen) for _ in instr.inputs])

    return cases


def run_differential(
    instr: Instruction,
    target: Target,
    target_name: str = "target",
    num_random: int = 2000,
    seed: int = 0xC0FFEE,
) -> Report:
    interp = Interpreter(instr)
    report = Report(instruction=instr.name, target=target_name, xlen=instr.xlen)

    for case in generate_cases(instr, num_random=num_random, seed=seed):
        expected = interp.run(case)
        got = _normalize(target(case), instr.output, instr.xlen)
        report.total += 1
        # Compare only the declared output role(s); ignore extra keys a target
        # might return for diagnostics.
        if all(got.get(role) == expected[role] for role in instr.outputs):
            report.passed += 1
        else:
            report.mismatches.append(
                Mismatch(inputs=dict(case), expected=expected,
                         got={r: got.get(r) for r in instr.outputs})
            )
    return report
