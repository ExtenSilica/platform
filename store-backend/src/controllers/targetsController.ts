import { Request, Response } from 'express';
import { prisma } from '../db';

/** Public target catalog with live Port and reward-opportunity counts. */
export async function listTargets(_req: Request, res: Response): Promise<void> {
  try {
    const [targets, verified, openRequests] = await Promise.all([
      prisma.target.findMany({
        orderBy: [{ kind: 'asc' }, { name: 'asc' }],
        include: { _count: { select: { ports: true } } },
      }),
      prisma.port.groupBy({
        by: ['targetId'],
        where: { verificationStatus: 'verified' },
        _count: { _all: true },
      }),
      prisma.implementationRequest.groupBy({
        by: ['targetId'],
        where: {
          targetId: { not: null },
          status: { in: ['open', 'in_progress', 'submitted'] },
        },
        _count: { _all: true },
        _sum: { rewardXsil: true },
      }),
    ]);

    const verifiedByTarget = new Map(verified.map((row) => [row.targetId, row._count._all]));
    const requestsByTarget = new Map(
      openRequests
        .filter((row): row is typeof row & { targetId: number } => row.targetId !== null)
        .map((row) => [row.targetId, row]),
    );

    res.json(targets.map((target) => {
      const request = requestsByTarget.get(target.id);
      return {
        id: target.id,
        slug: target.slug,
        name: target.name,
        kind: target.kind,
        description: target.description,
        homepageUrl: target.homepageUrl,
        architecture: target.architecture,
        portCount: target._count.ports,
        verifiedPortCount: verifiedByTarget.get(target.id) ?? 0,
        openPortRequestCount: request?._count._all ?? 0,
        availableRewardXsil: request?._sum.rewardXsil ?? 0,
      };
    }));
  } catch (error) {
    console.error('[targets/list]', error);
    res.status(500).json({ error: 'Failed to list targets.' });
  }
}
