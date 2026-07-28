"""Shared MVP instruction set for the portability PoC runners."""

from __future__ import annotations

from pathlib import Path

from xsil_sem import load_instruction

ROOT = Path(__file__).resolve().parent.parent
INSTRUCTION_FILES = (
    "xmac.yaml",
    "xroladd.yaml",
    "clz.yaml",  # external: RISC-V Zbb semantics
)


def load_mvp_instructions():
    return [
        load_instruction(ROOT / "instructions" / name)
        for name in INSTRUCTION_FILES
    ]
