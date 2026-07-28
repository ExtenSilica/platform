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

    # 1. Load MVP instructions
    xmac = load_instruction(ROOT / "instructions" / "xmac.yaml")
    xroladd = load_instruction(ROOT / "instructions" / "xroladd.yaml")
    print(f"[load] {xmac.name}: {xmac.description}")
    print(f"[load] {xroladd.name}: {xroladd.description}")

    # 2. Fixed smoke vectors (the textbook cases from the product brief)
    ix = Interpreter(xmac)
    ir = Interpreter(xroladd)
    assert ix.run_scalar({"rd": 3, "rs1": 4, "rs2": 5}) == 23
    assert ir.run_scalar({"rd": 1, "rs1": 0x80000001, "rs2": 1}) == 4
    print("[smoke] XMAC(3,4,5) = 23")
    print("[smoke] XROLADD(rd=1, rs1=0x80000001, rs2=1) = 4")
    print()

    # 3. Differential vs independent oracles
    reports = []
    for instr, oracle, name in (
        (xmac, _oracle_xmac, "python-oracle"),
        (xroladd, _oracle_xroladd, "python-oracle"),
    ):
        report = run_differential(
            instr, oracle, target_name=name,
            num_random=args.random, seed=args.seed,
        )
        print(report.format())
        print()
        reports.append(report)

    # 4. Negative control — buggy target must fail
    bad = run_differential(
        xmac, _buggy_xmac, target_name="buggy-off-by-one",
        num_random=min(200, args.random), seed=args.seed,
    )
    print(bad.format())
    print()
    if bad.ok:
        print("FAIL: harness did not catch a deliberately buggy target")
        return 1

    # 5. Corpus fitness — schema must accept a broader instruction class
    corpus_dir = ROOT / "corpus"
    print("[corpus] loading schema-fitness instructions:")
    for path in sorted(corpus_dir.glob("*.yaml")):
        instr = load_instruction(path)
        interp = Interpreter(instr)
        # One trivial execution just to prove the tree evaluates.
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
    print("Next: PicoRV32 PCPI backend (same description, same cases).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
