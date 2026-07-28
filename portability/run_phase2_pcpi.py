#!/usr/bin/env python3
"""Phase-2 runner: PicoRV32 PCPI backend.

1. Assess pre-build status (Adapter required for rd-as-source).
2. Generate PCPI Verilog from the XSIL IR (no hand-written arithmetic).
3. Emit differential vectors from the golden model.
4. Simulate with Icarus Verilog + protocol assertions.
5. Report Differentially validated / FAIL.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from backends.pcpi.generate import write_module  # noqa: E402
from xsil_sem import Interpreter, generate_cases, load_instruction  # noqa: E402
from xsil_sem.compat import assess, load_target  # noqa: E402

IVERILOG = ROOT / "third_party" / "oss-cad-suite" / "bin" / "iverilog"
VVP = ROOT / "third_party" / "oss-cad-suite" / "bin" / "vvp"
TB = ROOT / "backends" / "pcpi" / "tb_xsil_pcpi.v"


def encode_r_type(match: int, rd: int = 1, rs1: int = 2, rs2: int = 3) -> int:
    """Fill rd/rs1/rs2 fields; opcode/funct3/funct7 come from match."""
    return (
        (match & 0xFE00707F)
        | ((rd & 0x1F) << 7)
        | ((rs1 & 0x1F) << 15)
        | ((rs2 & 0x1F) << 20)
    )


def write_vectors(path: Path, instructions, num_random: int, seed: int) -> int:
    """Write `insn rs1 rs2 rsd expected` hex lines for the Verilog TB."""
    lines = []
    for instr in instructions:
        interp = Interpreter(instr)
        for case in generate_cases(instr, num_random=num_random, seed=seed):
            exp = interp.run_scalar(case)
            insn = encode_r_type(instr.encoding.match)
            rs1 = case.get("rs1", 0)
            rs2 = case.get("rs2", 0)
            rsd = case.get("rd", 0)
            lines.append(
                f"{insn:08x} {rs1:08x} {rs2:08x} {rsd:08x} {exp:08x}"
            )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return len(lines)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--random", type=int, default=2000)
    ap.add_argument("--seed", type=int, default=0xC0FFEE)
    ap.add_argument("--keep-build", action="store_true")
    args = ap.parse_args()

    print("=== ExtenSilica Portability PoC — Phase 2 (PicoRV32 PCPI) ===")
    print()

    if not IVERILOG.is_file() or not VVP.is_file():
        print("FATAL: Icarus Verilog not found under third_party/oss-cad-suite/")
        print("Run: bash tools/fetch_sim.sh")
        return 2

    instrs = [
        load_instruction(ROOT / "instructions" / "xmac.yaml"),
        load_instruction(ROOT / "instructions" / "xroladd.yaml"),
    ]
    target = load_target(ROOT / "targets" / "picorv32-pcpi.yaml")

    print("[compat] pre-build assessment (flags only — not Compatible):")
    for instr in instrs:
        r = assess(instr, target)
        print(r.format())
        if r.status == "Unsupported capability":
            print("FATAL: instruction not mappable to this target")
            return 1
    print()

    build = ROOT / "backends" / "pcpi" / "build"
    build.mkdir(parents=True, exist_ok=True)

    rtl = write_module(build / "xsil_pcpi.v", instrs)
    print(f"[gen] wrote {rtl.relative_to(ROOT)}")

    nvec = write_vectors(build / "vectors.hex", instrs, args.random, args.seed)
    print(f"[vec] wrote {nvec} differential vectors (golden model)")

    # Compile + run inside build/ so vectors.hex is found by $fopen
    vvp_out = build / "tb.vvp"
    compile_cmd = [str(IVERILOG), "-g2012", "-o", str(vvp_out), str(rtl), str(TB)]
    print("[sim] ", " ".join(compile_cmd))
    c = subprocess.run(compile_cmd, cwd=build, capture_output=True, text=True)
    if c.returncode != 0:
        print(c.stdout)
        print(c.stderr)
        print("FATAL: iverilog compile failed")
        return 1

    run = subprocess.run([str(VVP), str(vvp_out)], cwd=build, capture_output=True, text=True)
    out = (run.stdout or "") + (run.stderr or "")
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
        print("PHASE 2 PASSED — PCPI backend differentially validated against golden model.")
        print("Next: NEORV32 CFU backend (same description, same cases).")
        return 0

    print("PHASE 2 FAILED")
    return 1


if __name__ == "__main__":
    sys.exit(main())
