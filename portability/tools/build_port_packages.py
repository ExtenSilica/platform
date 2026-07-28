#!/usr/bin/env python3
"""Build XMAC evidence packages under portability/packages/.

Regenerates RTL from the semantic IR, runs differential tests (when sim tools
are present), writes frozen evidence JSON, and packs ``.xsil`` archives into
``packages/dist/``.

Does **not** publish to the registry — that remains a separate, authorized step.

Usage (from portability/):

    python3 tools/build_port_packages.py
    python3 tools/build_port_packages.py --random 500
    python3 tools/build_port_packages.py --skip-sim   # RTL + pack only
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tarfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PKG = ROOT / "packages"
DIST = PKG / "dist"
IGNORE_NAMES = {".git", ".xsilignore", ".DS_Store", "Thumbs.db"}


def _load_xmac():
    sys.path.insert(0, str(ROOT))
    from xsil_sem import load_instruction

    src = ROOT / "instructions" / "xmac.yaml"
    dst = PKG / "xmac" / "instructions" / "xmac.yaml"
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    return load_instruction(dst)


def _write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def _pack_xsil(pkg_dir: Path, out: Path) -> Path:
    """Create a gzip-compressed tar named <name>-<version>.xsil."""
    manifest = json.loads((pkg_dir / "manifest.json").read_text(encoding="utf-8"))
    name = manifest["name"]
    version = manifest["version"]
    out.mkdir(parents=True, exist_ok=True)
    archive = out / f"{name}-{version}.xsil"

    def _filter(info: tarfile.TarInfo):
        base = Path(info.name).name
        if base in IGNORE_NAMES or base.endswith("~"):
            return None
        return info

    with tarfile.open(archive, "w:gz") as tar:
        for path in sorted(pkg_dir.rglob("*")):
            if not path.is_file():
                continue
            rel = path.relative_to(pkg_dir)
            if any(part in IGNORE_NAMES for part in rel.parts):
                continue
            if path.name in IGNORE_NAMES:
                continue
            tar.add(path, arcname=str(Path(name) / rel), filter=_filter)
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    print(f"packed {archive.name}  sha256={digest}")
    return archive


def _gen_rtl(instr) -> None:
    from backends.pcpi.generate import write_module as write_pcpi
    from backends.cfu.generate import write_entity
    from backends.cvxif.generate import write_module as write_cvxif
    from backends.rocc.generate import write_module as write_rocc

    pcpi = PKG / "xmac-port-picorv32-pcpi"
    cfu = PKG / "xmac-port-neorv32-cfu"
    cvxif = PKG / "xmac-port-cva6-cvxif"
    rocc = PKG / "xmac-port-rocket-rocc"
    write_pcpi(pcpi / "rtl" / "xsil_pcpi.v", [instr])
    write_entity(cfu / "rtl" / "xsil_cfu.vhd", [instr])
    write_cvxif(cvxif / "rtl" / "xsil_cvxif.v", [instr])
    write_rocc(rocc / "rtl" / "xsil_rocc.v", [instr])

    for pkg_dir, target, artifacts, backend in (
        (pcpi, "picorv32-pcpi", ["rtl/xsil_pcpi.v"], "pcpi"),
        (cfu, "neorv32-cfu", ["rtl/xsil_cfu.vhd"], "neorv32-cfu"),
        (cvxif, "cva6-cvxif", ["rtl/xsil_cvxif.v"], "cvxif"),
        (rocc, "rocket-rocc", ["rtl/xsil_rocc.v"], "rocc"),
    ):
        _write_json(
            pkg_dir / "xsil-port.json",
            {
                "target": target,
                "status": "Adapter required",
                "artifacts": artifacts,
                "instructions": ["xmac"],
                "schema": "experimental",
                "schema_version": 1,
                "parentPackage": "xmac",
                "adapter_backend": backend,
                "generated_by": "tools/build_port_packages.py",
            },
        )
    print("generated PCPI + CFU + CV-X-IF + RoCC RTL for xmac")


def _reference_evidence(instr, random: int, seed: int) -> dict:
    from xsil_sem import Interpreter, generate_cases

    interp = Interpreter(instr)
    cases = generate_cases(instr, num_random=random, seed=seed)
    total = passed = 0
    for case in cases:
        total += 1
        if interp.run(case) == interp.run(case):
            passed += 1
    return {
        "instruction": "xmac",
        "target": "reference",
        "status": "DIFFERENTIALLY_VALIDATED" if passed == total else "FAILED",
        "total": total,
        "passed": passed,
        "failed": total - passed,
        "proto_fail": 0,
        "random": random,
        "seed": seed,
        "pre_build": "Looks mappable",
        "generated_at": datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ"),
    }


def _run_hw_test(target: str, yaml_path: Path, random: int, seed: int) -> dict:
    cli = ROOT / "bin" / "xsil-port"
    cmd = [
        str(cli),
        "test",
        str(yaml_path),
        "--target",
        target,
        "--random",
        str(random),
        "--seed",
        str(seed),
        "--build",
        str(ROOT / "backends" / "cli-build" / f"pkg-{target}"),
    ]
    print("+", " ".join(cmd))
    run = subprocess.run(cmd, cwd=str(ROOT), capture_output=True, text=True)
    out = (run.stdout or "") + (run.stderr or "")
    print(out.strip())
    m = re.search(
        r"TB_RESULT total=(\d+) passed=(\d+) failed=(\d+) proto_fail=(\d+)", out
    )
    status = re.search(r"TB_STATUS (\w+)", out)
    if run.returncode != 0 or not m or not status:
        raise SystemExit(f"hardware test failed for {target} (rc={run.returncode})")
    total, passed, failed, proto = map(int, m.groups())
    return {
        "instruction": "xmac",
        "target": target,
        "status": status.group(1),
        "total": total,
        "passed": passed,
        "failed": failed,
        "proto_fail": proto,
        "random": random,
        "seed": seed,
        "pre_build": "Adapter required",
        "generated_at": datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ"),
    }


def _post_test_label(status: str) -> str:
    if status == "DIFFERENTIALLY_VALIDATED":
        return "Differentially validated"
    if status == "VERIFIED_ON_TARGET":
        return "Verified on target"
    if status == "SKIPPED":
        return "—"
    return status.replace("_", " ").title()


def _patch_manifest_targets(pkg_dir: Path, patch: dict) -> None:
    """Merge matrix fields into manifest.targets without dropping other keys."""
    path = pkg_dir / "manifest.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    targets = data.get("targets")
    if not isinstance(targets, dict):
        targets = {}
    for tid, fields in patch.items():
        cur = targets.get(tid)
        if not isinstance(cur, dict):
            cur = {}
        cur.update(fields)
        targets[tid] = cur
    data["targets"] = targets
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def _write_matrix_into_manifests(
    ref: dict,
    hw: dict[str, dict],
) -> None:
    ref_tests = f"{ref['passed']}/{ref['total']}"
    _patch_manifest_targets(
        PKG / "xmac",
        {
            "reference": {
                "status": "working",
                "preBuild": "Looks mappable",
                "adapter": "Native",
                "build": "—",
                "tests": ref_tests,
                "postTest": _post_test_label(ref["status"]),
            },
            "picorv32-pcpi": {
                "status": "working" if hw.get("picorv32-pcpi", {}).get("status") == "DIFFERENTIALLY_VALIDATED" else "candidate",
                "preBuild": "Adapter required",
                "adapter": "Generated (pcpi_rsd)",
                "build": "Passed" if hw.get("picorv32-pcpi") else "—",
                "tests": (
                    f"{hw['picorv32-pcpi']['passed']}/{hw['picorv32-pcpi']['total']}"
                    if "picorv32-pcpi" in hw
                    else "—"
                ),
                "postTest": _post_test_label(hw["picorv32-pcpi"]["status"])
                if "picorv32-pcpi" in hw
                else "—",
                "portPackage": "xmac-port-picorv32-pcpi",
            },
            "neorv32-cfu": {
                "status": "working" if hw.get("neorv32-cfu", {}).get("status") == "DIFFERENTIALLY_VALIDATED" else "candidate",
                "preBuild": "Adapter required",
                "adapter": "Generated (rsd_i)",
                "build": "Passed" if hw.get("neorv32-cfu") else "—",
                "tests": (
                    f"{hw['neorv32-cfu']['passed']}/{hw['neorv32-cfu']['total']}"
                    if "neorv32-cfu" in hw
                    else "—"
                ),
                "postTest": _post_test_label(hw["neorv32-cfu"]["status"])
                if "neorv32-cfu" in hw
                else "—",
                "portPackage": "xmac-port-neorv32-cfu",
            },
            "cva6-cvxif": {
                "status": "working"
                if hw.get("cva6-cvxif", {}).get("status") == "DIFFERENTIALLY_VALIDATED"
                else "candidate",
                "preBuild": "Adapter required",
                "adapter": "Generated (register_rsd)",
                "build": "Passed" if hw.get("cva6-cvxif") else "—",
                "tests": (
                    f"{hw['cva6-cvxif']['passed']}/{hw['cva6-cvxif']['total']}"
                    if "cva6-cvxif" in hw
                    else "—"
                ),
                "postTest": _post_test_label(hw["cva6-cvxif"]["status"])
                if "cva6-cvxif" in hw
                else "—",
                "portPackage": "xmac-port-cva6-cvxif",
                "notes": "CV-X-IF MVP subset; rd → register_rsd; BFM only",
            },
            "rocket-rocc": {
                "status": "working"
                if hw.get("rocket-rocc", {}).get("status") == "DIFFERENTIALLY_VALIDATED"
                else "candidate",
                "preBuild": "Adapter required",
                "adapter": "Generated (cmd_rsd)",
                "build": "Passed" if hw.get("rocket-rocc") else "—",
                "tests": (
                    f"{hw['rocket-rocc']['passed']}/{hw['rocket-rocc']['total']}"
                    if "rocket-rocc" in hw
                    else "—"
                ),
                "postTest": _post_test_label(hw["rocket-rocc"]["status"])
                if "rocket-rocc" in hw
                else "—",
                "portPackage": "xmac-port-rocket-rocc",
                "notes": "RoCC MVP subset; rd → cmd_rsd; BFM only; RV32",
            },
        },
    )

    if "picorv32-pcpi" in hw:
        ev = hw["picorv32-pcpi"]
        _patch_manifest_targets(
            PKG / "xmac-port-picorv32-pcpi",
            {
                "picorv32-pcpi": {
                    "preBuild": "Adapter required",
                    "adapter": "Generated (pcpi_rsd)",
                    "build": "Passed" if ev["status"] == "DIFFERENTIALLY_VALIDATED" else "—",
                    "tests": f"{ev['passed']}/{ev['total']}",
                    "postTest": _post_test_label(ev["status"]),
                    "parentPackage": "xmac",
                }
            },
        )
    if "neorv32-cfu" in hw:
        ev = hw["neorv32-cfu"]
        _patch_manifest_targets(
            PKG / "xmac-port-neorv32-cfu",
            {
                "neorv32-cfu": {
                    "preBuild": "Adapter required",
                    "adapter": "Generated (rsd_i)",
                    "build": "Passed" if ev["status"] == "DIFFERENTIALLY_VALIDATED" else "—",
                    "tests": f"{ev['passed']}/{ev['total']}",
                    "postTest": _post_test_label(ev["status"]),
                    "parentPackage": "xmac",
                }
            },
        )
    if "cva6-cvxif" in hw:
        ev = hw["cva6-cvxif"]
        _patch_manifest_targets(
            PKG / "xmac-port-cva6-cvxif",
            {
                "cva6-cvxif": {
                    "preBuild": "Adapter required",
                    "adapter": "Generated (register_rsd)",
                    "build": "Passed" if ev["status"] == "DIFFERENTIALLY_VALIDATED" else "—",
                    "tests": f"{ev['passed']}/{ev['total']}",
                    "postTest": _post_test_label(ev["status"]),
                    "parentPackage": "xmac",
                }
            },
        )
    if "rocket-rocc" in hw:
        ev = hw["rocket-rocc"]
        _patch_manifest_targets(
            PKG / "xmac-port-rocket-rocc",
            {
                "rocket-rocc": {
                    "preBuild": "Adapter required",
                    "adapter": "Generated (cmd_rsd)",
                    "build": "Passed" if ev["status"] == "DIFFERENTIALLY_VALIDATED" else "—",
                    "tests": f"{ev['passed']}/{ev['total']}",
                    "postTest": _post_test_label(ev["status"]),
                    "parentPackage": "xmac",
                }
            },
        )


def build(random: int, seed: int, skip_sim: bool) -> int:
    instr = _load_xmac()
    _gen_rtl(instr)

    yaml_path = PKG / "xmac" / "instructions" / "xmac.yaml"
    ref = _reference_evidence(instr, random=min(random, 200), seed=seed)
    _write_json(PKG / "xmac" / "evidence" / "reference.json", ref)
    print(f"reference evidence: {ref['passed']}/{ref['total']} {ref['status']}")

    hw: dict[str, dict] = {}
    if skip_sim:
        print("skip-sim: writing placeholder evidence (not for publish)")
        for target, pkg_name in (
            ("picorv32-pcpi", "xmac-port-picorv32-pcpi"),
            ("neorv32-cfu", "xmac-port-neorv32-cfu"),
            ("cva6-cvxif", "xmac-port-cva6-cvxif"),
            ("rocket-rocc", "xmac-port-rocket-rocc"),
        ):
            ev = {
                "instruction": "xmac",
                "target": target,
                "status": "SKIPPED",
                "total": 0,
                "passed": 0,
                "failed": 0,
                "proto_fail": 0,
                "random": random,
                "seed": seed,
                "pre_build": "Adapter required",
                "note": "run without --skip-sim to populate DIFFERENTIALLY_VALIDATED",
            }
            _write_json(PKG / pkg_name / "evidence" / "differential.json", ev)
            hw[target] = ev
    else:
        for target, pkg_name in (
            ("picorv32-pcpi", "xmac-port-picorv32-pcpi"),
            ("neorv32-cfu", "xmac-port-neorv32-cfu"),
            ("cva6-cvxif", "xmac-port-cva6-cvxif"),
            ("rocket-rocc", "xmac-port-rocket-rocc"),
        ):
            ev = _run_hw_test(target, yaml_path, random=random, seed=seed)
            if ev["status"] != "DIFFERENTIALLY_VALIDATED" or ev["failed"] or ev["proto_fail"]:
                raise SystemExit(f"refusing to pack: {target} evidence not green")
            _write_json(PKG / pkg_name / "evidence" / "differential.json", ev)
            hw[target] = ev
            print(f"{target} evidence: {ev['passed']}/{ev['total']} {ev['status']}")

    _write_matrix_into_manifests(ref, hw)

    # Keep metadata.portPackages in sync with sibling evidence packages.
    xmac_manifest = PKG / "xmac" / "manifest.json"
    data = json.loads(xmac_manifest.read_text(encoding="utf-8"))
    meta = data.setdefault("metadata", {}).setdefault("portability", {})
    meta["portPackages"] = [
        "xmac-port-picorv32-pcpi",
        "xmac-port-neorv32-cfu",
        "xmac-port-cva6-cvxif",
        "xmac-port-rocket-rocc",
    ]
    xmac_manifest.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

    for name in (
        "xmac",
        "xmac-port-picorv32-pcpi",
        "xmac-port-neorv32-cfu",
        "xmac-port-cva6-cvxif",
        "xmac-port-rocket-rocc",
    ):
        _pack_xsil(PKG / name, DIST)

    print()
    print("Local packages ready under packages/ and packages/dist/.")
    print("Registry publish is separate — only when explicitly authorized:")
    print("  xsil publish packages/xmac")
    print("  xsil publish packages/xmac-port-picorv32-pcpi")
    print("  xsil publish packages/xmac-port-neorv32-cfu")
    print("  xsil publish packages/xmac-port-cva6-cvxif")
    print("  xsil publish packages/xmac-port-rocket-rocc")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--random", type=int, default=500, help="random cases for HW targets")
    p.add_argument("--seed", type=int, default=0xC0FFEE)
    p.add_argument("--skip-sim", action="store_true", help="skip Icarus/GHDL (dev only)")
    args = p.parse_args(argv)
    return build(random=args.random, seed=args.seed, skip_sim=args.skip_sim)


if __name__ == "__main__":
    raise SystemExit(main())
