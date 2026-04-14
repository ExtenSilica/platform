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

export function toolchainToString(
  tc: XsilManifest["toolchain"]
): string {
  if (!tc) return "";
  if (typeof tc === "string") return tc;
  if (tc.name) return tc.version ? `${tc.name} ${tc.version}` : tc.name;
  return "";
}
