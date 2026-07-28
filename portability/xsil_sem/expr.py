"""Neutral, core-independent expression IR for XSIL instruction semantics.

This is deliberately NOT an HDL. It describes the *pure function* that a custom
instruction computes over its register operands, restricted to the MVP class:

    output = f(inputs)     # no memory, no CSR, no persistent state

Every operation has fully-defined, bit-exact semantics on an ``xlen``-bit machine
word (default 32). The reference interpreter and every hardware backend MUST agree
with the results produced here — this module is the single source of truth for
behavior.

Expression nodes are plain dicts with exactly one key (the op name):

    {"read": "rs1"}                      # value of an input operand
    {"const": 5}                         # integer literal (masked to xlen)
    {"add": [<expr>, <expr>]}            # list children -> positional args
    {"slice": {"value": <expr>,          # dict child -> named params
               "hi": 4, "lo": 0}}

The op set below was chosen bottom-up from a corpus of real custom instructions
(MAC/DSP, bit manipulation, saturation, comparison, selection) so the abstraction
is not tailored to a single example. It is still intentionally small so that it
stays verifiable and synthesizable.
"""

from __future__ import annotations

from typing import Any, Callable, Dict


class SemanticError(Exception):
    """Raised when an expression is malformed or references unknown operands."""


def mask(xlen: int) -> int:
    return (1 << xlen) - 1


def to_signed(value: int, xlen: int) -> int:
    value &= mask(xlen)
    if value >> (xlen - 1):
        return value - (1 << xlen)
    return value


def to_unsigned(value: int, xlen: int) -> int:
    return value & mask(xlen)


# --- individual operation implementations --------------------------------------
#
# Each op receives already-evaluated integer arguments (unsigned, xlen-bit) plus
# the xlen. Results are returned unsigned and xlen-bit; the evaluator masks again
# defensively. Shift/rotate amounts are taken modulo xlen (RISC-V convention).


def _add(a, b, xlen):
    return (a + b) & mask(xlen)


def _sub(a, b, xlen):
    return (a - b) & mask(xlen)


def _mul(a, b, xlen):
    return (a * b) & mask(xlen)


def _mulh(a, b, xlen):
    return ((to_signed(a, xlen) * to_signed(b, xlen)) >> xlen) & mask(xlen)


def _mulhu(a, b, xlen):
    return ((a * b) >> xlen) & mask(xlen)


def _and(a, b, xlen):
    return (a & b) & mask(xlen)


def _or(a, b, xlen):
    return (a | b) & mask(xlen)


def _xor(a, b, xlen):
    return (a ^ b) & mask(xlen)


def _not(a, xlen):
    return (~a) & mask(xlen)


def _neg(a, xlen):
    return (-a) & mask(xlen)


def _shl(a, b, xlen):
    return (a << (b % xlen)) & mask(xlen)


def _shrl(a, b, xlen):
    return (a & mask(xlen)) >> (b % xlen)


def _shra(a, b, xlen):
    return (to_signed(a, xlen) >> (b % xlen)) & mask(xlen)


def _rotl(a, b, xlen):
    s = b % xlen
    a &= mask(xlen)
    return ((a << s) | (a >> (xlen - s))) & mask(xlen) if s else a


def _rotr(a, b, xlen):
    s = b % xlen
    a &= mask(xlen)
    return ((a >> s) | (a << (xlen - s))) & mask(xlen) if s else a


def _eq(a, b, xlen):
    return 1 if (a & mask(xlen)) == (b & mask(xlen)) else 0


def _ne(a, b, xlen):
    return 1 if (a & mask(xlen)) != (b & mask(xlen)) else 0


def _lt(a, b, xlen):
    return 1 if to_signed(a, xlen) < to_signed(b, xlen) else 0


def _ltu(a, b, xlen):
    return 1 if (a & mask(xlen)) < (b & mask(xlen)) else 0


def _ge(a, b, xlen):
    return 1 if to_signed(a, xlen) >= to_signed(b, xlen) else 0


def _geu(a, b, xlen):
    return 1 if (a & mask(xlen)) >= (b & mask(xlen)) else 0


def _mins(a, b, xlen):
    return a if to_signed(a, xlen) < to_signed(b, xlen) else b


def _minu(a, b, xlen):
    return a if (a & mask(xlen)) < (b & mask(xlen)) else b


def _maxs(a, b, xlen):
    return a if to_signed(a, xlen) > to_signed(b, xlen) else b


def _maxu(a, b, xlen):
    return a if (a & mask(xlen)) > (b & mask(xlen)) else b


def _select(cond, a, b, xlen):
    return a & mask(xlen) if (cond & mask(xlen)) != 0 else b & mask(xlen)


def _clz(a, xlen):
    a &= mask(xlen)
    if a == 0:
        return xlen
    count = 0
    bit = 1 << (xlen - 1)
    while bit and not (a & bit):
        count += 1
        bit >>= 1
    return count


def _ctz(a, xlen):
    a &= mask(xlen)
    if a == 0:
        return xlen
    count = 0
    while not (a & 1):
        count += 1
        a >>= 1
    return count


def _popcount(a, xlen):
    return bin(a & mask(xlen)).count("1")


def _sat_add_s(a, b, xlen):
    s = to_signed(a, xlen) + to_signed(b, xlen)
    lo = -(1 << (xlen - 1))
    hi = (1 << (xlen - 1)) - 1
    if s > hi:
        s = hi
    elif s < lo:
        s = lo
    return to_unsigned(s, xlen)


def _sat_add_u(a, b, xlen):
    s = (a & mask(xlen)) + (b & mask(xlen))
    return s if s <= mask(xlen) else mask(xlen)


def _sat_sub_u(a, b, xlen):
    a &= mask(xlen)
    b &= mask(xlen)
    return (a - b) if a >= b else 0


# arity-checked table of positional (list-argument) operations
_POSITIONAL: Dict[str, tuple[int, Callable]] = {
    "add": (2, _add),
    "sub": (2, _sub),
    "mul": (2, _mul),
    "mulh": (2, _mulh),
    "mulhu": (2, _mulhu),
    "and": (2, _and),
    "or": (2, _or),
    "xor": (2, _xor),
    "not": (1, _not),
    "neg": (1, _neg),
    "shl": (2, _shl),
    "shrl": (2, _shrl),
    "shra": (2, _shra),
    "rotl": (2, _rotl),
    "rotr": (2, _rotr),
    "eq": (2, _eq),
    "ne": (2, _ne),
    "lt": (2, _lt),
    "ltu": (2, _ltu),
    "ge": (2, _ge),
    "geu": (2, _geu),
    "mins": (2, _mins),
    "minu": (2, _minu),
    "maxs": (2, _maxs),
    "maxu": (2, _maxu),
    "select": (3, _select),
    "clz": (1, _clz),
    "ctz": (1, _ctz),
    "popcount": (1, _popcount),
    "sat_add_s": (2, _sat_add_s),
    "sat_add_u": (2, _sat_add_u),
    "sat_sub_u": (2, _sat_sub_u),
}


def op_names() -> list[str]:
    """All supported op names (for documentation / validation error messages)."""
    return sorted(list(_POSITIONAL.keys()) + ["read", "const", "slice", "sext", "zext"])


def evaluate(node: Any, env: Dict[str, int], xlen: int) -> int:
    """Evaluate an expression node against ``env`` (operand name -> unsigned value)."""
    if not isinstance(node, dict) or len(node) != 1:
        raise SemanticError(
            f"expression node must be a single-key dict, got: {node!r}"
        )

    (op, arg), = node.items()

    if op == "read":
        if not isinstance(arg, str):
            raise SemanticError(f"'read' expects an operand name, got {arg!r}")
        if arg not in env:
            raise SemanticError(f"'read' references unknown operand {arg!r}")
        return env[arg] & mask(xlen)

    if op == "const":
        if not isinstance(arg, int):
            raise SemanticError(f"'const' expects an integer, got {arg!r}")
        return arg & mask(xlen)

    if op == "slice":
        _require_params(op, arg, {"value", "hi", "lo"})
        value = evaluate(arg["value"], env, xlen)
        hi, lo = arg["hi"], arg["lo"]
        if not (0 <= lo <= hi < xlen):
            raise SemanticError(f"slice bounds out of range: hi={hi} lo={lo}")
        width = hi - lo + 1
        return (value >> lo) & ((1 << width) - 1)

    if op in ("sext", "zext"):
        _require_params(op, arg, {"value", "from"})
        value = evaluate(arg["value"], env, xlen)
        frm = arg["from"]
        if not (1 <= frm <= xlen):
            raise SemanticError(f"{op} 'from' width out of range: {frm}")
        value &= (1 << frm) - 1
        if op == "sext" and (value >> (frm - 1)):
            value |= ~((1 << frm) - 1)
        return value & mask(xlen)

    if op in _POSITIONAL:
        arity, fn = _POSITIONAL[op]
        if not isinstance(arg, list):
            raise SemanticError(f"'{op}' expects a list of {arity} argument(s)")
        if len(arg) != arity:
            raise SemanticError(
                f"'{op}' expects {arity} argument(s), got {len(arg)}"
            )
        args = [evaluate(child, env, xlen) for child in arg]
        return fn(*args, xlen) & mask(xlen)

    raise SemanticError(
        f"unknown operation {op!r}; supported: {', '.join(op_names())}"
    )


def _require_params(op: str, arg: Any, keys: set[str]) -> None:
    if not isinstance(arg, dict):
        raise SemanticError(f"'{op}' expects a parameter mapping with keys {sorted(keys)}")
    missing = keys - set(arg)
    if missing:
        raise SemanticError(f"'{op}' missing parameter(s): {sorted(missing)}")


def referenced_operands(node: Any) -> set[str]:
    """Collect all operand names read by an expression (for validation)."""
    found: set[str] = set()

    def walk(n: Any) -> None:
        if isinstance(n, dict) and len(n) == 1:
            (op, arg), = n.items()
            if op == "read" and isinstance(arg, str):
                found.add(arg)
            elif isinstance(arg, list):
                for c in arg:
                    walk(c)
            elif isinstance(arg, dict):
                for v in arg.values():
                    walk(v)

    walk(node)
    return found
