import type { TargetKind } from "@/lib/types";

export const SUPPORT_GROUPS: Array<{
  id: string;
  title: string;
  description: string;
  kinds: TargetKind[];
}> = [
  {
    id: "implementations",
    title: "Implementations",
    description: "Core integration through an explicit backend or interface.",
    kinds: ["core"],
  },
  {
    id: "simulation",
    title: "Simulation",
    description: "Executable models in simulators and emulators.",
    kinds: ["simulator", "emulator"],
  },
  {
    id: "toolchains",
    title: "Toolchains",
    description: "Assembler, compiler, and code-generation support.",
    kinds: ["toolchain"],
  },
  {
    id: "hardware-evidence",
    title: "Hardware evidence",
    description: "Reproducible execution captured from a physical board.",
    kinds: ["board"],
  },
  {
    id: "reference",
    title: "Reference",
    description: "A semantic model used as the comparison oracle.",
    kinds: ["reference"],
  },
  {
    id: "other-support",
    title: "Other support",
    description: "Verified support that does not fit another category.",
    kinds: ["other"],
  },
];

const DEFAULT_BACKENDS: Record<string, { slug: string; name: string }> = {
  cva6: { slug: "cvxif", name: "CV-X-IF" },
  neorv32: { slug: "cfu", name: "CFU" },
  picorv32: { slug: "pcpi", name: "PCPI" },
  rocket: { slug: "rocc", name: "RoCC" },
  reference: { slug: "semantic-model", name: "Semantic model" },
};

export function defaultBackendForTarget(targetSlug: string) {
  return DEFAULT_BACKENDS[targetSlug] ?? { slug: "default", name: "" };
}

export function supportAnchor(targetSlug: string, backendSlug = "default"): string {
  return `support-${targetSlug}-${backendSlug}`;
}

export function supportAction(kind: TargetKind): string {
  switch (kind) {
    case "core":
      return "Implement it";
    case "simulator":
    case "emulator":
    case "toolchain":
      return "Add support";
    case "board":
      return "Run on hardware";
    case "reference":
      return "Validate model";
    default:
      return "Contribute";
  }
}

const LEGACY_PORT_ARTIFACTS: Record<string, { extensionSlug: string; anchor: string }> = {
  "xmac-port-cva6-cvxif": { extensionSlug: "xmac", anchor: supportAnchor("cva6", "cvxif") },
  "xmac-port-neorv32-cfu": { extensionSlug: "xmac", anchor: supportAnchor("neorv32", "cfu") },
  "xmac-port-picorv32-pcpi": { extensionSlug: "xmac", anchor: supportAnchor("picorv32", "pcpi") },
  "xmac-port-rocket-rocc": { extensionSlug: "xmac", anchor: supportAnchor("rocket", "rocc") },
};

export function legacyPortArtifactDestination(slug: string) {
  return LEGACY_PORT_ARTIFACTS[slug] ?? null;
}
