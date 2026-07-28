#!/usr/bin/env python3
"""Phase-3 runner: NEORV32 CFU backend.

Same XSIL descriptions and the same differential vector seed/count as Phase 2.
Generates VHDL with the NEORV32 CFU handshake, simulates with GHDL, asserts
protocol properties, and reports Differentially validated / FAIL.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from backends.cfu.generate import write_entity  # noqa: E402
from xsil_sem import Interpreter, generate_cases, load_instruction  # noqa: E402
from xsil_sem.compat import assess, load_target  # noqa: E402

GHDL = ROOT / "third_party" / "oss-cad-suite" / "bin" / "ghdl"
TB = ROOT / "backends" / "cfu" / "tb_xsil_cfu.vhd"

# Keep identical to Phase 2 so both backends see the same cases.
DEFAULT_SEED = 0xC0FFEE
DEFAULT_RANDOM = 2000


def encode_r_type(match: int, rd: int = 1, rs1: int = 2, rs2: int = 3) -> int:
    return (
        (match & 0xFE00707F)
        | ((rd & 0x1F) << 7)
        | ((rs1 & 0x1F) << 15)
        | ((rs2 & 0x1F) << 20)
    )


def write_vectors(path: Path, instructions, num_random: int, seed: int) -> int:
    lines = []
    for instr in instructions:
        interp = Interpreter(instr)
        for case in generate_cases(instr, num_random=num_random, seed=seed):
            exp = interp.run_scalar(case)
            insn = encode_r_type(instr.encoding.match)
            lines.append(
                f"{insn:08x} {case.get('rs1', 0):08x} {case.get('rs2', 0):08x} "
                f"{case.get('rd', 0):08x} {exp:08x}"
            )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return len(lines)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--random", type=int, default=DEFAULT_RANDOM)
    ap.add_argument("--seed", type=int, default=DEFAULT_SEED)
    args = ap.parse_args()

    print("=== ExtenSilica Portability PoC — Phase 3 (NEORV32 CFU) ===")
    print()

    if not GHDL.is_file():
        print("FATAL: GHDL not found under third_party/oss-cad-suite/")
        print("Re-run: bash tools/fetch_sim.sh")
        return 2

    instrs = [
        load_instruction(ROOT / "instructions" / "xmac.yaml"),
        load_instruction(ROOT / "instructions" / "xroladd.yaml"),
    ]
    target = load_target(ROOT / "targets" / "neorv32-cfu.yaml")

    print("[compat] pre-build assessment (flags only — not Compatible):")
    for instr in instrs:
        r = assess(instr, target)
        print(r.format())
        if r.status == "Unsupported capability":
            return 1
    print()

    build = ROOT / "backends" / "cfu" / "build"
    build.mkdir(parents=True, exist_ok=True)

    rtl = write_entity(build / "xsil_cfu.vhd", instrs)
    print(f"[gen] wrote {rtl.relative_to(ROOT)}")

    nvec = write_vectors(build / "vectors.hex", instrs, args.random, args.seed)
    print(f"[vec] wrote {nvec} differential vectors (seed=0x{args.seed:x}, same as PCPI)")

    # GHDL analyze + elaborate + run
    files = [str(rtl), str(TB)]
    for cmd in (
        [str(GHDL), "-a", "--std=08", *files],
        [str(GHDL), "-e", "--std=08", "tb_xsil_cfu"],
    ):
        print("[sim]", " ".join(cmd))
        c = subprocess.run(cmd, cwd=build, capture_output=True, text=True)
        if c.returncode != 0:
            print(c.stdout)
            print(c.stderr)
            print("FATAL: ghdl build failed")
            return 1

    run = subprocess.run(
        [str(GHDL), "-r", "--std=08", "tb_xsil_cfu", "--ieee-asserts=disable-at-0"],
        cwd=build, capture_output=True, text=True,
    )
    out = (run.stdout or "") + (run.stderr or "")
    # GHDL prints report notes to stderr typically
    print(out)

    m = re.search(r"TB_RESULT total=(\d+) passed=(\d+) failed=(\d+) proto_fail=(\d+)", out)
    status = re.search(r"TB_STATUS (\w+)", out)
    if not m or not status:
        print("FATAL: could not parse TB result")
        return 1

    total, passed, failed, proto = map(int, m.groups())
    print()
    print(f"post-test status: {status.group(1)}")
    print(f"  functional : {passed}/{total}")
    print(f"  proto_fail : {proto}")

    if status.group(1) == "DIFFERENTIALLY_VALIDATED" and failed == 0 and proto == 0:
        print()
        print("PHASE 3 PASSED — CFU backend differentially validated against golden model.")
        print("Next: comparative report (reference + PCPI + CFU, same vectors).")
        return 0

    print("PHASE 3 FAILED")
    return 1


if __name__ == "__main__":
    sys.exit(main())
