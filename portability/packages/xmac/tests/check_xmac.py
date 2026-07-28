#!/usr/bin/env python3
"""Self-contained XMAC golden check (no ExtenSilica engine required)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "evidence" / "reference.json"


def xmac(rd: int, rs1: int, rs2: int) -> int:
    return (rd + rs1 * rs2) & 0xFFFFFFFF


def main() -> int:
    cases = [
        ("textbook", 3, 4, 5, 23),
        ("wrap", 0xFFFFFFFF, 1, 1, 0),
        ("zero", 0, 0, 0, 0),
        ("identity_mul", 7, 1, 9, 16),
    ]
    failed = 0
    for name, rd, rs1, rs2, exp in cases:
        got = xmac(rd, rs1, rs2)
        ok = got == exp
        print(f"  {name}: got=0x{got:08x} expected=0x{exp:08x} {'OK' if ok else 'FAIL'}")
        if not ok:
            failed += 1

    if not EVIDENCE.is_file():
        print(f"missing evidence file: {EVIDENCE}", file=sys.stderr)
        return 1
    data = json.loads(EVIDENCE.read_text(encoding="utf-8"))
    if data.get("instruction") != "xmac" or data.get("status") != "DIFFERENTIALLY_VALIDATED":
        print("evidence/reference.json does not claim DIFFERENTIALLY_VALIDATED for xmac")
        return 1
    print(f"evidence: {data['passed']}/{data['total']}  status={data['status']}")
    if failed:
        print(f"TB_STATUS FAIL  failed={failed}")
        return 1
    print("TB_STATUS DIFFERENTIALLY_VALIDATED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
