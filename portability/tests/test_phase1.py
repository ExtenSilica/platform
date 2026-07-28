"""Unit tests for the Phase-1 semantic engine."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from xsil_sem import (  # noqa: E402
    Interpreter,
    SchemaError,
    expr,
    load_instruction,
    run_differential,
)
from xsil_sem.schema import from_dict, validate  # noqa: E402


def test_xmac_textbook():
    instr = load_instruction(ROOT / "instructions" / "xmac.yaml")
    assert Interpreter(instr).run_scalar({"rd": 3, "rs1": 4, "rs2": 5}) == 23


def test_xmac_wrap():
    instr = load_instruction(ROOT / "instructions" / "xmac.yaml")
    assert Interpreter(instr).run_scalar(
        {"rd": 0xFFFFFFFF, "rs1": 1, "rs2": 1}
    ) == 0


def test_xroladd_uses_only_low_5_bits():
    instr = load_instruction(ROOT / "instructions" / "xroladd.yaml")
    interp = Interpreter(instr)
    a = interp.run_scalar({"rd": 0, "rs1": 0x80000001, "rs2": 1})
    b = interp.run_scalar({"rd": 0, "rs1": 0x80000001, "rs2": 0x21})
    assert a == b == 0x00000003


def test_differential_agrees_with_independent_oracle():
    instr = load_instruction(ROOT / "instructions" / "xmac.yaml")

    def oracle(inputs):
        return (inputs["rd"] + inputs["rs1"] * inputs["rs2"]) & 0xFFFFFFFF

    report = run_differential(instr, oracle, "oracle", num_random=500)
    assert report.ok
    assert report.total >= 500


def test_differential_rejects_buggy_target():
    instr = load_instruction(ROOT / "instructions" / "xmac.yaml")

    def buggy(inputs):
        return (inputs["rd"] + inputs["rs1"] * inputs["rs2"] + 1) & 0xFFFFFFFF

    report = run_differential(instr, buggy, "buggy", num_random=100)
    assert not report.ok
    assert report.failed > 0


def test_mvp_rejects_memory_effect():
    raw = {
        "instruction": "bad",
        "xlen": 32,
        "encoding": {"length": 32, "mask": 0x7F, "match": 0x0B},
        "operands": {"inputs": ["rs1"], "outputs": ["rd"]},
        "effects": {"memory": "read"},
        "semantics": {"expression": {"read": "rs1"}},
    }
    with pytest.raises(SchemaError, match="memory"):
        validate(from_dict(raw))


def test_mvp_rejects_undeclared_operand():
    raw = {
        "instruction": "bad",
        "xlen": 32,
        "encoding": {"length": 32, "mask": 0x7F, "match": 0x0B},
        "operands": {"inputs": ["rs1"], "outputs": ["rd"]},
        "semantics": {"expression": {"add": [{"read": "rs1"}, {"read": "rs2"}]}},
    }
    with pytest.raises(SchemaError, match="undeclared"):
        validate(from_dict(raw))


def test_corpus_loads_and_evaluates():
    for path in sorted((ROOT / "corpus").glob("*.yaml")):
        instr = load_instruction(path)
        env = {role: 0 for role in instr.inputs}
        out = Interpreter(instr).run(env)
        assert instr.output in out
        assert 0 <= out[instr.output] <= expr.mask(instr.xlen)


def test_op_set_covers_corpus_needs():
    # Guard against accidentally shrinking the IR below what the corpus needs.
    needed = {
        "add", "mul", "rotl", "slice", "read", "select",
        "sat_add_s", "clz", "maxs",
    }
    assert needed.issubset(set(expr.op_names()))


def test_pcpi_compat_is_adapter_required():
    from xsil_sem.compat import assess, load_target

    instr = load_instruction(ROOT / "instructions" / "xmac.yaml")
    target = load_target(ROOT / "targets" / "picorv32-pcpi.yaml")
    result = assess(instr, target)
    assert result.status == "Adapter required"
    assert any("rd" in r for r in result.reasons)


def test_verilog_emitter_for_xmac():
    from xsil_sem.verilog_expr import to_verilog

    instr = load_instruction(ROOT / "instructions" / "xmac.yaml")
    v = to_verilog(
        instr.output_expr,
        {"rd": "rsd_q", "rs1": "rs1_q", "rs2": "rs2_q"},
        32,
    )
    assert "rsd_q" in v and "rs1_q" in v and "rs2_q" in v
    assert "*" in v and "+" in v
