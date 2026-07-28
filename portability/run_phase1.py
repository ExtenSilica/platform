#!/usr/bin/env python3
"""Phase-1 runner: schema + reference interpreter + differential harness.

Proves, without any hardware backend yet:

  1. XMAC and XROLADD load from a single semantic description.
  2. The reference interpreter executes both.
  3. Thousands of seeded random + edge cases agree with an independent
     Python oracle of the English-language semantics.
  4. The harness *rejects* a deliberately buggy target (negative control).
  5. The experimental schema also loads a broader corpus (saturation,
     selection, bit-manipulation, comparison) so the IR is not tailored
     only to the two MVP instructions.

Usage (from repo root or this directory):

    python3 portability/run_phase1.py
    python3 portability/run_phase1.py --random 5000
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from xsil_sem import Interpreter, load_instruction, run_differential  # noqa: E402
from xsil_sem.mvp import load_mvp_instructions  # noqa: E402


def _oracle_xmac(inputs):
    """Independent of the IR — implements the English description directly."""
    return (inputs["rd"] + inputs["rs1"] * inputs["rs2"]) & 0xFFFFFFFF


def _oracle_xroladd(inputs):
    rd, rs1, rs2 = inputs["rd"], inputs["rs1"], inputs["rs2"]
    shamt = rs2 & 0x1F
    rs1 &= 0xFFFFFFFF
    if shamt == 0:
        rotated = rs1
    else:
        rotated = ((rs1 << shamt) | (rs1 >> (32 - shamt))) & 0xFFFFFFFF
    return (rotated + rd) & 0xFFFFFFFF


def _oracle_clz(inputs):
    """Zbb clz — independent of the IR."""
    x = inputs["rs1"] & 0xFFFFFFFF
    if x == 0:
        return 32
    n = 0
    for bit in range(31, -1, -1):
        if x & (1 << bit):
            return n
        n += 1
    return 32


def _buggy_xmac(inputs):
    """Negative control: off-by-one. Harness must report MISMATCH."""
    return (_oracle_xmac(inputs) + 1) & 0xFFFFFFFF


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--random", type=int, default=3000,
                    help="number of seeded random cases per instruction")
    ap.add_argument("--seed", type=int, default=0xC0FFEE)
    args = ap.parse_args()

    print("=== ExtenSilica Portability PoC — Phase 1 ===")
    print("schema + reference interpreter + differential harness")
    print()

    instrs = load_mvp_instructions()
    oracles = {
        "xmac": _oracle_xmac,
        "xroladd": _oracle_xroladd,
        "clz": _oracle_clz,
    }
    for instr in instrs:
        print(f"[load] {instr.name}: {instr.description}")

    # Fixed smoke vectors
    by_name = {i.name: i for i in instrs}
    assert Interpreter(by_name["xmac"]).run_scalar({"rd": 3, "rs1": 4, "rs2": 5}) == 23
    assert Interpreter(by_name["xroladd"]).run_scalar(
        {"rd": 1, "rs1": 0x80000001, "rs2": 1}
    ) == 4
    assert Interpreter(by_name["clz"]).run_scalar({"rs1": 0}) == 32
    assert Interpreter(by_name["clz"]).run_scalar({"rs1": 1}) == 31
    assert Interpreter(by_name["clz"]).run_scalar({"rs1": 0x80000000}) == 0
    print("[smoke] XMAC / XROLADD / CLZ textbook vectors OK")
    print()

    reports = []
    for instr in instrs:
        report = run_differential(
            instr, oracles[instr.name], target_name="python-oracle",
            num_random=args.random, seed=args.seed,
        )
        print(report.format())
        print()
        reports.append(report)

    bad = run_differential(
        by_name["xmac"], _buggy_xmac, target_name="buggy-off-by-one",
        num_random=min(200, args.random), seed=args.seed,
    )
    print(bad.format())
    print()
    if bad.ok:
        print("FAIL: harness did not catch a deliberately buggy target")
        return 1

    corpus_dir = ROOT / "corpus"
    print("[corpus] loading schema-fitness instructions:")
    for path in sorted(corpus_dir.glob("*.yaml")):
        instr = load_instruction(path)
        interp = Interpreter(instr)
        env = {role: 1 for role in instr.inputs}
        out = interp.run(env)
        print(f"  {instr.name:10s}  inputs={instr.inputs}  "
              f"sample_out=0x{out[instr.output]:08x}")
    print()

    if not all(r.ok for r in reports):
        print("PHASE 1 FAILED — see mismatches above")
        return 1

    total = sum(r.total for r in reports)
    print(f"PHASE 1 PASSED — {total} differential cases across "
          f"{len(reports)} instructions agreed with independent oracles.")
    print("Next: hardware backends (PCPI / CFU) with the same descriptions.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
