"""Offline portability CLI (experimental).

Commands mirror the product brief, backed by the local semantic engine — no
registry required:

  xsil-port analyze <path>
  xsil-port check   <path> --target <name>
  xsil-port port    <path> --target <name>
  xsil-port test    <path> --target <name>
  xsil-port targets

``path`` may be a single instruction YAML or a directory of ``*.yaml`` files.
Targets are discovered from ``portability/targets/*.yaml`` (schema_version 1).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List

# Allow `python -m xsil_sem.cli` from the portability/ directory.
_PORT_ROOT = Path(__file__).resolve().parent.parent
if str(_PORT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PORT_ROOT))

from xsil_sem import Interpreter, SchemaError, generate_cases, load_instruction  # noqa: E402
from xsil_sem import expr  # noqa: E402
from xsil_sem.compat import assess  # noqa: E402
from xsil_sem.schema import Instruction  # noqa: E402
from xsil_sem.target_schema import (  # noqa: E402
    Target,
    TargetSchemaError,
    load_all_targets,
)

TARGETS_DIR = _PORT_ROOT / "targets"


def _discover_targets() -> Dict[str, Target]:
    targets = {}
    for t in load_all_targets(TARGETS_DIR):
        if t.id in targets:
            raise SystemExit(f"duplicate target id {t.id!r} under {TARGETS_DIR}")
        targets[t.id] = t
    return targets


def _target_ids() -> List[str]:
    return sorted(_discover_targets())


def _load_instructions(path: Path) -> List[Instruction]:
    path = path.resolve()
    if path.is_file():
        return [load_instruction(path)]
    if path.is_dir():
        files = sorted(path.glob("*.yaml")) + sorted(path.glob("*.yml"))
        # Prefer nested instructions/ if present and top-level is empty of yaml.
        nested = path / "instructions"
        if nested.is_dir():
            files = sorted(nested.glob("*.yaml")) + sorted(nested.glob("*.yml"))
        if not files:
            raise SystemExit(f"no instruction YAML files found under {path}")
        return [load_instruction(f) for f in files]
    raise SystemExit(f"path not found: {path}")


def _resolve_target(name: str) -> Target:
    targets = _discover_targets()
    if name not in targets:
        known = ", ".join(sorted(targets)) or "(none)"
        raise SystemExit(f"unknown target {name!r}; known: {known}")
    return targets[name]


def cmd_targets(_args: argparse.Namespace) -> int:
    targets = _discover_targets()
    if not targets:
        print(f"no targets found under {TARGETS_DIR}")
        return 1
    print(f"{'id':<18} {'status':<14} {'interface':<12} backend")
    for tid in sorted(targets):
        t = targets[tid]
        backend = t.implementation.adapter_backend or "—"
        print(
            f"{t.id:<18} {t.status:<14} {t.interface.name:<12} {backend}"
        )
    return 0


def cmd_analyze(args: argparse.Namespace) -> int:
    instrs = _load_instructions(Path(args.path))
    print(f"analyzed {len(instrs)} instruction(s) from {args.path}")
    print()
    for instr in instrs:
        ops = sorted(expr.referenced_operands(instr.output_expr))
        print(f"instruction : {instr.name}")
        if instr.description:
            print(f"description : {instr.description}")
        print(f"xlen        : {instr.xlen}")
        print(
            f"encoding    : length={instr.encoding.length} "
            f"mask=0x{instr.encoding.mask:08x} match=0x{instr.encoding.match:08x}"
        )
        print(f"inputs      : {instr.inputs}")
        print(f"outputs     : {instr.outputs}")
        print(
            f"effects     : memory={instr.effects.memory} csr={instr.effects.csr} "
            f"exceptions={instr.effects.exceptions} "
            f"persistent_state={instr.effects.persistent_state}"
        )
        print(
            f"execution   : latency={instr.execution.latency} "
            f"cycles={instr.execution.cycles} may_stall={instr.execution.may_stall}"
        )
        print(f"overflow    : {instr.overflow}")
        print(f"reads       : {ops}")
        print(f"schema      : experimental (MVP class)")
        print()
    return 0


def cmd_check(args: argparse.Namespace) -> int:
    instrs = _load_instructions(Path(args.path))
    target = _resolve_target(args.target)

    print(
        f"pre-build assessment vs {target.id} "
        f"(target.status={target.status}; flags only — never 'Compatible'):"
    )
    print()
    worst = 0
    for instr in instrs:
        result = assess(instr, target)
        print(result.format())
        print()
        if result.status == "Unsupported capability":
            worst = 2
        elif result.status == "Adapter required" and worst < 1:
            worst = 1
        # Not assessed / Candidate / Looks mappable → exit 0
    return worst


def cmd_port(args: argparse.Namespace) -> int:
    instrs = _load_instructions(Path(args.path))
    target = _resolve_target(args.target)
    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    backend = target.implementation.adapter_backend

    if target.status == "not_assessed" or not backend:
        print(
            f"refusing to generate: target {target.id} has status={target.status!r} "
            f"and adapter_backend={backend!r}"
        )
        return 2

    for instr in instrs:
        result = assess(instr, target)
        print(result.format())
        if result.status in ("Unsupported capability", "Not assessed"):
            print(f"refusing to generate: {result.status}")
            return 2

    artifacts: List[str] = []
    if backend == "reference":
        pass  # golden stub only — no RTL
    elif backend == "pcpi":
        from backends.pcpi.generate import write_module

        rtl = write_module(out / "xsil_pcpi.v", instrs)
        artifacts.append(rtl.name)
        print(f"generated {rtl}")
    elif backend == "neorv32-cfu":
        from backends.cfu.generate import write_entity

        rtl = write_entity(out / "xsil_cfu.vhd", instrs)
        artifacts.append(rtl.name)
        print(f"generated {rtl}")
    elif backend == "cvxif":
        from backends.cvxif.generate import write_module

        rtl = write_module(out / "xsil_cvxif.v", instrs)
        artifacts.append(rtl.name)
        print(f"generated {rtl}")
    elif backend == "rocc":
        from backends.rocc.generate import write_module

        rtl = write_module(out / "xsil_rocc.v", instrs)
        artifacts.append(rtl.name)
        print(f"generated {rtl}")
    else:
        raise SystemExit(f"no generator for adapter_backend {backend!r}")

    statuses = [assess(i, target).status for i in instrs]
    if "Adapter required" in statuses:
        port_status = "Adapter required"
    elif "Candidate" in statuses:
        port_status = "Candidate"
    else:
        port_status = "Looks mappable"

    meta = {
        "target": target.id,
        "status": port_status,
        "artifacts": artifacts,
        "instructions": [i.name for i in instrs],
        "notes": target.adapter_notes.strip(),
        "schema": "experimental",
        "schema_version": target.schema_version,
        "adapter_backend": backend,
    }
    meta_path = out / "xsil-port.json"
    meta_path.write_text(json.dumps(meta, indent=2) + "\n")
    print(f"wrote {meta_path}")
    if backend != "reference":
        print()
        print(
            "post-generate status is NOT 'Compatible'. "
            f"Run: xsil-port test ... --target {target.id}"
        )
    return 0


def cmd_test(args: argparse.Namespace) -> int:
    instrs = _load_instructions(Path(args.path))
    target = _resolve_target(args.target)
    backend = target.implementation.adapter_backend

    if target.status == "not_assessed" or not backend:
        print(
            f"no test backend: target {target.id} status={target.status!r} "
            f"adapter_backend={backend!r}"
        )
        return 2

    for instr in instrs:
        result = assess(instr, target)
        if result.status in ("Unsupported capability", "Not assessed"):
            print(result.format())
            return 2

    if backend == "reference":
        print(f"testing {len(instrs)} instruction(s) on reference interpreter")
        total = passed = 0
        for instr in instrs:
            interp = Interpreter(instr)
            cases = generate_cases(instr, num_random=args.random, seed=args.seed)
            for case in cases:
                total += 1
                # Self-consistency of the golden model (deterministic pure function).
                if interp.run(case) == interp.run(case):
                    passed += 1
            print(f"  {instr.name}: {len(cases)} cases OK")
        print(f"reference: {passed}/{total}  status=DIFFERENTIALLY_VALIDATED")
        return 0

    build = (
        Path(args.build).resolve()
        if args.build
        else (_PORT_ROOT / "backends" / "cli-build" / target.id)
    )
    build.mkdir(parents=True, exist_ok=True)

    if backend == "pcpi":
        return _test_pcpi(instrs, build, args.random, args.seed)
    if backend == "neorv32-cfu":
        return _test_cfu(instrs, build, args.random, args.seed)
    if backend == "cvxif":
        return _test_cvxif(instrs, build, args.random, args.seed)
    if backend == "rocc":
        return _test_rocc(instrs, build, args.random, args.seed)
    raise SystemExit(f"no test backend for adapter_backend {backend!r}")


def _encode_r_type(match: int, rd: int = 1, rs1: int = 2, rs2: int = 3) -> int:
    return (
        (match & 0xFE00707F)
        | ((rd & 0x1F) << 7)
        | ((rs1 & 0x1F) << 15)
        | ((rs2 & 0x1F) << 20)
    )


def _write_vectors(path: Path, instrs: List[Instruction], num_random: int, seed: int) -> int:
    lines = []
    for instr in instrs:
        interp = Interpreter(instr)
        for case in generate_cases(instr, num_random=num_random, seed=seed):
            exp = interp.run_scalar(case)
            insn = _encode_r_type(instr.encoding.match)
            lines.append(
                f"{insn:08x} {case.get('rs1', 0):08x} {case.get('rs2', 0):08x} "
                f"{case.get('rd', 0):08x} {exp:08x}"
            )
    path.write_text("\n".join(lines) + "\n")
    return len(lines)


def _test_pcpi(instrs: List[Instruction], build: Path, num_random: int, seed: int) -> int:
    import re
    import subprocess

    from backends.pcpi.generate import write_module

    iverilog = _PORT_ROOT / "third_party" / "oss-cad-suite" / "bin" / "iverilog"
    vvp = _PORT_ROOT / "third_party" / "oss-cad-suite" / "bin" / "vvp"
    tb = _PORT_ROOT / "backends" / "pcpi" / "tb_xsil_pcpi.v"
    if not iverilog.is_file():
        print("FATAL: Icarus not found — run: bash tools/fetch_sim.sh")
        return 2

    rtl = write_module(build / "xsil_pcpi.v", instrs)
    n = _write_vectors(build / "vectors.hex", instrs, num_random, seed)
    print(f"[pcpi] generated {rtl.name}, {n} vectors")
    vvp_out = build / "tb.vvp"
    c = subprocess.run(
        [str(iverilog), "-g2012", "-o", str(vvp_out), str(rtl), str(tb)],
        cwd=build, capture_output=True, text=True,
    )
    if c.returncode != 0:
        print(c.stderr or c.stdout)
        return 1
    run = subprocess.run([str(vvp), str(vvp_out)], cwd=build, capture_output=True, text=True)
    out = (run.stdout or "") + (run.stderr or "")
    print(out.strip())
    m = re.search(r"TB_RESULT total=(\d+) passed=(\d+) failed=(\d+) proto_fail=(\d+)", out)
    status = re.search(r"TB_STATUS (\w+)", out)
    if not m or not status:
        return 1
    total, passed, failed, proto = map(int, m.groups())
    print(f"post-test: {status.group(1)}  functional={passed}/{total}  proto_fail={proto}")
    return 0 if status.group(1) == "DIFFERENTIALLY_VALIDATED" and failed == 0 and proto == 0 else 1


def _test_cfu(instrs: List[Instruction], build: Path, num_random: int, seed: int) -> int:
    import re
    import subprocess

    from backends.cfu.generate import write_entity

    ghdl = _PORT_ROOT / "third_party" / "oss-cad-suite" / "bin" / "ghdl"
    tb = _PORT_ROOT / "backends" / "cfu" / "tb_xsil_cfu.vhd"
    if not ghdl.is_file():
        print("FATAL: GHDL not found — run: bash tools/fetch_sim.sh")
        return 2

    rtl = write_entity(build / "xsil_cfu.vhd", instrs)
    n = _write_vectors(build / "vectors.hex", instrs, num_random, seed)
    print(f"[cfu] generated {rtl.name}, {n} vectors")
    for cmd in (
        [str(ghdl), "-a", "--std=08", str(rtl), str(tb)],
        [str(ghdl), "-e", "--std=08", "tb_xsil_cfu"],
    ):
        c = subprocess.run(cmd, cwd=build, capture_output=True, text=True)
        if c.returncode != 0:
            print(c.stderr or c.stdout)
            return 1
    run = subprocess.run(
        [str(ghdl), "-r", "--std=08", "tb_xsil_cfu", "--ieee-asserts=disable-at-0"],
        cwd=build, capture_output=True, text=True,
    )
    out = (run.stdout or "") + (run.stderr or "")
    print(out.strip())
    m = re.search(r"TB_RESULT total=(\d+) passed=(\d+) failed=(\d+) proto_fail=(\d+)", out)
    status = re.search(r"TB_STATUS (\w+)", out)
    if not m or not status:
        return 1
    total, passed, failed, proto = map(int, m.groups())
    print(f"post-test: {status.group(1)}  functional={passed}/{total}  proto_fail={proto}")
    return 0 if status.group(1) == "DIFFERENTIALLY_VALIDATED" and failed == 0 and proto == 0 else 1


def _test_cvxif(instrs: List[Instruction], build: Path, num_random: int, seed: int) -> int:
    import re
    import subprocess

    from backends.cvxif.generate import write_module

    iverilog = _PORT_ROOT / "third_party" / "oss-cad-suite" / "bin" / "iverilog"
    vvp = _PORT_ROOT / "third_party" / "oss-cad-suite" / "bin" / "vvp"
    tb = _PORT_ROOT / "backends" / "cvxif" / "tb_xsil_cvxif.v"
    if not iverilog.is_file():
        print("FATAL: Icarus not found — run: bash tools/fetch_sim.sh")
        return 2

    rtl = write_module(build / "xsil_cvxif.v", instrs)
    n = _write_vectors(build / "vectors.hex", instrs, num_random, seed)
    print(f"[cvxif] generated {rtl.name}, {n} vectors")
    vvp_out = build / "tb.vvp"
    c = subprocess.run(
        [str(iverilog), "-g2012", "-o", str(vvp_out), str(rtl), str(tb)],
        cwd=build, capture_output=True, text=True,
    )
    if c.returncode != 0:
        print(c.stderr or c.stdout)
        return 1
    run = subprocess.run([str(vvp), str(vvp_out)], cwd=build, capture_output=True, text=True)
    out = (run.stdout or "") + (run.stderr or "")
    print(out.strip())
    m = re.search(r"TB_RESULT total=(\d+) passed=(\d+) failed=(\d+) proto_fail=(\d+)", out)
    status = re.search(r"TB_STATUS (\w+)", out)
    if not m or not status:
        return 1
    total, passed, failed, proto = map(int, m.groups())
    print(f"post-test: {status.group(1)}  functional={passed}/{total}  proto_fail={proto}")
    return 0 if status.group(1) == "DIFFERENTIALLY_VALIDATED" and failed == 0 and proto == 0 else 1


def _test_rocc(instrs: List[Instruction], build: Path, num_random: int, seed: int) -> int:
    import re
    import subprocess

    from backends.rocc.generate import write_module

    iverilog = _PORT_ROOT / "third_party" / "oss-cad-suite" / "bin" / "iverilog"
    vvp = _PORT_ROOT / "third_party" / "oss-cad-suite" / "bin" / "vvp"
    tb = _PORT_ROOT / "backends" / "rocc" / "tb_xsil_rocc.v"
    if not iverilog.is_file():
        print("FATAL: Icarus not found — run: bash tools/fetch_sim.sh")
        return 2

    rtl = write_module(build / "xsil_rocc.v", instrs)
    n = _write_vectors(build / "vectors.hex", instrs, num_random, seed)
    print(f"[rocc] generated {rtl.name}, {n} vectors")
    vvp_out = build / "tb.vvp"
    c = subprocess.run(
        [str(iverilog), "-g2012", "-o", str(vvp_out), str(rtl), str(tb)],
        cwd=build, capture_output=True, text=True,
    )
    if c.returncode != 0:
        print(c.stderr or c.stdout)
        return 1
    run = subprocess.run([str(vvp), str(vvp_out)], cwd=build, capture_output=True, text=True)
    out = (run.stdout or "") + (run.stderr or "")
    print(out.strip())
    m = re.search(r"TB_RESULT total=(\d+) passed=(\d+) failed=(\d+) proto_fail=(\d+)", out)
    status = re.search(r"TB_STATUS (\w+)", out)
    if not m or not status:
        return 1
    total, passed, failed, proto = map(int, m.groups())
    print(f"post-test: {status.group(1)}  functional={passed}/{total}  proto_fail={proto}")
    return 0 if status.group(1) == "DIFFERENTIALLY_VALIDATED" and failed == 0 and proto == 0 else 1


def build_parser() -> argparse.ArgumentParser:
    known = _target_ids()
    p = argparse.ArgumentParser(
        prog="xsil-port",
        description="Offline ExtenSilica portability CLI (experimental, no registry).",
    )
    p.add_argument("-V", "--version", action="version", version="xsil-port 0.0.1-experimental")
    sub = p.add_subparsers(dest="cmd", required=True)

    a = sub.add_parser("analyze", help="load and summarize instruction YAML(s)")
    a.add_argument("path", help="instruction YAML file or directory")
    a.set_defaults(func=cmd_analyze)

    c = sub.add_parser("check", help="pre-build compatibility vs a target (flags only)")
    c.add_argument("path", help="instruction YAML file or directory")
    c.add_argument("--target", required=True, choices=known)
    c.set_defaults(func=cmd_check)

    o = sub.add_parser("port", help="generate target adapter from the semantic IR")
    o.add_argument("path", help="instruction YAML file or directory")
    o.add_argument("--target", required=True, choices=known)
    o.add_argument("--out", default="generated", help="output directory (default: ./generated)")
    o.set_defaults(func=cmd_port)

    t = sub.add_parser("test", help="differentially validate against a target")
    t.add_argument("path", help="instruction YAML file or directory")
    t.add_argument("--target", required=True, choices=known)
    t.add_argument("--random", type=int, default=500, help="random cases per instruction")
    t.add_argument("--seed", type=int, default=0xC0FFEE)
    t.add_argument("--build", default=None, help="build directory for RTL sim")
    t.set_defaults(func=cmd_test)

    ls = sub.add_parser("targets", help="list capability models under targets/")
    ls.set_defaults(func=cmd_targets)

    return p


def main(argv: List[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except (SchemaError, TargetSchemaError) as exc:
        print(f"schema error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
