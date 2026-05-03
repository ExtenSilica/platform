type UnknownRecord = Record<string, unknown>;

export interface DeclaredToolDependency {
  toolName: string;
  toolVersion: string;
  platform: string;
  url: string;
  sha256: string;
}

export function normalizeSha256(value: string): string {
  const v = value.trim().toLowerCase();
  if (v.startsWith('sha256:')) return v.slice('sha256:'.length).trim();
  if (v.startsWith('sha256-')) return v.slice('sha256-'.length).trim();
  return v;
}

export function isValidSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

export function extractDeclaredToolDependencies(manifest: UnknownRecord): DeclaredToolDependency[] {
  const deps = manifest.dependencies;
  if (!deps || typeof deps !== 'object') return [];

  const tools = (deps as UnknownRecord).tools;
  if (!Array.isArray(tools)) return [];

  const out: DeclaredToolDependency[] = [];

  for (const toolRaw of tools) {
    if (!toolRaw || typeof toolRaw !== 'object') continue;
    const tool = toolRaw as UnknownRecord;
    const toolName = typeof tool.name === 'string' ? tool.name.trim() : '';
    const toolVersion = typeof tool.version === 'string' ? tool.version.trim() : '';
    const platforms = tool.platforms;
    if (!toolName || !toolVersion || !platforms || typeof platforms !== 'object') continue;

    for (const [platform, artifactRaw] of Object.entries(platforms as UnknownRecord)) {
      if (!artifactRaw || typeof artifactRaw !== 'object') continue;
      const artifact = artifactRaw as UnknownRecord;
      const url = typeof artifact.url === 'string' ? artifact.url.trim() : '';
      const shaRaw = typeof artifact.sha256 === 'string' ? artifact.sha256.trim() : '';
      const sha256 = normalizeSha256(shaRaw);
      if (!platform || !url || !sha256) continue;
      out.push({ toolName, toolVersion, platform, url, sha256 });
    }
  }

  return out;
}

