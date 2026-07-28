"""Formal target capability model (experimental, schema_version=1).

Stable fields used by ``check`` / ``port`` / future backends. This is deliberately
smaller than a full core description — only what is needed to compare

    what the instruction requires
    versus
    what the interface supplies

Target maturity (``status``) is separate from pre-build instruction assessment:

  target.status          → working | candidate | not_assessed
  assess(instr, target)  → Looks mappable | Adapter required | Unsupported
                           capability | Not assessed | Candidate

Never emit Compatible from this layer.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml

SCHEMA_VERSION = 1
ALLOWED_TARGET_STATUS = frozenset({"working", "candidate", "not_assessed"})
ALLOWED_EXCEPTIONS = frozenset({"none", "limited", "full"})
ALLOWED_LANGUAGES = frozenset({"verilog", "vhdl", "none"})
KNOWN_OPERAND_ROLES = frozenset({"rd", "rs1", "rs2", "rs3"})


class TargetSchemaError(Exception):
    """Raised when a target YAML violates the capability schema."""


@dataclass
class TargetOperands:
    inputs_native: List[str] = field(default_factory=list)
    inputs_adapter: List[str] = field(default_factory=list)
    outputs: List[str] = field(default_factory=list)


@dataclass
class TargetInterface:
    name: str
    operands: TargetOperands
    variable_latency: bool = False
    stall: bool = False
    ready: bool = False
    memory_access: bool = False
    exceptions: str = "none"
    custom_state: bool = False
    max_ack_cycles_without_wait: Optional[int] = None
    start_is_pulse: bool = False


@dataclass
class TargetImplementation:
    language: str = "none"
    adapter_backend: Optional[str] = None
    reference_core: Optional[str] = None
    entity: Optional[str] = None


@dataclass
class Target:
    """Validated target capability document."""

    id: str
    description: str
    status: str
    xlen: List[int]
    interface: TargetInterface
    implementation: TargetImplementation
    adapter_notes: str = ""
    schema_version: int = SCHEMA_VERSION
    path: Optional[Path] = None

    def to_dict(self) -> Dict[str, Any]:
        """Legacy dict shape consumed by older call sites / JSON metadata."""
        return {
            "target": self.id,
            "description": self.description,
            "status": self.status,
            "schema_version": self.schema_version,
            "architecture": {"xlen": list(self.xlen)},
            "interface": {
                "name": self.interface.name,
                "operands": {
                    "inputs_native": list(self.interface.operands.inputs_native),
                    "inputs_adapter": list(self.interface.operands.inputs_adapter),
                    "outputs": list(self.interface.operands.outputs),
                },
                "variable_latency": self.interface.variable_latency,
                "stall": self.interface.stall,
                "ready": self.interface.ready,
                "memory_access": self.interface.memory_access,
                "exceptions": self.interface.exceptions,
                "custom_state": self.interface.custom_state,
                "max_ack_cycles_without_wait": self.interface.max_ack_cycles_without_wait,
                "start_is_pulse": self.interface.start_is_pulse,
            },
            "implementation": {
                "language": self.implementation.language,
                "adapter_backend": self.implementation.adapter_backend,
                "reference_core": self.implementation.reference_core,
                "entity": self.implementation.entity,
            },
            "adapter_notes": self.adapter_notes,
        }


def _require(raw: Dict[str, Any], key: str, ctx: str) -> Any:
    if key not in raw:
        raise TargetSchemaError(f"{ctx}: missing required field {key!r}")
    return raw[key]


def _as_bool(value: Any, ctx: str) -> bool:
    if isinstance(value, bool):
        return value
    raise TargetSchemaError(f"{ctx}: expected bool, got {type(value).__name__}")


def _as_roles(value: Any, ctx: str) -> List[str]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise TargetSchemaError(f"{ctx}: expected a list of operand roles")
    out = []
    for item in value:
        if not isinstance(item, str):
            raise TargetSchemaError(f"{ctx}: operand role must be a string")
        if item not in KNOWN_OPERAND_ROLES:
            raise TargetSchemaError(
                f"{ctx}: unknown operand role {item!r} "
                f"(known: {sorted(KNOWN_OPERAND_ROLES)})"
            )
        out.append(item)
    return out


def from_dict(raw: Dict[str, Any], path: Optional[Path] = None) -> Target:
    if not isinstance(raw, dict):
        raise TargetSchemaError("top-level document must be a mapping")

    version = int(raw.get("schema_version", SCHEMA_VERSION))
    if version != SCHEMA_VERSION:
        raise TargetSchemaError(
            f"unsupported schema_version {version} (expected {SCHEMA_VERSION})"
        )

    tid = str(_require(raw, "target", "target"))
    description = str(raw.get("description", ""))
    status = str(raw.get("status", "working"))
    if status not in ALLOWED_TARGET_STATUS:
        raise TargetSchemaError(
            f"{tid}: status must be one of {sorted(ALLOWED_TARGET_STATUS)}, got {status!r}"
        )

    arch = _require(raw, "architecture", tid)
    xlen = arch.get("xlen")
    if not isinstance(xlen, list) or not xlen or not all(isinstance(x, int) for x in xlen):
        raise TargetSchemaError(f"{tid}: architecture.xlen must be a non-empty list of ints")

    iface_raw = _require(raw, "interface", tid)
    ops_raw = iface_raw.get("operands", {}) or {}
    operands = TargetOperands(
        inputs_native=_as_roles(ops_raw.get("inputs_native", []), f"{tid}.inputs_native"),
        inputs_adapter=_as_roles(ops_raw.get("inputs_adapter", []), f"{tid}.inputs_adapter"),
        outputs=_as_roles(ops_raw.get("outputs", ["rd"]), f"{tid}.outputs"),
    )
    if not operands.outputs:
        raise TargetSchemaError(f"{tid}: interface.operands.outputs must not be empty")

    exceptions = str(iface_raw.get("exceptions", "none"))
    if exceptions not in ALLOWED_EXCEPTIONS:
        raise TargetSchemaError(
            f"{tid}: exceptions must be one of {sorted(ALLOWED_EXCEPTIONS)}"
        )

    max_ack = iface_raw.get("max_ack_cycles_without_wait")
    if max_ack is not None and not isinstance(max_ack, int):
        raise TargetSchemaError(f"{tid}: max_ack_cycles_without_wait must be int or null")

    interface = TargetInterface(
        name=str(_require(iface_raw, "name", f"{tid}.interface")),
        operands=operands,
        variable_latency=_as_bool(iface_raw.get("variable_latency", False), f"{tid}.variable_latency"),
        stall=_as_bool(iface_raw.get("stall", False), f"{tid}.stall"),
        ready=_as_bool(iface_raw.get("ready", False), f"{tid}.ready"),
        memory_access=_as_bool(iface_raw.get("memory_access", False), f"{tid}.memory_access"),
        exceptions=exceptions,
        custom_state=_as_bool(iface_raw.get("custom_state", False), f"{tid}.custom_state"),
        max_ack_cycles_without_wait=max_ack,
        start_is_pulse=_as_bool(iface_raw.get("start_is_pulse", False), f"{tid}.start_is_pulse"),
    )

    impl_raw = raw.get("implementation", {}) or {}
    language = str(impl_raw.get("language", "none"))
    if language not in ALLOWED_LANGUAGES:
        raise TargetSchemaError(
            f"{tid}: language must be one of {sorted(ALLOWED_LANGUAGES)}"
        )
    implementation = TargetImplementation(
        language=language,
        adapter_backend=impl_raw.get("adapter_backend"),
        reference_core=impl_raw.get("reference_core"),
        entity=impl_raw.get("entity"),
    )

    if status == "working" and not implementation.adapter_backend:
        raise TargetSchemaError(
            f"{tid}: status=working requires implementation.adapter_backend"
        )

    return Target(
        id=tid,
        description=description,
        status=status,
        xlen=list(xlen),
        interface=interface,
        implementation=implementation,
        adapter_notes=str(raw.get("adapter_notes", "")),
        schema_version=version,
        path=path,
    )


def load_target_doc(path: str | Path) -> Target:
    path = Path(path)
    with path.open("r", encoding="utf-8") as fh:
        raw = yaml.safe_load(fh)
    return from_dict(raw, path=path)


def list_target_files(targets_dir: str | Path) -> List[Path]:
    d = Path(targets_dir)
    return sorted(d.glob("*.yaml")) + sorted(d.glob("*.yml"))


def load_all_targets(targets_dir: str | Path) -> List[Target]:
    return [load_target_doc(p) for p in list_target_files(targets_dir)]
