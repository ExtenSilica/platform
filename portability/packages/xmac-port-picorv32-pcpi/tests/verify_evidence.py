#!/usr/bin/env python3
"""Verify frozen differential evidence for an XMAC port package."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "evidence" / "differential.json"
MANIFEST = ROOT / "manifest.json"


def main() -> int:
    if not EVIDENCE.is_file():
        print(f"missing {EVIDENCE}", file=sys.stderr)
        return 1
    data = json.loads(EVIDENCE.read_text(encoding="utf-8"))
    meta = json.loads(MANIFEST.read_text(encoding="utf-8"))
    port = meta["metadata"]["portability"]
    target = port["target"]

    if data.get("instruction") != "xmac":
        print("evidence instruction mismatch", file=sys.stderr)
        return 1
    if data.get("target") != target:
        print(f"evidence target {data.get('target')!r} != {target!r}", file=sys.stderr)
        return 1
    if data.get("status") != "DIFFERENTIALLY_VALIDATED":
        print(f"evidence status is {data.get('status')!r}, not DIFFERENTIALLY_VALIDATED")
        return 1
    if int(data.get("failed", 1)) != 0 or int(data.get("proto_fail", 1)) != 0:
        print("evidence reports failures")
        return 1

    rtl = ROOT / port["rtl"]
    if not rtl.is_file():
        print(f"missing RTL artifact: {rtl}", file=sys.stderr)
        return 1

    print(
        f"{meta['name']}: target={target}  "
        f"{data['passed']}/{data['total']}  status={data['status']}  "
        f"preBuild={data.get('pre_build')}  seed=0x{int(data.get('seed', 0)):x}"
    )

    if os.environ.get("XSIL_LIVE") == "1":
        print("XSIL_LIVE=1: re-run via portability engine if available…")
        port_root = Path(os.environ.get("XSIL_PORTABILITY_ROOT", ""))
        if not port_root.is_dir():
            # packages/<name>/tests → packages → portability
            port_root = ROOT.parents[1]
        cli = port_root / "bin" / "xsil-port"
        yaml = port_root / "packages" / "xmac" / "instructions" / "xmac.yaml"
        if not cli.is_file() or not yaml.is_file():
            print("live tools not found; evidence-only check still OK")
            return 0
        import subprocess

        cmd = [
            str(cli),
            "test",
            str(yaml),
            "--target",
            target,
            "--random",
            str(int(data.get("random", 200))),
            "--seed",
            str(int(data.get("seed", 0xC0FFEE))),
        ]
        print("+", " ".join(cmd))
        r = subprocess.run(cmd, cwd=str(port_root))
        return r.returncode

    print("TB_STATUS DIFFERENTIALLY_VALIDATED (frozen evidence)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
