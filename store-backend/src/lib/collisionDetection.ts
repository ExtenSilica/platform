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
  /**
   * - `OPCODE`               — same encoding tuple, **different** mnemonic, with at
   *                            least one sub-field (funct3/funct7/funct12) populated
   *                            on **both** sides. A real hardware conflict: one slot,
   *                            two distinct instructions.
   * - `OPCODE_SHARED`        — same encoding tuple **and** same mnemonic.
   *                            A designed overlap (e.g. Zbkb ⊂ Zbb): both extensions
   *                            describe the same instruction. Surfaced informationally.
   * - `SHARED_MAJOR_OPCODE`  — major 7-bit opcode matches but every sub-field
   *                            (funct3/funct7/funct12) is null on **both** sides.
   *                            This is NOT a hardware conflict: many RISC-V
   *                            extensions share a major opcode (RVV's OP-V = 0x57
   *                            covers every vector instruction; the AMO space at
   *                            0x2F covers every atomic). They are disambiguated
   *                            at the next decode level (funct3+funct6/funct7,
   *                            register/immediate fields). We surface this only so
   *                            authors know they live in shared dispatch space and
   *                            need to compare full encoding masks, not the 7-bit
   *                            opcode alone.
   * - `CSR`                  — overlapping CSR address(es).
   * - `CUSTOM_SPACE`         — both claim the same custom-N major opcode space.
   */
  type:
    | 'OPCODE'
    | 'OPCODE_SHARED'
    | 'SHARED_MAJOR_OPCODE'
    | 'CSR'
    | 'CUSTOM_SPACE';
  detail: string;
  /**
   * - `FATAL`   — incompatible by spec.
   * - `WARNING` — overlap with at least one side remappable.
   * - `INFO`    — informational; not a conflict.
   */
  severity: 'FATAL' | 'WARNING' | 'INFO';
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
  /** 12-bit I-immediate, populated for I-singleton encodings. */
  funct12?: number;
  format: string;
  /**
   * Candidate's mnemonic. When provided, a registry hit that shares the same
   * mnemonic is reported as `OPCODE_SHARED` (designed overlap) instead of
   * `OPCODE` — this avoids false FATAL on intentional subset relationships
   * (e.g. publishing a Zbkb package that re-declares Zbb's `rol`/`ror`/`andn`).
   */
  mnemonic?: string;
};

function normalizeMnemonic(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

/**
 * Returns the matched target's mnemonic (in its original casing) when any
 * target instruction shares the candidate's mnemonic (case-insensitive), else
 * null. Same mnemonic + same encoding tuple = same instruction by spec.
 */
function findSharedMnemonic(
  src: Pick<Instruction, 'mnemonic'> | { mnemonic?: string },
  targets: Array<Pick<Instruction, 'mnemonic'>>,
): string | null {
  const srcMn = normalizeMnemonic('mnemonic' in src ? src.mnemonic : undefined);
  if (!srcMn) return null;
  const hit = targets.find((t) => normalizeMnemonic(t.mnemonic) === srcMn);
  return hit ? hit.mnemonic : null;
}

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

function opcodeTupleKey(
  i: Pick<Instruction, 'opcode' | 'funct3' | 'funct7' | 'funct12'>,
): string {
  return `${i.opcode}:${i.funct3 ?? -1}:${i.funct7 ?? -1}:${i.funct12 ?? -1}`;
}

function formatEncodingDetail(
  ins: Pick<Instruction, 'opcode' | 'funct3' | 'funct7' | 'funct12'>,
): string {
  const f3 = ins.funct3 == null ? 'null' : toHex(ins.funct3, 1);
  const f7 = ins.funct7 == null ? 'null' : toHex(ins.funct7, 2);
  const op = `opcode ${toHex(ins.opcode, 2)} funct3 ${f3}`;
  // I-singleton has funct12 instead of funct7; show whichever is set, fall
  // back to "funct7 null" so legacy callers still see the field.
  if (ins.funct12 != null) return `${op} funct12 ${toHex(ins.funct12, 3)}`;
  return `${op} funct7 ${f7}`;
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
      const tgt = otherClaims[0];
      const sharedMn = findSharedMnemonic(src, otherClaims);
      if (sharedMn) {
        // Designed overlap (same encoding + same mnemonic): both extensions
        // describe the same instruction. Surfaced informationally so authors
        // know who else carries it, but it is NOT a conflict.
        appendUnique(out, {
          withExtensionId: String(target.id),
          withExtensionName: target.name,
          type: 'OPCODE_SHARED',
          detail: `${sharedMn} shared at ${formatEncodingDetail(src)} (same instruction by spec)`,
          severity: 'WARNING',
        });
        continue;
      }
      // Major-opcode-only match: every sub-field is null on both sides. That
      // means our model can't tell these apart beyond the 7-bit opcode. For
      // RISC-V that is NOT a conflict — many extensions legitimately share a
      // major opcode (OP-V 0x57 for the entire vector ISA; AMO 0x2F for atomics;
      // OP-IMM 0x13 for shifts/immediates; etc.) and are disambiguated by
      // funct3/funct6/funct7 plus register/immediate fields. We surface this
      // as informational so authors know they're in shared dispatch space and
      // should compare full encoding masks, not the 7-bit opcode alone.
      if (
        src.funct3 == null &&
        src.funct7 == null &&
        src.funct12 == null &&
        tgt.funct3 == null &&
        tgt.funct7 == null &&
        tgt.funct12 == null
      ) {
        appendUnique(out, {
          withExtensionId: String(target.id),
          withExtensionName: target.name,
          type: 'SHARED_MAJOR_OPCODE',
          detail: `${formatEncodingDetail(src)} — shared major opcode only; disambiguated at the next decode level (funct3/funct6/funct7).`,
          severity: 'INFO',
        });
        continue;
      }
      appendUnique(out, {
        withExtensionId: String(target.id),
        withExtensionName: target.name,
        type: 'OPCODE',
        detail: formatEncodingDetail(src),
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
        funct12: true,
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
 * Uses indexed query on (opcode, funct3, funct7, funct12) for O(1)-ish lookup per tuple.
 */
export async function checkCandidateOpcode(
  candidate: CandidateOpcode,
  options?: { excludeExtensionId?: string | number },
): Promise<Collision[]> {
  const excludeId = options?.excludeExtensionId != null ? parseExtensionId(options.excludeExtensionId) : null;
  const candidateFunct3 = candidate.funct3 ?? null;
  const candidateFunct7 = candidate.funct7 ?? null;
  const candidateFunct12 = candidate.funct12 ?? null;

  const matches = await prisma.instruction.findMany({
    where: {
      opcode: candidate.opcode,
      funct3: candidateFunct3,
      funct7: candidateFunct7,
      funct12: candidateFunct12,
      ...(excludeId ? { extensionId: { not: excludeId } } : {}),
    },
    select: {
      extensionId: true,
      mnemonic: true,
      opcode: true,
      funct3: true,
      funct7: true,
      funct12: true,
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
  const candidateMn = normalizeMnemonic(candidate.mnemonic);
  const candidateAllNull =
    candidate.funct3 == null && candidate.funct7 == null && candidate.funct12 == null;
  for (const row of matches) {
    const ext = row.extension as ExtensionLite;
    const sev = severity(candidatePseudoExtension, ext);
    // If the candidate carries a mnemonic and it matches the registry row, this
    // is a designed overlap (same instruction by spec) — surface it as a
    // WARNING-level shared overlap instead of FATAL/WARNING conflict.
    if (candidateMn && normalizeMnemonic(row.mnemonic) === candidateMn) {
      appendUnique(out, {
        withExtensionId: String(ext.id),
        withExtensionName: ext.name,
        type: 'OPCODE_SHARED',
        detail: `${row.mnemonic} shared at ${formatEncodingDetail(row)} (same instruction by spec)`,
        severity: 'WARNING',
      });
      continue;
    }
    // Major-opcode-only match: nothing beyond the 7-bit opcode is known on
    // either side. Not a hardware conflict — see the type-doc comment above.
    if (
      candidateAllNull &&
      row.funct3 == null &&
      row.funct7 == null &&
      row.funct12 == null
    ) {
      appendUnique(out, {
        withExtensionId: String(ext.id),
        withExtensionName: ext.name,
        type: 'SHARED_MAJOR_OPCODE',
        detail: `${formatEncodingDetail(row)} — shared major opcode only; disambiguated at the next decode level (funct3/funct6/funct7).`,
        severity: 'INFO',
      });
      continue;
    }
    appendUnique(out, {
      withExtensionId: String(ext.id),
      withExtensionName: ext.name,
      type: 'OPCODE',
      detail: `${formatEncodingDetail(row)} (matches ${row.mnemonic})`,
      severity: sev,
    });
  }

  return out;
}
