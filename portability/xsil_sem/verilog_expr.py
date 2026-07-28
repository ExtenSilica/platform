"""Compile an XSIL expression tree to a Verilog expression string.

The datapath is derived from the same IR the reference interpreter executes.
Backends must not hand-write instruction arithmetic.
"""

from __future__ import annotations

from typing import Any, Dict


class VerilogGenError(Exception):
    pass


def _bin(op: str, a: str, b: str) -> str:
    return f"({a} {op} {b})"


def to_verilog(node: Any, env: Dict[str, str], xlen: int = 32) -> str:
    """``env`` maps operand role -> Verilog signal name (e.g. rd -> pcpi_rsd_q)."""
    if not isinstance(node, dict) or len(node) != 1:
        raise VerilogGenError(f"bad node: {node!r}")

    (op, arg), = node.items()

    if op == "read":
        if arg not in env:
            raise VerilogGenError(f"read of unbound operand {arg!r}")
        return env[arg]

    if op == "const":
        return f"{xlen}'d{int(arg)}"

    if op == "slice":
        value = to_verilog(arg["value"], env, xlen)
        hi, lo = int(arg["hi"]), int(arg["lo"])
        return f"({value}[{hi}:{lo}])"

    if op in ("sext", "zext"):
        raise VerilogGenError(f"{op} not yet emitted for PCPI MVP datapath")

    if op in ("add", "sub", "mul", "and", "or", "xor"):
        if not isinstance(arg, list) or len(arg) != 2:
            raise VerilogGenError(f"{op} expects 2 args")
        a = to_verilog(arg[0], env, xlen)
        b = to_verilog(arg[1], env, xlen)
        sym = {"add": "+", "sub": "-", "mul": "*", "and": "&", "or": "|", "xor": "^"}[op]
        # Force xlen-bit result (mul naturally wider in Verilog).
        return f"(({a}) {sym} ({b}))"

    if op == "rotl":
        a = to_verilog(arg[0], env, xlen)
        b = to_verilog(arg[1], env, xlen)
        # Variable rotate; amount already sliced to [4:0] by the IR when needed.
        return (
            f"((({a}) << (({b}) % {xlen})) | "
            f"(({a}) >> (({xlen} - (({b}) % {xlen})) % {xlen})))"
        )

    if op == "rotr":
        a = to_verilog(arg[0], env, xlen)
        b = to_verilog(arg[1], env, xlen)
        return (
            f"((({a}) >> (({b}) % {xlen})) | "
            f"(({a}) << (({xlen} - (({b}) % {xlen})) % {xlen})))"
        )

    if op == "not":
        return f"(~({to_verilog(arg[0], env, xlen)}))"

    if op == "neg":
        return f"(-({to_verilog(arg[0], env, xlen)}))"

    if op in ("shl", "shrl", "shra"):
        a = to_verilog(arg[0], env, xlen)
        b = to_verilog(arg[1], env, xlen)
        if op == "shl":
            return f"(({a}) << (({b}) % {xlen}))"
        if op == "shrl":
            return f"(({a}) >> (({b}) % {xlen}))"
        return f"($signed({a}) >>> (({b}) % {xlen}))"

    if op == "select":
        c = to_verilog(arg[0], env, xlen)
        a = to_verilog(arg[1], env, xlen)
        b = to_verilog(arg[2], env, xlen)
        return f"((({c}) != 0) ? ({a}) : ({b}))"

    if op == "clz":
        if not isinstance(arg, list) or len(arg) != 1:
            raise VerilogGenError("clz expects 1 arg")
        return f"xsil_clz({to_verilog(arg[0], env, xlen)})"

    if op == "ctz":
        if not isinstance(arg, list) or len(arg) != 1:
            raise VerilogGenError("ctz expects 1 arg")
        return f"xsil_ctz({to_verilog(arg[0], env, xlen)})"

    if op == "popcount":
        if not isinstance(arg, list) or len(arg) != 1:
            raise VerilogGenError("popcount expects 1 arg")
        return f"xsil_popcount({to_verilog(arg[0], env, xlen)})"

    raise VerilogGenError(f"no Verilog emitter for op {op!r} (PCPI MVP subset)")
