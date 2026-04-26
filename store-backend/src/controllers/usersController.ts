import { Request, Response } from 'express';
import { prisma } from '../db';
import { sortBySemverDesc } from '../lib/semverSort';
import { computePackageMaturityFromVersion } from '../lib/maturity';

// GET /users/:username
// Public profile — never exposes email, password hash, or API token.
export const getUserProfile = async (req: Request, res: Response) => {
  const { username } = req.params;

  // Usernames are stored lowercase at registration time; normalise the lookup
  // so /users/Alice and /users/alice both resolve correctly.
  const user = await prisma.user.findFirst({
    where: { username: username.toLowerCase() },
    select: {
      id:        true,
      username:  true,
      bio:       true,
      avatarUrl: true,
      createdAt: true,
      ownedPackages: {
        where: { orgId: null }, // personal packages only (scoped live under orgs)
        include: {
          versions: {
            where: { isYanked: false },
            orderBy: { publishedAt: 'desc' },
            take: 80,
          },
        },
        orderBy: { totalDownloads: 'desc' },
      },
    },
  });

  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  res.json({
    id:        user.id,
    username:  user.username,
    bio:       user.bio       ?? null,
    avatarUrl: user.avatarUrl ?? null,
    createdAt: user.createdAt.toISOString(),
    packages:  user.ownedPackages.map((p) => {
      const nonY = p.versions.filter((v) => !v.isYanked);
      const sorted = sortBySemverDesc(nonY);
      const latest = sorted[0] ?? sortBySemverDesc(p.versions)[0];
      const { level, badges } = computePackageMaturityFromVersion(latest ?? null);
      return {
        slug:            p.slug,
        name:            p.name,
        description:     p.description ?? '',
        latestVersion:   p.latestVersion ?? null,
        totalDownloads:  p.totalDownloads,
        weeklyDownloads: p.weeklyDownloads,
        maturityLevel:   level,
        capabilityBadges: badges,
      };
    }),
  });
};
