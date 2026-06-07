import type { Request, Response } from 'express';
import { prisma } from '../db';
import {
  checkCandidateOpcode,
  detectCollisions,
  detectCollisionsInSet,
} from '../lib/collisionDetection';

export async function getExtensionConflicts(req: Request, res: Response): Promise<void> {
  const rawId = req.params.id;
  if (!rawId || !/^\d+$/.test(rawId)) {
    res.status(400).json({ error: 'Extension id must be a positive integer string.' });
    return;
  }
  const extensionId = Number.parseInt(rawId, 10);
  const extension = await prisma.extension.findUnique({
    where: { id: extensionId },
    select: { id: true, name: true },
  });
  if (!extension) {
    res.status(404).json({ error: 'Extension not found.' });
    return;
  }

  try {
    const conflicts = await detectCollisions(extensionId);
    res.json({
      extensionId: String(extension.id),
      extensionName: extension.name,
      conflicts,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[collisions/getExtensionConflicts]', err);
    res.status(500).json({ error: 'Failed to compute extension conflicts.' });
  }
}

export async function postCheckOpcode(req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const opcode = body.opcode;
  const format = body.format;
  const funct3 = body.funct3;
  const funct7 = body.funct7;
  const funct12 = body.funct12;
  const mnemonic = body.mnemonic;
  const excludeExtensionId = body.excludeExtensionId;

  if (!Number.isInteger(opcode) || (opcode as number) < 0 || (opcode as number) > 0x7f) {
    res.status(400).json({ error: 'opcode must be an integer between 0 and 127.' });
    return;
  }
  if (typeof format !== 'string' || format.trim().length === 0) {
    res.status(400).json({ error: 'format is required.' });
    return;
  }
  if (funct3 !== undefined && funct3 !== null) {
    if (!Number.isInteger(funct3) || (funct3 as number) < 0 || (funct3 as number) > 0b111) {
      res.status(400).json({ error: 'funct3 must be an integer between 0 and 7 when provided.' });
      return;
    }
  }
  if (funct7 !== undefined && funct7 !== null) {
    if (!Number.isInteger(funct7) || (funct7 as number) < 0 || (funct7 as number) > 0b1111111) {
      res.status(400).json({ error: 'funct7 must be an integer between 0 and 127 when provided.' });
      return;
    }
  }
  if (funct12 !== undefined && funct12 !== null) {
    if (!Number.isInteger(funct12) || (funct12 as number) < 0 || (funct12 as number) > 0xfff) {
      res.status(400).json({ error: 'funct12 must be an integer between 0 and 4095 when provided.' });
      return;
    }
  }
  if (mnemonic !== undefined && mnemonic !== null) {
    if (typeof mnemonic !== 'string' || mnemonic.trim().length === 0 || mnemonic.length > 64) {
      res.status(400).json({ error: 'mnemonic must be a 1..64 character string when provided.' });
      return;
    }
  }
  if (excludeExtensionId !== undefined && excludeExtensionId !== null) {
    if (typeof excludeExtensionId !== 'string' || !/^\d+$/.test(excludeExtensionId)) {
      res.status(400).json({ error: 'excludeExtensionId must be a positive integer string when provided.' });
      return;
    }
  }

  try {
    const conflicts = await checkCandidateOpcode(
      {
        opcode: opcode as number,
        funct3: funct3 as number | undefined,
        funct7: funct7 as number | undefined,
        funct12: funct12 as number | undefined,
        format: format.trim(),
        mnemonic: typeof mnemonic === 'string' ? mnemonic.trim() : undefined,
      },
      {
        excludeExtensionId: excludeExtensionId as string | undefined,
      },
    );
    res.json({
      collides: conflicts.length > 0,
      conflicts,
    });
  } catch (err) {
    console.error('[collisions/postCheckOpcode]', err);
    res.status(500).json({ error: 'Failed to check candidate opcode.' });
  }
}

export async function postResolve(req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const extensionIds = body.extensionIds;
  if (!Array.isArray(extensionIds) || extensionIds.length === 0) {
    res.status(400).json({ error: 'extensionIds must be a non-empty array of id strings.' });
    return;
  }
  if (!extensionIds.every((id) => typeof id === 'string' && /^\d+$/.test(id))) {
    res.status(400).json({ error: 'extensionIds must contain only positive integer strings.' });
    return;
  }

  try {
    const resultMap = await detectCollisionsInSet(extensionIds as string[]);
    const results = (extensionIds as string[]).map((id) => ({
      extensionId: id,
      conflicts: resultMap.get(id) ?? [],
    }));
    const hasFatalConflicts = results.some((r) => r.conflicts.some((c) => c.severity === 'FATAL'));
    res.json({ results, hasFatalConflicts });
  } catch (err) {
    console.error('[collisions/postResolve]', err);
    res.status(500).json({ error: 'Failed to resolve collision set.' });
  }
}
