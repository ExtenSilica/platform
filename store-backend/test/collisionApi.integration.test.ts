import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';

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
];

const instructionsFixture: InstructionRow[] = [
  {
    id: 21,
    extensionId: 1,
    version: '1.0.0',
    mnemonic: 'alpha.op',
    opcode: 0x0b,
    funct3: 2,
    funct7: 0,
    format: 'R',
    csrAddress: 0x800,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  },
  {
    id: 22,
    extensionId: 2,
    version: '1.0.0',
    mnemonic: 'beta.op',
    opcode: 0x0b,
    funct3: 2,
    funct7: 0,
    format: 'R',
    csrAddress: 0x800,
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

import collisionRoutes from '../src/routes/collision';

let baseUrl = '';
let server: ReturnType<express.Express['listen']> | null = null;

beforeEach(async () => {
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

  const app = express();
  app.use(express.json());
  app.use('/api', collisionRoutes);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const addr = server!.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterEach(async () => {
  if (!server) return;
  await new Promise<void>((resolve, reject) =>
    server!.close((err) => (err ? reject(err) : resolve())),
  );
  server = null;
});

describe('collision API integration', () => {
  it('GET /api/package/:id/conflicts returns expected contract shape', async () => {
    const res = await fetch(`${baseUrl}/api/package/1/conflicts`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.extensionId).toBe('1');
    expect(typeof body.extensionName).toBe('string');
    expect(Array.isArray(body.conflicts)).toBe(true);
    expect(typeof body.checkedAt).toBe('string');
  });

  it('POST /api/opcodes/check returns collides and conflicts', async () => {
    const res = await fetch(`${baseUrl}/api/opcodes/check`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        opcode: 11,
        funct3: 2,
        funct7: 0,
        format: 'R',
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      collides: boolean;
      conflicts: Array<Record<string, unknown>>;
    };
    expect(body.collides).toBe(true);
    expect(Array.isArray(body.conflicts)).toBe(true);
    expect(body.conflicts.length).toBeGreaterThan(0);
  });

  it('POST /api/resolve returns results and fatal flag', async () => {
    const res = await fetch(`${baseUrl}/api/resolve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ extensionIds: ['1', '2'] }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      results: Array<{ extensionId: string; conflicts: Array<Record<string, unknown>> }>;
      hasFatalConflicts: boolean;
    };
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.results.length).toBe(2);
    expect(typeof body.hasFatalConflicts).toBe('boolean');
  });
});
