"""XSIL semantic engine (experimental).

Core-independent description, reference execution and differential validation of
simple RV32 register-to-register custom instructions. This is the engine behind
the ExtenSilica portability proof-of-concept.
"""

from .schema import Instruction, load_instruction, from_dict, validate, SchemaError
from .interpreter import Interpreter
from .diff_harness import run_differential, generate_cases, Report, Mismatch
from . import expr

__all__ = [
    "Instruction",
    "load_instruction",
    "from_dict",
    "validate",
    "SchemaError",
    "Interpreter",
    "run_differential",
    "generate_cases",
    "Report",
    "Mismatch",
    "expr",
]

__version__ = "0.0.1-experimental"
