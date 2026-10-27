import { Request, Response } from 'express';
import { prisma } from '../db';
import { packageReadinessSummary } from '../lib/packageReadinessSummary';

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
      bio:                  true,
      avatarUrl:            true,
      implementerGithubUrl: true,
      implementerBio:       true,
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
    bio:                  user.bio ?? null,
    avatarUrl:            user.avatarUrl ?? null,
    implementerGithubUrl: user.implementerGithubUrl ?? null,
    implementerBio:       user.implementerBio ?? null,
    createdAt: user.createdAt.toISOString(),
    packages:  user.ownedPackages.map((p) => {
      const { maturityLevel, capabilityBadges } = packageReadinessSummary(p, p.versions);
      return {
        slug:            p.slug,
        name:            p.name,
        description:     p.description ?? '',
        latestVersion:   p.latestVersion ?? null,
        totalDownloads:  p.totalDownloads,
        weeklyDownloads: p.weeklyDownloads,
        readinessLevel: maturityLevel,
        maturityLevel,
        capabilityBadges,
      };
    }),
  });
};

/** GET /users/:username/contributions — public coordination history (PR-B2). */
export const getUserContributions = async (req: Request, res: Response) => {
  const username = String(req.params.username ?? '').trim().toLowerCase();
  if (!username) {
    res.status(400).json({ error: 'username is required.' });
    return;
  }

  const user = await prisma.user.findFirst({
    where: { username },
    select: { id: true, username: true },
  });
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const publicRequestWhere = {
    visibility: 'public' as const,
    status: { not: 'draft' as const },
  };

  const [requestsCreated, submissions, verifications] = await Promise.all([
    prisma.implementationRequest.findMany({
      where: {
        createdByUserId: user.id,
        ...publicRequestWhere,
      },
      include: {
        package: { select: { slug: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.implementationSubmission.findMany({
      where: {
        submittedById: user.id,
        status: 'submitted',
        request: publicRequestWhere,
      },
      include: {
        request: {
          include: { package: { select: { slug: true, name: true } } },
        },
        verificationRuns: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { submittedAt: 'desc' },
      take: 50,
    }),
    prisma.verificationRun.findMany({
      where: {
        verifierId: user.id,
        submission: {
          request: publicRequestWhere,
        },
      },
      include: {
        submission: {
          include: {
            request: {
              include: { package: { select: { slug: true, name: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

  res.json({
    username: user.username,
    requestsCreated: requestsCreated.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      packageSlug: r.package.slug,
      packageName: r.package.name,
      createdAt: r.createdAt.toISOString(),
    })),
    submissions: submissions.map((s) => ({
      id: s.id,
      requestId: s.requestId,
      requestTitle: s.request.title,
      packageSlug: s.request.package.slug,
      packageName: s.request.package.name,
      status: s.status,
      submittedAt: s.submittedAt?.toISOString() ?? null,
      latestVerificationOutcome: s.verificationRuns[0]?.outcome ?? null,
    })),
    verifications: verifications.map((v) => ({
      id: v.id,
      submissionId: v.submissionId,
      requestId: v.submission.requestId,
      requestTitle: v.submission.request.title,
      packageSlug: v.submission.request.package.slug,
      packageName: v.submission.request.package.name,
      outcome: v.outcome,
      createdAt: v.createdAt.toISOString(),
    })),
  });
};
