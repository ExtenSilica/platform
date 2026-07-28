"""Compile an XSIL expression tree to a VHDL expression (std_logic_vector).

Used by the NEORV32 CFU backend. Arithmetic comes from the IR — not hand-written
per instruction.
"""

from __future__ import annotations

from typing import Any, Dict


class VhdlGenError(Exception):
    pass


def to_vhdl(node: Any, env: Dict[str, str], xlen: int = 32) -> str:
    """``env`` maps operand role -> VHDL signal name."""
    if not isinstance(node, dict) or len(node) != 1:
        raise VhdlGenError(f"bad node: {node!r}")

    (op, arg), = node.items()

    if op == "read":
        if arg not in env:
            raise VhdlGenError(f"read of unbound operand {arg!r}")
        return env[arg]

    if op == "const":
        return f"std_ulogic_vector(to_unsigned({int(arg)}, {xlen}))"

    if op == "slice":
        value = to_vhdl(arg["value"], env, xlen)
        hi, lo = int(arg["hi"]), int(arg["lo"])
        # Zero-extend the slice back to xlen for use in arithmetic.
        width = hi - lo + 1
        return (
            f"std_ulogic_vector(resize(unsigned({value}({hi} downto {lo})), {xlen}))"
        )

    if op in ("add", "sub", "mul", "and", "or", "xor"):
        if not isinstance(arg, list) or len(arg) != 2:
            raise VhdlGenError(f"{op} expects 2 args")
        a = to_vhdl(arg[0], env, xlen)
        b = to_vhdl(arg[1], env, xlen)
        if op == "add":
            return f"std_ulogic_vector(resize(unsigned({a}) + unsigned({b}), {xlen}))"
        if op == "sub":
            return f"std_ulogic_vector(resize(unsigned({a}) - unsigned({b}), {xlen}))"
        if op == "mul":
            return f"std_ulogic_vector(resize(unsigned({a}) * unsigned({b}), {xlen}))"
        if op == "and":
            return f"({a} and {b})"
        if op == "or":
            return f"({a} or {b})"
        return f"({a} xor {b})"

    if op == "rotl":
        a = to_vhdl(arg[0], env, xlen)
        b = to_vhdl(arg[1], env, xlen)
        return f"xsil_rotl({a}, {b})"

    if op == "rotr":
        a = to_vhdl(arg[0], env, xlen)
        b = to_vhdl(arg[1], env, xlen)
        return f"xsil_rotr({a}, {b})"

    if op == "not":
        return f"(not {to_vhdl(arg[0], env, xlen)})"

    if op == "select":
        c = to_vhdl(arg[0], env, xlen)
        a = to_vhdl(arg[1], env, xlen)
        b = to_vhdl(arg[2], env, xlen)
        return f"( {a} ) when (unsigned({c}) /= 0) else ( {b} )"

    raise VhdlGenError(f"no VHDL emitter for op {op!r} (CFU MVP subset)")
