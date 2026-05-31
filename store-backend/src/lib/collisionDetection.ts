import type {
  Coupling,
  Dispatch,
  Extension,
  Instruction,
  StandardStatus,
} from '@prisma/client';
import { prisma } from '../db';

export type Collision = {
  withExtensionId: string;
  withExtensionName: string;
  type: 'OPCODE' | 'CSR' | 'CUSTOM_SPACE';
  detail: string;
  severity: 'FATAL' | 'WARNING';
};

type ExtensionLite = Pick<
  Extension,
  | 'id'
  | 'name'
  | 'slug'
  | 'standardStatus'
  | 'coupling'
  | 'dispatch'
  | 'encodingSpace'
  | 'csrRange'
  | 'requiresCoreFeatures'
>;

type CandidateOpcode = {
  opcode: number;
  funct3?: number;
  funct7?: number;
  format: string;
};

const CUSTOM_OPCODE_NUM_TO_LABEL = new Map<number, string>([
  [0x0b, 'custom-0'],
  [0x2b, 'custom-1'],
  [0x5b, 'custom-2'],
  [0x7b, 'custom-3'],
]);

const CUSTOM_SPACES = new Set(['custom-0', 'custom-1', 'custom-2', 'custom-3']);

function toHex(v: number, width = 2): string {
  return `0x${v.toString(16).toUpperCase().padStart(width, '0')}`;
}

function parseExtensionId(raw: string | number): number {
  if (typeof raw === 'number' && Number.isInteger(raw) && raw > 0) return raw;
  if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) return Number.parseInt(raw.trim(), 10);
  throw new Error(`Invalid extension id: ${String(raw)}`);
}

function parseIdList(raw: Array<string | number> | undefined): number[] | undefined {
  if (!raw) return undefined;
  const out = raw.map(parseExtensionId);
  return Array.from(new Set(out));
}

function parseRange(raw: string): { start: number; end: number } | null {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return null;
  const rangeMatch = normalized.match(/^(0x[0-9a-f]+|\d+)\s*-\s*(0x[0-9a-f]+|\d+)$/);
  if (rangeMatch) {
    const start = Number.parseInt(rangeMatch[1], rangeMatch[1].startsWith('0x') ? 16 : 10);
    const end = Number.parseInt(rangeMatch[2], rangeMatch[2].startsWith('0x') ? 16 : 10);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    if (start < 0 || end < start) return null;
    return { start, end };
  }
  const singleMatch = normalized.match(/^(0x[0-9a-f]+|\d+)$/);
  if (singleMatch) {
    const value = Number.parseInt(singleMatch[1], singleMatch[1].startsWith('0x') ? 16 : 10);
    if (!Number.isFinite(value) || value < 0) return null;
    return { start: value, end: value };
  }
  return null;
}

function rangesOverlap(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start <= b.end && b.start <= a.end;
}

/**
 * Heuristic v1 for remappability:
 * - Not ratified
 * - Declares at least one custom encoding space (custom-0..custom-3)
 *
 * This intentionally stays conservative and simple for now; refine later with
 * richer metadata (e.g., explicit fixed/relocatable flags).
 */
function isRemappable(ext: ExtensionLite): boolean {
  const status = ext.standardStatus as StandardStatus | null;
  if (status === 'ratified') return false;
  return ext.encodingSpace.some((s) => CUSTOM_SPACES.has(String(s).trim().toLowerCase()));
}

function severity(a: ExtensionLite, b: ExtensionLite): Collision['severity'] {
  return !isRemappable(a) && !isRemappable(b) ? 'FATAL' : 'WARNING';
}

function opcodeTupleKey(i: Pick<Instruction, 'opcode' | 'funct3' | 'funct7'>): string {
  return `${i.opcode}:${i.funct3 ?? -1}:${i.funct7 ?? -1}`;
}

function appendUnique(list: Collision[], row: Collision): void {
  if (
    list.some(
      (x) =>
        x.withExtensionId === row.withExtensionId &&
        x.type === row.type &&
        x.detail === row.detail &&
        x.severity === row.severity,
    )
  ) {
    return;
  }
  list.push(row);
}

function compareOneAgainstTargets(
  source: ExtensionLite,
  sourceInstructions: Instruction[],
  targets: ExtensionLite[],
  targetInstructionsByExtensionId: Map<number, Instruction[]>,
): Collision[] {
  const out: Collision[] = [];

  const sourceOpcodeMap = new Map<string, Instruction[]>();
  const sourceCsrMap = new Map<number, Instruction[]>();
  for (const ins of sourceInstructions) {
    const key = opcodeTupleKey(ins);
    const opList = sourceOpcodeMap.get(key) ?? [];
    opList.push(ins);
    sourceOpcodeMap.set(key, opList);
    if (ins.csrAddress != null) {
      const csrList = sourceCsrMap.get(ins.csrAddress) ?? [];
      csrList.push(ins);
      sourceCsrMap.set(ins.csrAddress, csrList);
    }
  }
  const sourceRanges = source.csrRange.map(parseRange).filter((r): r is { start: number; end: number } => r != null);
  const sourceCustomSpaces = new Set(
    source.encodingSpace.map((s) => String(s).trim().toLowerCase()).filter((s) => CUSTOM_SPACES.has(s)),
  );

  for (const target of targets) {
    const targetInstructions = targetInstructionsByExtensionId.get(target.id) ?? [];
    const sev = severity(source, target);
    const targetOpcodeMap = new Map<string, Instruction[]>();
    const targetCsrMap = new Map<number, Instruction[]>();

    for (const ins of targetInstructions) {
      const key = opcodeTupleKey(ins);
      const opList = targetOpcodeMap.get(key) ?? [];
      opList.push(ins);
      targetOpcodeMap.set(key, opList);
      if (ins.csrAddress != null) {
        const csrList = targetCsrMap.get(ins.csrAddress) ?? [];
        csrList.push(ins);
        targetCsrMap.set(ins.csrAddress, csrList);
      }
    }

    for (const [key, srcClaims] of sourceOpcodeMap) {
      const otherClaims = targetOpcodeMap.get(key);
      if (!otherClaims || otherClaims.length === 0) continue;
      const src = srcClaims[0];
      appendUnique(out, {
        withExtensionId: String(target.id),
        withExtensionName: target.name,
        type: 'OPCODE',
        detail: `opcode ${toHex(src.opcode, 2)} funct3 ${
          src.funct3 == null ? 'null' : toHex(src.funct3, 1)
        } funct7 ${src.funct7 == null ? 'null' : toHex(src.funct7, 2)}`,
        severity: sev,
      });
    }

    for (const [csrAddress] of sourceCsrMap) {
      if (!targetCsrMap.has(csrAddress)) continue;
      appendUnique(out, {
        withExtensionId: String(target.id),
        withExtensionName: target.name,
        type: 'CSR',
        detail: `csr ${toHex(csrAddress, 3)}`,
        severity: sev,
      });
    }

    const targetRanges = target.csrRange
      .map(parseRange)
      .filter((r): r is { start: number; end: number } => r != null);
    for (const rA of sourceRanges) {
      for (const rB of targetRanges) {
        if (!rangesOverlap(rA, rB)) continue;
        appendUnique(out, {
          withExtensionId: String(target.id),
          withExtensionName: target.name,
          type: 'CSR',
          detail: `csr-range overlap ${toHex(rA.start, 3)}-${toHex(rA.end, 3)} vs ${toHex(rB.start, 3)}-${toHex(
            rB.end,
            3,
          )}`,
          severity: sev,
        });
      }
    }

    const targetCustomSpaces = new Set(
      target.encodingSpace.map((s) => String(s).trim().toLowerCase()).filter((s) => CUSTOM_SPACES.has(s)),
    );
    for (const space of sourceCustomSpaces) {
      if (!targetCustomSpaces.has(space)) continue;
      appendUnique(out, {
        withExtensionId: String(target.id),
        withExtensionName: target.name,
        type: 'CUSTOM_SPACE',
        detail: `${space} claimed by both extensions`,
        severity: sev,
      });
    }
  }

  return out;
}

async function loadExtensionsAndInstructions(
  sourceIds: number[],
  targetIds?: number[],
): Promise<{
  extensionsById: Map<number, ExtensionLite>;
  instructionsByExtensionId: Map<number, Instruction[]>;
}> {
  const allIds = new Set<number>(sourceIds);
  if (targetIds) for (const id of targetIds) allIds.add(id);
  const ids = Array.from(allIds);

  const [extensions, instructions] = await Promise.all([
    prisma.extension.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        slug: true,
        standardStatus: true,
        coupling: true,
        dispatch: true,
        encodingSpace: true,
        csrRange: true,
        requiresCoreFeatures: true,
      },
    }),
    prisma.instruction.findMany({
      where: { extensionId: { in: ids } },
      select: {
        id: true,
        extensionId: true,
        version: true,
        mnemonic: true,
        opcode: true,
        funct3: true,
        funct7: true,
        format: true,
        csrAddress: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const extensionsById = new Map<number, ExtensionLite>();
  for (const ext of extensions) extensionsById.set(ext.id, ext as ExtensionLite);

  const instructionsByExtensionId = new Map<number, Instruction[]>();
  for (const ins of instructions as unknown as Instruction[]) {
    const list = instructionsByExtensionId.get(ins.extensionId) ?? [];
    list.push(ins);
    instructionsByExtensionId.set(ins.extensionId, list);
  }

  return { extensionsById, instructionsByExtensionId };
}

/**
 * Detect collisions of one extension against all others (or a subset).
 */
export async function detectCollisions(
  extensionId: string | number,
  options?: { against?: Array<string | number> },
): Promise<Collision[]> {
  const sourceId = parseExtensionId(extensionId);
  const againstIds = parseIdList(options?.against);
  const targetIds = againstIds
    ? againstIds.filter((id) => id !== sourceId)
    : (
        await prisma.extension.findMany({
          where: { id: { not: sourceId } },
          select: { id: true },
        })
      ).map((x) => x.id);

  if (targetIds.length === 0) return [];

  const { extensionsById, instructionsByExtensionId } = await loadExtensionsAndInstructions([sourceId], targetIds);
  const source = extensionsById.get(sourceId);
  if (!source) throw new Error(`Extension ${sourceId} not found.`);
  const targets = targetIds
    .map((id) => extensionsById.get(id))
    .filter((x): x is ExtensionLite => x != null);

  return compareOneAgainstTargets(
    source,
    instructionsByExtensionId.get(sourceId) ?? [],
    targets,
    instructionsByExtensionId,
  );
}

/**
 * Detect collisions inside an arbitrary set (A, B, C...) returning one collision
 * list per extension id.
 */
export async function detectCollisionsInSet(
  extensionIds: Array<string | number>,
): Promise<Map<string, Collision[]>> {
  const ids = Array.from(new Set(extensionIds.map(parseExtensionId)));
  const out = new Map<string, Collision[]>();
  for (const id of ids) {
    const against = ids.filter((x) => x !== id);
    const collisions = await detectCollisions(id, { against });
    out.set(String(id), collisions);
  }
  return out;
}

/**
 * Check a candidate encoding tuple before persistence (wizard / dry-run usage).
 * Uses indexed query on (opcode, funct3, funct7) for O(1)-ish lookup per tuple.
 */
export async function checkCandidateOpcode(
  candidate: CandidateOpcode,
  options?: { excludeExtensionId?: string | number },
): Promise<Collision[]> {
  const excludeId = options?.excludeExtensionId != null ? parseExtensionId(options.excludeExtensionId) : null;
  const candidateFunct3 = candidate.funct3 ?? null;
  const candidateFunct7 = candidate.funct7 ?? null;

  const matches = await prisma.instruction.findMany({
    where: {
      opcode: candidate.opcode,
      funct3: candidateFunct3,
      funct7: candidateFunct7,
      ...(excludeId ? { extensionId: { not: excludeId } } : {}),
    },
    select: {
      extensionId: true,
      mnemonic: true,
      opcode: true,
      funct3: true,
      funct7: true,
      extension: {
        select: {
          id: true,
          name: true,
          slug: true,
          standardStatus: true,
          coupling: true,
          dispatch: true,
          encodingSpace: true,
          csrRange: true,
          requiresCoreFeatures: true,
        },
      },
    },
  });

  if (matches.length === 0) return [];

  const candidateSpace = CUSTOM_OPCODE_NUM_TO_LABEL.get(candidate.opcode) ?? null;
  const candidatePseudoExtension: ExtensionLite = {
    id: -1,
    name: 'candidate',
    slug: 'candidate',
    standardStatus: null,
    coupling: 'UNKNOWN' as Coupling,
    dispatch: 'UNKNOWN' as Dispatch,
    encodingSpace: candidateSpace ? [candidateSpace] : [],
    csrRange: [],
    requiresCoreFeatures: [],
  };

  const out: Collision[] = [];
  for (const row of matches) {
    const ext = row.extension as ExtensionLite;
    const sev = severity(candidatePseudoExtension, ext);
    appendUnique(out, {
      withExtensionId: String(ext.id),
      withExtensionName: ext.name,
      type: 'OPCODE',
      detail: `opcode ${toHex(row.opcode, 2)} funct3 ${
        row.funct3 == null ? 'null' : toHex(row.funct3, 1)
      } funct7 ${row.funct7 == null ? 'null' : toHex(row.funct7, 2)} (matches ${row.mnemonic})`,
      severity: sev,
    });
  }

  return out;
}
