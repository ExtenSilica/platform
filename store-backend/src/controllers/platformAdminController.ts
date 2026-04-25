import { Request, Response } from 'express';
import { prisma } from '../db';
import { storage } from '../storage';
import { isPlatformAdminConfigured } from '../lib/platformAdmin';

const MAX_PAGE = 200;

function clampLimit(raw: unknown): number {
  const n = parseInt(String(raw ?? ''), 10);
  if (Number.isNaN(n) || n < 1) return 50;
  return Math.min(n, MAX_PAGE);
}

function clampSkip(raw: unknown): number {
  const n = parseInt(String(raw ?? ''), 10);
  if (Number.isNaN(n) || n < 0) return 0;
  return n;
}

/**
 * GET /admin/health
 */
export async function getAdminHealth(_req: Request, res: Response): Promise<void> {
  const started = Date.now();
  let database: 'ok' | 'error' = 'error';
  let storageOk: 'ok' | 'error' = 'error';
  let storageError: string | undefined;

  try {
    await prisma.$queryRaw`SELECT 1`;
    database = 'ok';
  } catch (err) {
    console.error('[admin/health] database', err);
  }

  try {
    await storage.exists('__admin_health_probe__');
    storageOk = 'ok';
  } catch (err) {
    storageError = err instanceof Error ? err.message : String(err);
    console.error('[admin/health] storage', err);
  }

  const [userCount, packageCount, versionCount, orgCount] = await Promise.all([
    prisma.user.count(),
    prisma.extension.count(),
    prisma.version.count(),
    prisma.organization.count(),
  ]);

  res.json({
    ok: database === 'ok' && storageOk === 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    latencyMs: Date.now() - started,
    database,
    storage: { ok: storageOk, driver: storage.name, error: storageError },
    counts: {
      users: userCount,
      packages: packageCount,
      versions: versionCount,
      organizations: orgCount,
    },
    platformAdminConfigured: isPlatformAdminConfigured(),
  });
}

/**
 * GET /admin/users
 */
export async function listAdminUsers(req: Request, res: Response): Promise<void> {
  const limit = clampLimit(req.query.limit);
  const skip = clampSkip(req.query.skip);

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      skip,
      take: limit,
      orderBy: { id: 'asc' },
      select: {
        id: true,
        username: true,
        email: true,
        emailVerifiedAt: true,
        apiToken: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            ownedPackages: true,
            orgMemberships: true,
          },
        },
      },
    }),
    prisma.user.count(),
  ]);

  res.json({
    total,
    skip,
    limit,
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      emailVerified: Boolean(u.emailVerifiedAt),
      emailVerifiedAt: u.emailVerifiedAt?.toISOString() ?? null,
      hasActiveToken: Boolean(u.apiToken),
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
      ownedPackageCount: u._count.ownedPackages,
      orgMembershipCount: u._count.orgMemberships,
    })),
  });
}

/**
 * GET /admin/packages
 */
export async function listAdminPackages(req: Request, res: Response): Promise<void> {
  const limit = clampLimit(req.query.limit);
  const skip = clampSkip(req.query.skip);

  const [packages, total] = await Promise.all([
    prisma.extension.findMany({
      skip,
      take: limit,
      orderBy: { id: 'asc' },
      include: {
        owner: { select: { id: true, username: true, email: true } },
        org: { select: { id: true, slug: true, displayName: true } },
        _count: { select: { versions: true } },
      },
    }),
    prisma.extension.count(),
  ]);

  res.json({
    total,
    skip,
    limit,
    packages: packages.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      latestVersion: p.latestVersion,
      totalDownloads: p.totalDownloads,
      weeklyDownloads: p.weeklyDownloads,
      isDeprecated: p.isDeprecated,
      versionCount: p._count.versions,
      owner: p.owner
        ? { id: p.owner.id, username: p.owner.username, email: p.owner.email }
        : null,
      org: p.org
        ? { id: p.org.id, slug: p.org.slug, displayName: p.org.displayName }
        : null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
  });
}

/**
 * PATCH /admin/packages
 * Body: { slug: string, ownerUsername: string | null }
 */
export async function patchAdminPackage(req: Request, res: Response): Promise<void> {
  const { slug, ownerUsername } = req.body ?? {};

  if (!slug || typeof slug !== 'string' || !slug.trim()) {
    res.status(400).json({ error: 'slug is required.' });
    return;
  }

  if (!('ownerUsername' in (req.body ?? {}))) {
    res.status(400).json({ error: 'ownerUsername is required (string or null to clear).' });
    return;
  }

  const normalizedSlug = slug.trim();
  const pkg = await prisma.extension.findUnique({ where: { slug: normalizedSlug } });
  if (!pkg) {
    res.status(404).json({ error: 'Package not found.' });
    return;
  }

  let ownerId: number | null = pkg.ownerId;
  if (ownerUsername === null || ownerUsername === '') {
    ownerId = null;
  } else if (typeof ownerUsername === 'string') {
    const u = await prisma.user.findUnique({
      where: { username: ownerUsername.trim().toLowerCase() },
    });
    if (!u) {
      res.status(400).json({ error: `User not found: ${ownerUsername}` });
      return;
    }
    ownerId = u.id;
  } else {
    res.status(400).json({ error: 'ownerUsername must be a string or null.' });
    return;
  }

  const updated = await prisma.extension.update({
    where: { id: pkg.id },
    data: { ownerId },
    include: {
      owner: { select: { id: true, username: true, email: true } },
      org: { select: { id: true, slug: true, displayName: true } },
    },
  });

  res.json({
    package: {
      id: updated.id,
      slug: updated.slug,
      name: updated.name,
      owner: updated.owner
        ? { id: updated.owner.id, username: updated.owner.username, email: updated.owner.email }
        : null,
      org: updated.org,
    },
  });
}

/**
 * POST /admin/users/:id/verify-email
 */
export async function postAdminVerifyUserEmail(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) {
    res.status(400).json({ error: 'Invalid user id.' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      emailVerifiedAt: new Date(),
      emailVerificationTokenHash: null,
      emailVerificationExpires: null,
    },
  });

  res.json({
    user: {
      id: updated.id,
      username: updated.username,
      email: updated.email,
      emailVerified: true,
      emailVerifiedAt: updated.emailVerifiedAt!.toISOString(),
    },
  });
}
