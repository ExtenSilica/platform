import { gunzipSync } from "fflate";

export interface XsilManifest {
  name?: string;
  version?: string;
  description?: string;
  author?: string;
  license?: string;
  repository?: string;
  homepage?: string;
  isa?: string;
  targets?: string | string[] | Record<string, unknown>;
  entry?: string;
  toolchain?: string | { name?: string; version?: string } | Record<string, unknown>;
  readme?: string;
  keywords?: string[];
  checksums?: { payload?: string; archive?: string };
  /** Optional evaluation evidence (HTTPS links + optional digests). Echoed as `Version.evidence` on the registry. */
  evidence?: unknown;
}

function parseTarEntries(tar: Uint8Array): Record<string, Uint8Array> {
  const files: Record<string, Uint8Array> = {};
  let offset = 0;
  const td = new TextDecoder();

  while (offset + 512 <= tar.length) {
    const header = tar.slice(offset, offset + 512);
    const name = td.decode(header.slice(0, 100)).replace(/\0/g, "").trim();
    if (!name) break;

    const sizeStr = td.decode(header.slice(124, 136)).replace(/\0/g, "").trim();
    const size = parseInt(sizeStr, 8);
    if (isNaN(size)) break;

    offset += 512;
    if (size > 0) {
      files[name] = tar.slice(offset, offset + size);
      offset += Math.ceil(size / 512) * 512;
    }
  }
  return files;
}

export async function parseXsilManifest(
  file: File
): Promise<XsilManifest | null> {
  try {
    const buf = await file.arrayBuffer();
    const compressed = new Uint8Array(buf);
    const decompressed = gunzipSync(compressed);
    const entries = parseTarEntries(decompressed);

    const manifestKey = Object.keys(entries).find(
      (k) => k === "manifest.json" || k.endsWith("/manifest.json")
    );
    if (!manifestKey) return null;

    const text = new TextDecoder().decode(entries[manifestKey]);
    return JSON.parse(text) as XsilManifest;
  } catch {
    return null;
  }
}

export function targetsToString(
  targets: XsilManifest["targets"]
): string {
  if (!targets) return "";
  if (typeof targets === "string") return targets;
  if (Array.isArray(targets)) return targets.join(", ");
  return "";
}

/**
 * Targets from API / manifest JSON: top-level keys as badges, optional pretty JSON for nested config.
 */
export function targetsDisplayFromJson(raw: string | null | undefined): {
  badges: string[];
  pretty: string | null;
} {
  if (!raw?.trim()) return { badges: [], pretty: null };
  const trim = raw.trim();
  try {
    const j = JSON.parse(trim) as unknown;
    if (Array.isArray(j)) {
      return { badges: j.map(String).filter(Boolean), pretty: null };
    }
    if (j && typeof j === "object") {
      const keys = Object.keys(j as object);
      return {
        badges: keys,
        pretty: JSON.stringify(j, null, 2),
      };
    }
  } catch {
    // fall through
  }
  return {
    badges: trim.split(",").map((s) => s.trim()).filter(Boolean),
    pretty: null,
  };
}

export function toolchainToString(
  tc: XsilManifest["toolchain"]
): string {
  if (!tc) return "";
  if (typeof tc === "string") {
    const trim = tc.trim();
    if (trim.startsWith("{") && trim.endsWith("}")) {
      try {
        return toolchainToString(JSON.parse(trim) as XsilManifest["toolchain"]);
      } catch {
        return trim;
      }
    }
    return trim;
  }
  if (typeof tc === "object" && tc !== null && !Array.isArray(tc)) {
    const o = tc as Record<string, unknown>;
    if (typeof o.triple === "string") {
      const ver =
        typeof o.version === "string" || typeof o.version === "number"
          ? String(o.version)
          : "";
      const line = ver ? `${o.triple} · v${ver}` : o.triple;
      if (o.external === true) return `${line} (external)`;
      return line;
    }
    if (typeof o.name === "string") {
      return o.version ? `${o.name} ${o.version}` : o.name;
    }
    try {
      return JSON.stringify(tc);
    } catch {
      return "";
    }
  }
  return "";
}

export type PackageMaturityLevel = 1 | 2 | 3 | 4 | 5;

export type CapabilityBadge =
  | "ISA"
  | "Repro: bundled"
  | "Repro: resolved"
  | "Repro: host-dependent"
  | "Toolchain: bundled"
  | "Toolchain: external"
  | "Sim: Spike"
  | "Emu: QEMU"
  | "FPGA"
  | "RTL"
  | "Tests";

function safeParseJsonObject(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw?.trim()) return null;
  try {
    const j = JSON.parse(raw) as unknown;
    if (j && typeof j === "object" && !Array.isArray(j)) return j as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
}

/** True when manifest `execution` declares a test entry (registry JSON blob). */
export function executionIndicatesTests(executionRaw: string | null | undefined): boolean {
  const o = safeParseJsonObject(executionRaw ?? null);
  if (!o) return false;
  if (typeof o.testEntry === "string" && o.testEntry.trim()) return true;
  if (typeof o.tests === "string" && o.tests.trim()) return true;
  return false;
}

function toolchainExternalFlag(
  tc: XsilManifest["toolchain"] | null | undefined
): boolean | null {
  if (!tc) return null;
  if (typeof tc === "string") {
    const o = safeParseJsonObject(tc);
    if (o && typeof o.external === "boolean") return o.external;
    return null;
  }
  if (typeof tc === "object" && tc !== null && !Array.isArray(tc)) {
    const o = tc as Record<string, unknown>;
    if (typeof o.external === "boolean") return o.external;
    return null;
  }
  return null;
}

export function computeCapabilityBadges(input: {
  isa?: string | null;
  toolchain?: XsilManifest["toolchain"] | null;
  targetsRaw?: string | null;
  resolutionMode?: string | null;
  dependenciesRaw?: string | null;
  hasTests?: boolean;
}): { badges: CapabilityBadge[]; level: PackageMaturityLevel } {
  const badges: CapabilityBadge[] = [];

  // ISA is always declared for registry versions, but keep this defensive for older rows.
  if (input.isa?.trim()) badges.push("ISA");

  const tcExternal = toolchainExternalFlag(input.toolchain ?? null);
  if (tcExternal === true) badges.push("Toolchain: external");
  else if (tcExternal === false) badges.push("Toolchain: bundled");

  const targetsObj = safeParseJsonObject(input.targetsRaw ?? null);
  const keys = targetsObj ? Object.keys(targetsObj) : [];
  if (keys.includes("spike")) badges.push("Sim: Spike");
  if (keys.includes("qemu")) badges.push("Emu: QEMU");
  if (keys.includes("fpga")) badges.push("FPGA");
  if (keys.includes("rtl")) badges.push("RTL");

  if (input.hasTests) badges.push("Tests");

  const rm = (input.resolutionMode ?? "").trim().toLowerCase();
  if (rm === "bundled") badges.push("Repro: bundled");
  else if (rm === "resolved") badges.push("Repro: resolved");
  else if (rm === "host-dependent" || rm === "host_dependent" || rm === "hostdependent") {
    badges.push("Repro: host-dependent");
  } else if (tcExternal === true) {
    // Legacy fallback: toolchain.external=true implies host-dependent.
    badges.push("Repro: host-dependent");
  }

  // Level derivation (completeness ladder)
  // 1: ISA-only
  // 2: runnable sim/emulation declared
  // 3: reproducible sim (bundled toolchain)
  // 4: tested (tests present)
  // 5: hardware-capable (fpga or rtl declared)
  const hasSim = keys.includes("spike") || keys.includes("qemu");
  const hasHw = keys.includes("fpga") || keys.includes("rtl");
  const bundledToolchain = tcExternal === false;

  let level: PackageMaturityLevel = 1;
  if (hasSim) level = 2;
  if (level >= 2 && bundledToolchain) level = 3;
  if (level >= 2 && input.hasTests) level = (level >= 3 ? 4 : 4);
  if (hasHw && level >= 2) level = 5;

  return { badges, level };
}

export type ManifestEvidenceKind = "documentation" | "ci" | "artifact" | "other";

export interface ManifestEvidenceItem {
  kind: ManifestEvidenceKind;
  url: string;
  label?: string;
  sha256?: string;
}

const REGISTRY_EVIDENCE_KINDS = new Set<string>(["documentation", "ci", "artifact", "other"]);

/** Parse `Version.evidence` JSON from the registry (lenient; drops invalid rows). */
export function parseRegistryEvidence(raw: string | null | undefined): ManifestEvidenceItem[] {
  const s = raw?.trim();
  if (!s) return [];
  let j: unknown;
  try {
    j = JSON.parse(s);
  } catch {
    return [];
  }
  if (!Array.isArray(j)) return [];
  const out: ManifestEvidenceItem[] = [];
  for (const row of j) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const o = row as Record<string, unknown>;
    const kind = typeof o.kind === "string" ? o.kind.trim() : "";
    const url = typeof o.url === "string" ? o.url.trim() : "";
    if (!REGISTRY_EVIDENCE_KINDS.has(kind) || !url.startsWith("https://")) continue;
    try {
      const u = new URL(url);
      if (u.protocol !== "https:") continue;
    } catch {
      continue;
    }
    const item: ManifestEvidenceItem = { kind: kind as ManifestEvidenceKind, url };
    if (typeof o.label === "string" && o.label.trim()) {
      item.label = o.label.trim().slice(0, 200);
    }
    if (typeof o.sha256 === "string" && /^[0-9a-f]{64}$/i.test(o.sha256.trim())) {
      item.sha256 = o.sha256.trim().toLowerCase();
    }
    out.push(item);
  }
  return out;
}
