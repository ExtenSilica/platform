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
  targets?: string | string[];
  entry?: string;
  toolchain?: string | { name?: string; version?: string };
  readme?: string;
  keywords?: string[];
  checksums?: { payload?: string; archive?: string };
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
      if (o.external === true) return `${line} (bundled)`;
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
  if (tc.name) return tc.version ? `${tc.name} ${tc.version}` : tc.name;
  return "";
}
