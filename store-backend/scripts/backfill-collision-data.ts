import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import type { Coupling, Dispatch } from '@prisma/client';
import { prisma } from '../src/db';
import { validatePublishedXsilBuffer } from '../src/lib/xsilPublishValidate';

type VersionRow = {
  version: string;
  xsilUrl: string;
};

const CUSTOM_OPCODE_TO_SPACE = new Map<number, string>([
  [0x0b, 'custom-0'],
  [0x2b, 'custom-1'],
  [0x5b, 'custom-2'],
  [0x7b, 'custom-3'],
]);

function normalizeStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(
      raw
        .map((v) => (typeof v === 'string' ? v.trim() : ''))
        .filter((v) => v.length > 0),
    ),
  );
}

function toHex(value: number, width = 3): string {
  return `0x${value.toString(16).toUpperCase().padStart(width, '0')}`;
}

function normalizeCoupling(raw: unknown): Coupling | null {
  if (typeof raw !== 'string') return null;
  const key = raw.trim().toUpperCase();
  switch (key) {
    case 'TIGHTLY_COUPLED':
    case 'LOOSELY_COUPLED':
    case 'HYBRID':
    case 'UNKNOWN':
      return key as Coupling;
    default:
      return null;
  }
}

function normalizeDispatch(raw: unknown): Dispatch | null {
  if (typeof raw !== 'string') return null;
  const key = raw.trim().toUpperCase();
  switch (key) {
    case 'INLINE':
    case 'ROCC':
    case 'PREFIX':
    case 'TRAP_EMULATE':
    case 'UNKNOWN':
      return key as Dispatch;
    default:
      return null;
  }
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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(xsilUrl, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const arr = await res.arrayBuffer();
    return Buffer.from(arr);
  } finally {
    clearTimeout(timeout);
  }
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  const extensions = await prisma.extension.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      coupling: true,
      dispatch: true,
      encodingSpace: true,
      csrRange: true,
      versions: {
        where: { isYanked: false },
        select: { version: true, xsilUrl: true },
        orderBy: { publishedAt: 'asc' },
      },
    },
  });

  let updatedExtensions = 0;
  let skippedExtensions = 0;
  let insertedInstructions = 0;
  let failedVersions = 0;

  console.log(`[backfill:collision-data] Starting for ${extensions.length} extensions...`);

  for (const ext of extensions) {
    const versions = ext.versions.filter((v): v is VersionRow => typeof v.xsilUrl === 'string' && v.xsilUrl.length > 0);
    if (versions.length === 0) {
      skippedExtensions += 1;
      continue;
    }

    const mergedEncodingSpace = new Set(ext.encodingSpace.map((s) => s.trim()).filter(Boolean));
    const mergedCsrRange = new Set(ext.csrRange.map((s) => s.trim()).filter(Boolean));
    let couplingCandidate: Coupling | null = null;
    let dispatchCandidate: Dispatch | null = null;

    const instructionRows: Array<{
      extensionId: number;
      version: string;
      mnemonic: string;
      format: string;
      opcode: number;
      funct3: number | null;
      funct7: number | null;
      csrAddress: number | null;
    }> = [];

    let succeededAnyVersion = false;

    for (const versionRow of versions) {
      try {
        const archive = await readArchiveBytes(versionRow.xsilUrl);
        const parsed = validatePublishedXsilBuffer(archive, {
          slug: ext.slug,
          formVersion: versionRow.version,
        });

        succeededAnyVersion = true;
        instructionRows.push(
          ...parsed.instructionEncodings.map((ins) => ({
            extensionId: ext.id,
            version: versionRow.version,
            mnemonic: ins.mnemonic,
            format: ins.format,
            opcode: ins.opcode,
            funct3: ins.funct3,
            funct7: ins.funct7,
            csrAddress: ins.csrAddress,
          })),
        );

        for (const ins of parsed.instructionEncodings) {
          const space = CUSTOM_OPCODE_TO_SPACE.get(ins.opcode);
          if (space) mergedEncodingSpace.add(space);
          if (ins.csrAddress != null) mergedCsrRange.add(toHex(ins.csrAddress));
        }

        const manifest = parsed.manifest as Record<string, unknown>;
        for (const v of normalizeStringList(manifest.encodingSpace)) mergedEncodingSpace.add(v);
        for (const v of normalizeStringList(manifest.csrRange)) mergedCsrRange.add(v);
        for (const v of normalizeStringList(manifest.csrs)) mergedCsrRange.add(v);
        for (const v of normalizeStringList(manifest.csrAddresses)) mergedCsrRange.add(v);

        const c = normalizeCoupling(manifest.coupling);
        const d = normalizeDispatch(manifest.dispatch);
        if (c) couplingCandidate = c;
        if (d) dispatchCandidate = d;
      } catch (err) {
        failedVersions += 1;
        console.warn(
          `[backfill:collision-data] ${ext.slug}@${versionRow.version}: ${String(err)}`,
        );
      }
    }

    if (!succeededAnyVersion) {
      skippedExtensions += 1;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.instruction.deleteMany({ where: { extensionId: ext.id } });
      if (instructionRows.length > 0) {
        await tx.instruction.createMany({ data: instructionRows });
      }

      const nextEncodingSpace = Array.from(mergedEncodingSpace).sort((a, b) => a.localeCompare(b));
      const nextCsrRange = Array.from(mergedCsrRange).sort((a, b) => a.localeCompare(b));
      const currentEncodingSpace = [...ext.encodingSpace].sort((a, b) => a.localeCompare(b));
      const currentCsrRange = [...ext.csrRange].sort((a, b) => a.localeCompare(b));

      const patch: Record<string, unknown> = {};
      if (JSON.stringify(nextEncodingSpace) !== JSON.stringify(currentEncodingSpace)) {
        patch.encodingSpace = nextEncodingSpace;
      }
      if (JSON.stringify(nextCsrRange) !== JSON.stringify(currentCsrRange)) {
        patch.csrRange = nextCsrRange;
      }
      if (ext.coupling === 'UNKNOWN' && couplingCandidate && couplingCandidate !== 'UNKNOWN') {
        patch.coupling = couplingCandidate;
      }
      if (ext.dispatch === 'UNKNOWN' && dispatchCandidate && dispatchCandidate !== 'UNKNOWN') {
        patch.dispatch = dispatchCandidate;
      }

      if (Object.keys(patch).length > 0) {
        await tx.extension.update({
          where: { id: ext.id },
          data: patch,
        });
      }
    });

    updatedExtensions += 1;
    insertedInstructions += instructionRows.length;
  }

  const elapsedMs = Date.now() - startedAt;
  console.log('[backfill:collision-data] Done.');
  console.log(
    JSON.stringify(
      {
        extensionsTotal: extensions.length,
        updatedExtensions,
        skippedExtensions,
        insertedInstructions,
        failedVersions,
        elapsedMs,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error('[backfill:collision-data] Failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
