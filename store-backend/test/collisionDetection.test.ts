import { beforeEach, describe, expect, it, vi } from 'vitest';

type ExtensionRow = {
  id: number;
  name: string;
  slug: string;
  standardStatus: 'ratified' | 'draft' | 'vendor' | 'research' | 'custom' | null;
  coupling: 'TIGHTLY_COUPLED' | 'LOOSELY_COUPLED' | 'HYBRID' | 'UNKNOWN';
  dispatch: 'INLINE' | 'ROCC' | 'PREFIX' | 'TRAP_EMULATE' | 'UNKNOWN';
  encodingSpace: string[];
  csrRange: string[];
  requiresCoreFeatures: string[];
};

type InstructionRow = {
  id: number;
  extensionId: number;
  version: string;
  mnemonic: string;
  opcode: number;
  funct3: number | null;
  funct7: number | null;
  format: string;
  csrAddress: number | null;
  createdAt: Date;
  updatedAt: Date;
};

const extensionsFixture: ExtensionRow[] = [
  {
    id: 1,
    name: 'Alpha',
    slug: 'alpha',
    standardStatus: 'ratified',
    coupling: 'UNKNOWN',
    dispatch: 'UNKNOWN',
    encodingSpace: ['custom-0'],
    csrRange: [],
    requiresCoreFeatures: [],
  },
  {
    id: 2,
    name: 'Beta',
    slug: 'beta',
    standardStatus: 'vendor',
    coupling: 'UNKNOWN',
    dispatch: 'UNKNOWN',
    encodingSpace: ['custom-0'],
    csrRange: [],
    requiresCoreFeatures: [],
  },
  {
    id: 3,
    name: 'Gamma',
    slug: 'gamma',
    standardStatus: 'vendor',
    coupling: 'UNKNOWN',
    dispatch: 'UNKNOWN',
    encodingSpace: ['custom-1'],
    csrRange: [],
    requiresCoreFeatures: [],
  },
  {
    id: 4,
    name: 'Delta',
    slug: 'delta',
    standardStatus: 'ratified',
    coupling: 'UNKNOWN',
    dispatch: 'UNKNOWN',
    encodingSpace: [],
    csrRange: [],
    requiresCoreFeatures: [],
  },
];

const instructionsFixture: InstructionRow[] = [
  {
    id: 11,
    extensionId: 1,
    version: '1.0.0',
    mnemonic: 'alpha.add',
    opcode: 0x0b,
    funct3: 2,
    funct7: 0,
    format: 'R',
    csrAddress: 0x800,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  },
  {
    id: 12,
    extensionId: 2,
    version: '1.0.0',
    mnemonic: 'beta.add',
    opcode: 0x0b,
    funct3: 2,
    funct7: 0,
    format: 'R',
    csrAddress: 0x800,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  },
  {
    id: 13,
    extensionId: 4,
    version: '1.0.0',
    mnemonic: 'delta.add',
    opcode: 0x33,
    funct3: 0,
    funct7: 0,
    format: 'R',
    csrAddress: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  },
  {
    id: 14,
    extensionId: 1,
    version: '1.0.0',
    mnemonic: 'alpha.sub',
    opcode: 0x33,
    funct3: 0,
    funct7: 0,
    format: 'R',
    csrAddress: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  },
];

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const prismaMock = vi.hoisted(() => ({
  extension: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  instruction: {
    findMany: vi.fn(),
  },
}));

vi.mock('../src/db', () => ({ prisma: prismaMock }));

import {
  checkCandidateOpcode,
  detectCollisions,
  detectCollisionsInSet,
} from '../src/lib/collisionDetection';

beforeEach(() => {
  const extRows = deepClone(extensionsFixture);
  const insRows = deepClone(instructionsFixture);

  prismaMock.extension.findUnique.mockImplementation(async (args: { where: { id: number } }) => {
    const id = args.where.id;
    return extRows.find((x) => x.id === id) ?? null;
  });

  prismaMock.extension.findMany.mockImplementation(async (args: { where?: any; select?: any }) => {
    const where = args?.where ?? {};
    let rows = [...extRows];
    if (where?.id?.in) {
      const allowed = new Set<number>(where.id.in);
      rows = rows.filter((r) => allowed.has(r.id));
    } else if (typeof where?.id?.not === 'number') {
      rows = rows.filter((r) => r.id !== where.id.not);
    }
    if (args?.select && Object.keys(args.select).length > 0) {
      return rows.map((r) => {
        const o: Record<string, unknown> = {};
        for (const key of Object.keys(args.select)) {
          if (args.select[key]) o[key] = (r as Record<string, unknown>)[key];
        }
        return o;
      });
    }
    return rows;
  });

  prismaMock.instruction.findMany.mockImplementation(async (args: { where?: any; select?: any }) => {
    const where = args?.where ?? {};
    let rows = [...insRows];

    if (where?.extensionId?.in) {
      const allowed = new Set<number>(where.extensionId.in);
      rows = rows.filter((r) => allowed.has(r.extensionId));
    }

    if (typeof where?.opcode === 'number') {
      rows = rows.filter(
        (r) =>
          r.opcode === where.opcode &&
          (where.funct3 ?? null) === (r.funct3 ?? null) &&
          (where.funct7 ?? null) === (r.funct7 ?? null),
      );
      if (typeof where?.extensionId?.not === 'number') {
        rows = rows.filter((r) => r.extensionId !== where.extensionId.not);
      }
      return rows.map((r) => ({
        extensionId: r.extensionId,
        mnemonic: r.mnemonic,
        opcode: r.opcode,
        funct3: r.funct3,
        funct7: r.funct7,
        extension: extRows.find((e) => e.id === r.extensionId)!,
      }));
    }
    return rows;
  });
});

describe('collisionDetection.detectCollisions', () => {
  it('returns empty list when no collisions exist against target set', async () => {
    const out = await detectCollisions(3, { against: [4] });
    expect(out).toEqual([]);
  });

  it('detects exact OPCODE tuple collision', async () => {
    const out = await detectCollisions(1, { against: [2] });
    expect(out.some((c) => c.type === 'OPCODE')).toBe(true);
  });

  it('detects CSR collision', async () => {
    const out = await detectCollisions(1, { against: [2] });
    expect(out.some((c) => c.type === 'CSR' && c.detail.includes('0x800'))).toBe(true);
  });

  it('detects CUSTOM_SPACE collision', async () => {
    const out = await detectCollisions(1, { against: [2] });
    expect(out.some((c) => c.type === 'CUSTOM_SPACE')).toBe(true);
  });

  it('uses WARNING when one side is remappable', async () => {
    const out = await detectCollisions(1, { against: [2] });
    const opcode = out.find((c) => c.type === 'OPCODE');
    expect(opcode?.severity).toBe('WARNING');
  });

  it('uses FATAL when both sides are fixed/non-remappable', async () => {
    const out = await detectCollisions(1, { against: [4] });
    const fatalOpcode = out.find((c) => c.type === 'OPCODE' && c.detail.includes('0x33'));
    expect(fatalOpcode?.severity).toBe('FATAL');
  });

  it('is idempotent across repeated runs', async () => {
    const first = await detectCollisions(1);
    const second = await detectCollisions(1);
    expect(second).toEqual(first);
  });
});

describe('collisionDetection.detectCollisionsInSet', () => {
  it('returns map entries for each requested extension id', async () => {
    const out = await detectCollisionsInSet([1, 2, 3, 4]);
    expect(out.has('1')).toBe(true);
    expect(out.has('2')).toBe(true);
    expect(out.has('3')).toBe(true);
    expect(out.has('4')).toBe(true);
  });
});

describe('collisionDetection.checkCandidateOpcode', () => {
  it('returns no conflicts for clean candidate', async () => {
    const out = await checkCandidateOpcode({
      opcode: 0x7b,
      funct3: 1,
      funct7: 1,
      format: 'R',
    });
    expect(out).toEqual([]);
  });

  it('returns conflicts for matching opcode tuple', async () => {
    const out = await checkCandidateOpcode({
      opcode: 0x0b,
      funct3: 2,
      funct7: 0,
      format: 'R',
    });
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].type).toBe('OPCODE');
  });
});
