import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { gunzipSync } from 'zlib';
import * as semver from 'semver';
import tar from 'tar-stream';
import { prisma } from '../src/db';

type JsonObject = Record<string, unknown>;

type OpcodeClaim = {
  extensionSlug: string;
  extensionAuthority: string | null;
  version: string;
  mnemonic: string;
  opcode7: number;
  opcodeLabel: string;
  funct3: number | null;
  funct7: number | null;
};

type CsrClaim = {
  extensionSlug: string;
  extensionAuthority: string | null;
  version: string;
  source: string;
  address: number;
};

type CustomSpaceClaim = {
  extensionSlug: string;
  extensionAuthority: string | null;
  version: string;
  source: string;
  space: 'custom-0' | 'custom-1' | 'custom-2' | 'custom-3';
};

type ExtensionClaims = {
  slug: string;
  authority: string | null;
  version: string;
  xsilUrl: string;
  opcodeClaims: OpcodeClaim[];
  csrClaims: CsrClaim[];
  customSpaceClaims: CustomSpaceClaim[];
  warnings: string[];
};

type CollisionRow =
  | {
      type: 'opcode_tuple';
      extensionA: string;
      extensionB: string;
      details: {
        opcode: string;
        funct3: string;
        funct7: string;
        mnemonicA: string;
        mnemonicB: string;
        versionA: string;
        versionB: string;
      };
    }
  | {
      type: 'csr_overlap';
      extensionA: string;
      extensionB: string;
      details: {
        csr: string;
        sourceA: string;
        sourceB: string;
        versionA: string;
        versionB: string;
      };
    }
  | {
      type: 'custom_opcode_space';
      extensionA: string;
      extensionB: string;
      details: {
        space: string;
        authorityA: string | null;
        authorityB: string | null;
        versionA: string;
        versionB: string;
      };
    };

const CUSTOM_OPCODE_MAP: Record<string, number> = {
  'custom-0': 0x0b,
  'custom-1': 0x2b,
  'custom-2': 0x5b,
  'custom-3': 0x7b,
};

const CUSTOM_OPCODE_BY_NUM = new Map<number, CustomSpaceClaim['space']>([
  [0x0b, 'custom-0'],
  [0x2b, 'custom-1'],
  [0x5b, 'custom-2'],
  [0x7b, 'custom-3'],
]);

function toHex(value: number, width: number): string {
  return `0x${value.toString(16).padStart(width, '0')}`;
}

function parseIntegerLike(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isInteger(raw) && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw !== 'string') return null;
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  if (/^0x[0-9a-f]+$/.test(value)) return Number.parseInt(value.slice(2), 16);
  if (/^0b[01]+$/.test(value)) return Number.parseInt(value.slice(2), 2);
  if (/^\d+$/.test(value)) return Number.parseInt(value, 10);
  return null;
}

function parseOpcode(raw: unknown): { opcode7: number; label: string; space: CustomSpaceClaim['space'] | null } | null {
  if (typeof raw === 'string') {
    const key = raw.trim().toLowerCase();
    if (key in CUSTOM_OPCODE_MAP) {
      const opcode7 = CUSTOM_OPCODE_MAP[key];
      return { opcode7, label: key, space: key as CustomSpaceClaim['space'] };
    }
  }
  const parsed = parseIntegerLike(raw);
  if (parsed == null || parsed < 0 || parsed > 0x7f) return null;
  const space = CUSTOM_OPCODE_BY_NUM.get(parsed) ?? null;
  return { opcode7: parsed, label: space ?? toHex(parsed, 2), space };
}

function parseFunct(raw: unknown, bits: 3 | 7): number | null {
  const parsed = parseIntegerLike(raw);
  if (parsed == null) return null;
  const max = bits === 3 ? 0b111 : 0b1111111;
  if (parsed < 0 || parsed > max) return null;
  return parsed;
}

function parseCsrAddress(raw: unknown): number | null {
  const parsed = parseIntegerLike(raw);
  if (parsed == null || parsed < 0 || parsed > 0x0fff) return null;
  return parsed;
}

function chooseLatestVersion<T extends { version: string; isYanked: boolean; publishedAt: Date }>(rows: T[]): T | null {
  if (rows.length === 0) return null;
  const preferred = rows.filter((r) => !r.isYanked);
  const source = preferred.length > 0 ? preferred : rows;
  return [...source].sort((a, b) => {
    const sa = semver.valid(a.version);
    const sb = semver.valid(b.version);
    if (sa && sb) return semver.rcompare(sa, sb);
    return b.publishedAt.getTime() - a.publishedAt.getTime();
  })[0];
}

async function readArchiveBytes(xsilUrl: string): Promise<Buffer> {
  const localCandidates: string[] = [];
  try {
    const u = new URL(xsilUrl);
    if (u.protocol === 'file:') {
      localCandidates.push(path.normalize(u.pathname));
    }
    const key = u.pathname.split('/').filter(Boolean).pop();
    if (key) {
      localCandidates.push(path.resolve(process.cwd(), 'uploads', key));
      localCandidates.push(path.resolve(process.cwd(), '..', 'uploads', key));
      localCandidates.push(path.resolve(__dirname, '..', 'uploads', key));
    }
  } catch {
    localCandidates.push(path.resolve(process.cwd(), xsilUrl));
  }
  for (const candidate of localCandidates) {
    if (fs.existsSync(candidate)) {
      return fs.readFileSync(candidate);
    }
  }

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(xsilUrl, { signal: ctrl.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const arr = await res.arrayBuffer();
    return Buffer.from(arr);
  } finally {
    clearTimeout(timeout);
  }
}

async function extractJsonEntries(xsilBuffer: Buffer): Promise<{ manifest: JsonObject | null; opcodes: JsonObject | null }> {
  const gunzipped = gunzipSync(xsilBuffer);
  const extract = tar.extract();
  let manifest: JsonObject | null = null;
  let opcodes: JsonObject | null = null;

  await new Promise<void>((resolve, reject) => {
    extract.on('entry', (header, stream, next) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => {
        const name = header.name.replace(/^\.\/+/, '');
        const text = Buffer.concat(chunks).toString('utf8');
        if (name === 'manifest.json') {
          try {
            manifest = JSON.parse(text) as JsonObject;
          } catch {
            // ignore malformed JSON; caller will report warning.
          }
        }
        if (name === 'opcodes.json') {
          try {
            opcodes = JSON.parse(text) as JsonObject;
          } catch {
            // ignore malformed JSON; caller will report warning.
          }
        }
        next();
      });
      stream.resume();
    });
    extract.on('error', reject);
    extract.on('finish', () => resolve());
    extract.end(gunzipped);
  });

  return { manifest, opcodes };
}

function collectOpcodeClaims(
  extSlug: string,
  extAuthority: string | null,
  version: string,
  opcodesJson: JsonObject | null,
  warnings: string[],
): { opcodeClaims: OpcodeClaim[]; customSpaceClaims: CustomSpaceClaim[]; csrClaims: CsrClaim[] } {
  const opcodeClaims: OpcodeClaim[] = [];
  const customSpaceClaims: CustomSpaceClaim[] = [];
  const csrClaims: CsrClaim[] = [];

  const instructionRowsRaw =
    opcodesJson && Array.isArray(opcodesJson.instructions)
      ? opcodesJson.instructions
      : Array.isArray(opcodesJson)
        ? opcodesJson
        : [];

  for (const [idx, rowRaw] of instructionRowsRaw.entries()) {
    if (!rowRaw || typeof rowRaw !== 'object') continue;
    const row = rowRaw as JsonObject;
    const mnemonic = typeof row.mnemonic === 'string' ? row.mnemonic : `instruction#${idx + 1}`;
    const parsedOpcode = parseOpcode(row.opcode);
    if (!parsedOpcode) {
      warnings.push(`Ignoring ${mnemonic}: invalid/empty opcode.`);
      continue;
    }
    const funct3 = parseFunct(row.funct3, 3);
    const funct7 = parseFunct(row.funct7, 7);
    const claim: OpcodeClaim = {
      extensionSlug: extSlug,
      extensionAuthority: extAuthority,
      version,
      mnemonic,
      opcode7: parsedOpcode.opcode7,
      opcodeLabel: parsedOpcode.label,
      funct3,
      funct7,
    };
    opcodeClaims.push(claim);

    if (parsedOpcode.space) {
      customSpaceClaims.push({
        extensionSlug: extSlug,
        extensionAuthority: extAuthority,
        version,
        source: `${mnemonic} opcode`,
        space: parsedOpcode.space,
      });
    }

    const directCsr = parseCsrAddress(row.csrAddress ?? row.csr ?? row.csr_address);
    if (directCsr != null) {
      csrClaims.push({
        extensionSlug: extSlug,
        extensionAuthority: extAuthority,
        version,
        source: `${mnemonic} csr`,
        address: directCsr,
      });
    }

    const listRaw = row.csrs ?? row.csrAddresses ?? row.csr_addresses;
    if (Array.isArray(listRaw)) {
      for (const candidate of listRaw) {
        const parsed = parseCsrAddress(candidate);
        if (parsed != null) {
          csrClaims.push({
            extensionSlug: extSlug,
            extensionAuthority: extAuthority,
            version,
            source: `${mnemonic} csrs[]`,
            address: parsed,
          });
        }
      }
    }
  }

  return { opcodeClaims, customSpaceClaims, csrClaims };
}

function collectManifestClaims(
  extSlug: string,
  extAuthority: string | null,
  version: string,
  manifest: JsonObject | null,
): { customSpaceClaims: CustomSpaceClaim[]; csrClaims: CsrClaim[] } {
  const customSpaceClaims: CustomSpaceClaim[] = [];
  const csrClaims: CsrClaim[] = [];
  if (!manifest) return { customSpaceClaims, csrClaims };

  const customSpacesRaw = manifest.customOpcodeSpaces ?? manifest.custom_opcode_spaces;
  if (Array.isArray(customSpacesRaw)) {
    for (const item of customSpacesRaw) {
      if (typeof item !== 'string') continue;
      const key = item.trim().toLowerCase();
      if (key in CUSTOM_OPCODE_MAP) {
        customSpaceClaims.push({
          extensionSlug: extSlug,
          extensionAuthority: extAuthority,
          version,
          source: 'manifest.customOpcodeSpaces',
          space: key as CustomSpaceClaim['space'],
        });
      }
    }
  }

  const csrsRaw = manifest.csrs ?? manifest.csrAddresses ?? manifest.csr_addresses;
  if (Array.isArray(csrsRaw)) {
    for (const item of csrsRaw) {
      const parsed = parseCsrAddress(item);
      if (parsed != null) {
        csrClaims.push({
          extensionSlug: extSlug,
          extensionAuthority: extAuthority,
          version,
          source: 'manifest.csrs',
          address: parsed,
        });
      }
    }
  }

  return { customSpaceClaims, csrClaims };
}

function tupleKey(c: OpcodeClaim): string {
  return `${c.opcode7}:${c.funct3 ?? -1}:${c.funct7 ?? -1}`;
}

function hasVendorDistinction(aAuthority: string | null, bAuthority: string | null): boolean {
  if (!aAuthority || !bAuthority) return false;
  return aAuthority.trim().toLowerCase() !== bAuthority.trim().toLowerCase();
}

function detectPairCollisions(a: ExtensionClaims, b: ExtensionClaims): CollisionRow[] {
  const collisions: CollisionRow[] = [];

  const bTupleMap = new Map<string, OpcodeClaim[]>();
  for (const claim of b.opcodeClaims) {
    const key = tupleKey(claim);
    const list = bTupleMap.get(key) ?? [];
    list.push(claim);
    bTupleMap.set(key, list);
  }
  for (const aClaim of a.opcodeClaims) {
    const key = tupleKey(aClaim);
    const matches = bTupleMap.get(key) ?? [];
    for (const bClaim of matches) {
      collisions.push({
        type: 'opcode_tuple',
        extensionA: a.slug,
        extensionB: b.slug,
        details: {
          opcode: aClaim.opcodeLabel,
          funct3: aClaim.funct3 == null ? 'null' : `0b${aClaim.funct3.toString(2).padStart(3, '0')}`,
          funct7: aClaim.funct7 == null ? 'null' : `0b${aClaim.funct7.toString(2).padStart(7, '0')}`,
          mnemonicA: aClaim.mnemonic,
          mnemonicB: bClaim.mnemonic,
          versionA: aClaim.version,
          versionB: bClaim.version,
        },
      });
    }
  }

  const bCsrMap = new Map<number, CsrClaim[]>();
  for (const claim of b.csrClaims) {
    const list = bCsrMap.get(claim.address) ?? [];
    list.push(claim);
    bCsrMap.set(claim.address, list);
  }
  for (const aClaim of a.csrClaims) {
    const matches = bCsrMap.get(aClaim.address) ?? [];
    for (const bClaim of matches) {
      collisions.push({
        type: 'csr_overlap',
        extensionA: a.slug,
        extensionB: b.slug,
        details: {
          csr: toHex(aClaim.address, 3),
          sourceA: aClaim.source,
          sourceB: bClaim.source,
          versionA: aClaim.version,
          versionB: bClaim.version,
        },
      });
    }
  }

  const aSpaces = new Map<CustomSpaceClaim['space'], CustomSpaceClaim[]>();
  for (const claim of a.customSpaceClaims) {
    const list = aSpaces.get(claim.space) ?? [];
    list.push(claim);
    aSpaces.set(claim.space, list);
  }
  const bSpaces = new Map<CustomSpaceClaim['space'], CustomSpaceClaim[]>();
  for (const claim of b.customSpaceClaims) {
    const list = bSpaces.get(claim.space) ?? [];
    list.push(claim);
    bSpaces.set(claim.space, list);
  }
  for (const [space, aList] of aSpaces) {
    const bList = bSpaces.get(space);
    if (!bList || bList.length === 0) continue;
    if (hasVendorDistinction(a.authority, b.authority)) continue;
    collisions.push({
      type: 'custom_opcode_space',
      extensionA: a.slug,
      extensionB: b.slug,
      details: {
        space,
        authorityA: a.authority,
        authorityB: b.authority,
        versionA: aList[0].version,
        versionB: bList[0].version,
      },
    });
  }

  return collisions;
}

async function loadExtensionClaims(): Promise<ExtensionClaims[]> {
  const extensions = await prisma.extension.findMany({
    where: { recordKind: 'extension' },
    select: {
      slug: true,
      authority: true,
      versions: {
        select: {
          version: true,
          isYanked: true,
          publishedAt: true,
          xsilUrl: true,
        },
      },
    },
  });

  const out: ExtensionClaims[] = [];
  for (const ext of extensions) {
    const selectedVersion = chooseLatestVersion(ext.versions);
    if (!selectedVersion) {
      out.push({
        slug: ext.slug,
        authority: ext.authority ?? null,
        version: 'n/a',
        xsilUrl: '',
        opcodeClaims: [],
        csrClaims: [],
        customSpaceClaims: [],
        warnings: ['No versions found for extension.'],
      });
      continue;
    }
    const warnings: string[] = [];
    let manifest: JsonObject | null = null;
    let opcodes: JsonObject | null = null;
    try {
      const bytes = await readArchiveBytes(selectedVersion.xsilUrl);
      const extracted = await extractJsonEntries(bytes);
      manifest = extracted.manifest;
      opcodes = extracted.opcodes;
      if (!extracted.opcodes) warnings.push('No opcodes.json found in archive.');
      if (!extracted.manifest) warnings.push('No valid manifest.json found in archive.');
    } catch (err) {
      warnings.push(`Failed to read archive (${selectedVersion.xsilUrl}): ${String(err)}`);
    }

    const opcodeClaimsFromOpcodes = collectOpcodeClaims(
      ext.slug,
      ext.authority ?? null,
      selectedVersion.version,
      opcodes,
      warnings,
    );
    const claimsFromManifest = collectManifestClaims(
      ext.slug,
      ext.authority ?? null,
      selectedVersion.version,
      manifest,
    );

    out.push({
      slug: ext.slug,
      authority: ext.authority ?? null,
      version: selectedVersion.version,
      xsilUrl: selectedVersion.xsilUrl,
      opcodeClaims: opcodeClaimsFromOpcodes.opcodeClaims,
      csrClaims: [...opcodeClaimsFromOpcodes.csrClaims, ...claimsFromManifest.csrClaims],
      customSpaceClaims: [...opcodeClaimsFromOpcodes.customSpaceClaims, ...claimsFromManifest.customSpaceClaims],
      warnings,
    });
  }
  return out;
}

function printCollision(c: CollisionRow): void {
  if (c.type === 'opcode_tuple') {
    console.log(
      `${c.extensionA} <-> ${c.extensionB} : opcode_tuple : opcode=${c.details.opcode}, funct3=${c.details.funct3}, funct7=${c.details.funct7} [${c.details.mnemonicA} vs ${c.details.mnemonicB}]`,
    );
    return;
  }
  if (c.type === 'csr_overlap') {
    console.log(
      `${c.extensionA} <-> ${c.extensionB} : csr_overlap : csr=${c.details.csr} [${c.details.sourceA} vs ${c.details.sourceB}]`,
    );
    return;
  }
  console.log(
    `${c.extensionA} <-> ${c.extensionB} : custom_opcode_space : ${c.details.space} (authorityA=${c.details.authorityA ?? 'n/a'}, authorityB=${c.details.authorityB ?? 'n/a'})`,
  );
}

async function main(): Promise<void> {
  const startedAt = new Date();
  console.log('[audit:collisions] Loading extensions and opcode claims...');
  const claims = await loadExtensionClaims();

  const collisions: CollisionRow[] = [];
  for (let i = 0; i < claims.length; i += 1) {
    for (let j = i + 1; j < claims.length; j += 1) {
      const rows = detectPairCollisions(claims[i], claims[j]);
      collisions.push(...rows);
    }
  }

  console.log(`\n[audit:collisions] Found ${collisions.length} collision(s):`);
  if (collisions.length === 0) {
    console.log('No collisions detected.');
  } else {
    for (const c of collisions) printCollision(c);
  }

  const outputDir = path.resolve(__dirname, 'output');
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, 'existing-collisions.json');

  const result = {
    generatedAt: new Date().toISOString(),
    startedAt: startedAt.toISOString(),
    totals: {
      extensions: claims.length,
      opcodeClaims: claims.reduce((acc, c) => acc + c.opcodeClaims.length, 0),
      csrClaims: claims.reduce((acc, c) => acc + c.csrClaims.length, 0),
      customSpaceClaims: claims.reduce((acc, c) => acc + c.customSpaceClaims.length, 0),
      collisions: collisions.length,
    },
    extensions: claims.map((c) => ({
      slug: c.slug,
      authority: c.authority,
      version: c.version,
      xsilUrl: c.xsilUrl,
      opcodeClaims: c.opcodeClaims.map((o) => ({
        mnemonic: o.mnemonic,
        opcode: o.opcodeLabel,
        funct3: o.funct3,
        funct7: o.funct7,
      })),
      csrClaims: c.csrClaims.map((csr) => ({
        source: csr.source,
        csr: toHex(csr.address, 3),
      })),
      customSpaceClaims: c.customSpaceClaims.map((space) => ({
        source: space.source,
        space: space.space,
      })),
      warnings: c.warnings,
    })),
    collisions,
  };

  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log(`\n[audit:collisions] JSON report saved to ${outputPath}`);
}

main()
  .catch((err) => {
    console.error('[audit:collisions] Failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
