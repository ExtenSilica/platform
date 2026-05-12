import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { packageReadinessSummary } from '../lib/packageReadinessSummary';
import { storage } from '../storage';
import { isPlatformAdminConfigured } from '../lib/platformAdmin';
import { passwordPolicyError } from '../passwordPolicy';
import {
  normalizeAuthority,
  normalizeStandardStatus,
  STANDARD_STATUS_VALUES,
} from '../lib/standardStatus';
import {
  normalizePortStatus,
  PORT_STATUS_VALUES,
} from '../lib/portStatus';

const MAX_PAGE = 200;
const BCRYPT_ROUNDS = 12;

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
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            ownedPackages: true,
            orgMemberships: true,
            // Count of currently-live ApiToken rows for this user. `where`
            // inside `_count.select` requires Prisma Client ≥ 5.0, which we use.
            apiTokens: { where: { revokedAt: null } },
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
      hasActiveToken: u._count.apiTokens > 0,
      activeTokenCount: u._count.apiTokens,
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
        versions: {
          where: { isYanked: false },
          orderBy: { publishedAt: 'desc' },
          take: 80,
        },
      },
    }),
    prisma.extension.count(),
  ]);

  res.json({
    total,
    skip,
    limit,
    packages: packages.map((p) => {
      const { maturityLevel, capabilityBadges } = packageReadinessSummary(p, p.versions);
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        latestVersion: p.latestVersion,
        totalDownloads: p.totalDownloads,
        weeklyDownloads: p.weeklyDownloads,
        isDeprecated: p.isDeprecated,
        versionCount: p._count.versions,
        readinessLevel: maturityLevel,
        maturityLevel,
        capabilityBadges,
        standardStatus: p.standardStatus ?? null,
        authority: p.authority ?? null,
        portStatus: p.portStatus ?? null,
        owner: p.owner
          ? { id: p.owner.id, username: p.owner.username, email: p.owner.email }
          : null,
        org: p.org
          ? { id: p.org.id, slug: p.org.slug, displayName: p.org.displayName }
          : null,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      };
    }),
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

/**
 * POST /admin/users
 * Body: { username, email, password, emailVerified?: boolean }
 */
export async function postAdminCreateUser(req: Request, res: Response): Promise<void> {
  const { username, email, password, emailVerified } = req.body ?? {};

  if (typeof username !== 'string' || !username.trim()) {
    res.status(400).json({ error: 'username is required.' });
    return;
  }
  if (typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({ error: 'A valid email is required.' });
    return;
  }
  if (typeof password !== 'string') {
    res.status(400).json({ error: 'password is required.' });
    return;
  }
  const pwErr = passwordPolicyError(password);
  if (pwErr) {
    res.status(400).json({ error: pwErr });
    return;
  }

  const normalizedUsername = username.trim().toLowerCase();
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: normalizedEmail }, { username: normalizedUsername }] },
    select: { id: true, email: true, username: true },
  });
  if (existing) {
    const field = existing.email === normalizedEmail ? 'email' : 'username';
    res.status(409).json({ error: `That ${field} is already registered.` });
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const created = await prisma.user.create({
    data: {
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
      emailVerifiedAt: emailVerified ? new Date() : null,
      emailVerificationTokenHash: null,
      emailVerificationExpires: null,
    },
  });

  res.status(201).json({
    user: {
      id: created.id,
      username: created.username,
      email: created.email,
      emailVerified: Boolean(created.emailVerifiedAt),
      createdAt: created.createdAt.toISOString(),
    },
  });
}

/**
 * PATCH /admin/users/:id
 * Body: { email?, bio?, avatarUrl?, emailVerified? }
 */
export async function patchAdminUser(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) {
    res.status(400).json({ error: 'Invalid user id.' });
    return;
  }

  const { email, bio, avatarUrl, emailVerified } = req.body ?? {};

  const patch: {
    email?: string;
    bio?: string | null;
    avatarUrl?: string | null;
    emailVerifiedAt?: Date | null;
    emailVerificationTokenHash?: string | null;
    emailVerificationExpires?: Date | null;
  } = {};

  if ('email' in (req.body ?? {})) {
    if (email === null || email === '') {
      res.status(400).json({ error: 'email cannot be empty.' });
      return;
    }
    if (typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ error: 'A valid email is required.' });
      return;
    }
    patch.email = email.trim().toLowerCase();
  }

  if ('bio' in (req.body ?? {})) {
    if (bio === null || bio === '') patch.bio = null;
    else if (typeof bio !== 'string') {
      res.status(400).json({ error: 'bio must be a string.' });
      return;
    } else patch.bio = bio.trim().slice(0, 2000);
  }

  if ('avatarUrl' in (req.body ?? {})) {
    if (avatarUrl === null || avatarUrl === '') patch.avatarUrl = null;
    else if (typeof avatarUrl !== 'string') {
      res.status(400).json({ error: 'avatarUrl must be a string.' });
      return;
    } else patch.avatarUrl = avatarUrl.trim().slice(0, 500);
  }

  if ('emailVerified' in (req.body ?? {})) {
    if (typeof emailVerified !== 'boolean') {
      res.status(400).json({ error: 'emailVerified must be a boolean.' });
      return;
    }
    if (emailVerified) {
      patch.emailVerifiedAt = new Date();
      patch.emailVerificationTokenHash = null;
      patch.emailVerificationExpires = null;
    } else {
      patch.emailVerifiedAt = null;
    }
  }

  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: 'Nothing to update.' });
    return;
  }

  try {
    const updated = await prisma.user.update({ where: { id }, data: patch });
    res.json({
      user: {
        id: updated.id,
        username: updated.username,
        email: updated.email,
        emailVerified: Boolean(updated.emailVerifiedAt),
        bio: updated.bio ?? null,
        avatarUrl: updated.avatarUrl ?? null,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    // Prisma unique violations show up as 500 otherwise; surface a friendly message.
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Unique constraint') || msg.includes('P2002')) {
      res.status(409).json({ error: 'email is already in use.' });
      return;
    }
    console.error('[admin/users/patch]', err);
    res.status(500).json({ error: 'Failed to update user.' });
  }
}

/**
 * POST /admin/users/:id/reset-password
 * Body: { password }
 */
export async function postAdminResetUserPassword(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) {
    res.status(400).json({ error: 'Invalid user id.' });
    return;
  }
  const { password } = req.body ?? {};
  if (typeof password !== 'string') {
    res.status(400).json({ error: 'password is required.' });
    return;
  }
  const pwErr = passwordPolicyError(password);
  if (pwErr) {
    res.status(400).json({ error: pwErr });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  // Reset is a credential-recovery flow: every existing session for this user
  // must die so the admin's new password is the only path back in.
  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { passwordHash } }),
    prisma.apiToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
  res.json({ ok: true });
}

/**
 * DELETE /admin/users/:id
 */
export async function deleteAdminUser(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) {
    res.status(400).json({ error: 'Invalid user id.' });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  await prisma.user.delete({ where: { id } });
  res.status(204).send();
}

/**
 * POST /admin/packages
 * Body: { slug, name, description, author, ownerUsername?, orgSlug? }
 */
export async function postAdminCreatePackage(req: Request, res: Response): Promise<void> {
  const { slug, name, description, author, ownerUsername, orgSlug } = req.body ?? {};

  if (typeof slug !== 'string' || !slug.trim()) {
    res.status(400).json({ error: 'slug is required.' });
    return;
  }
  if (typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'name is required.' });
    return;
  }
  if (typeof description !== 'string' || !description.trim()) {
    res.status(400).json({ error: 'description is required.' });
    return;
  }
  if (typeof author !== 'string' || !author.trim()) {
    res.status(400).json({ error: 'author is required.' });
    return;
  }

  const normalizedSlug = slug.trim();
  const exists = await prisma.extension.findUnique({ where: { slug: normalizedSlug }, select: { id: true } });
  if (exists) {
    res.status(409).json({ error: 'That package slug already exists.' });
    return;
  }

  let ownerId: number | null = null;
  if (typeof ownerUsername === 'string' && ownerUsername.trim()) {
    const u = await prisma.user.findUnique({ where: { username: ownerUsername.trim().toLowerCase() } });
    if (!u) {
      res.status(400).json({ error: `User not found: ${ownerUsername}` });
      return;
    }
    ownerId = u.id;
  }

  let orgId: number | null = null;
  if (typeof orgSlug === 'string' && orgSlug.trim()) {
    const org = await prisma.organization.findUnique({ where: { slug: orgSlug.trim() } });
    if (!org) {
      res.status(400).json({ error: `Org not found: ${orgSlug}` });
      return;
    }
    orgId = org.id;
  }

  const created = await prisma.extension.create({
    data: {
      slug: normalizedSlug,
      name: name.trim(),
      description: description.trim(),
      author: author.trim(),
      ownerId,
      orgId,
      keywords: '',
    },
    include: {
      owner: { select: { id: true, username: true, email: true } },
      org: { select: { id: true, slug: true, displayName: true } },
    },
  });

  res.status(201).json({
    package: {
      id: created.id,
      slug: created.slug,
      name: created.name,
      owner: created.owner
        ? { id: created.owner.id, username: created.owner.username, email: created.owner.email }
        : null,
      org: created.org
        ? { id: created.org.id, slug: created.org.slug, displayName: created.org.displayName }
        : null,
      createdAt: created.createdAt.toISOString(),
    },
  });
}

/**
 * PATCH /admin/packages/:slug
 * Body: editable package metadata + ownerUsername? + orgSlug?
 */
export async function patchAdminPackageBySlug(req: Request, res: Response): Promise<void> {
  const slug = String(req.params.slug ?? '').trim();
  if (!slug) {
    res.status(400).json({ error: 'slug is required.' });
    return;
  }
  const pkg = await prisma.extension.findUnique({ where: { slug } });
  if (!pkg) {
    res.status(404).json({ error: 'Package not found.' });
    return;
  }

  const {
    name,
    description,
    shortDescription,
    longDescription,
    keywords,
    license,
    repositoryUrl,
    homepageUrl,
    isDeprecated,
    deprecationMessage,
    ownerUsername,
    orgSlug,
    standardStatus: standardStatusRaw,
    authority: authorityRaw,
    portStatus: portStatusRaw,
  } = req.body ?? {};

  const patch: Record<string, unknown> = {};
  const setIf = (k: string, v: unknown) => {
    if (k in (req.body ?? {})) patch[k] = v;
  };

  if ('name' in (req.body ?? {})) {
    if (typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'name must be a non-empty string.' });
      return;
    }
    patch.name = name.trim();
  }
  if ('description' in (req.body ?? {})) {
    if (typeof description !== 'string' || !description.trim()) {
      res.status(400).json({ error: 'description must be a non-empty string.' });
      return;
    }
    patch.description = description.trim();
  }
  if ('shortDescription' in (req.body ?? {})) setIf('shortDescription', shortDescription ? String(shortDescription).trim() : null);
  if ('longDescription' in (req.body ?? {})) setIf('longDescription', longDescription ? String(longDescription) : null);
  if ('keywords' in (req.body ?? {})) setIf('keywords', typeof keywords === 'string' ? keywords.trim() : '');
  if ('license' in (req.body ?? {})) setIf('license', license ? String(license).trim() : null);
  if ('repositoryUrl' in (req.body ?? {})) setIf('repositoryUrl', repositoryUrl ? String(repositoryUrl).trim() : null);
  if ('homepageUrl' in (req.body ?? {})) setIf('homepageUrl', homepageUrl ? String(homepageUrl).trim() : null);
  if ('isDeprecated' in (req.body ?? {})) {
    if (typeof isDeprecated !== 'boolean') {
      res.status(400).json({ error: 'isDeprecated must be boolean.' });
      return;
    }
    patch.isDeprecated = isDeprecated;
  }
  if ('deprecationMessage' in (req.body ?? {})) setIf('deprecationMessage', deprecationMessage ? String(deprecationMessage) : null);

  if ('ownerUsername' in (req.body ?? {})) {
    if (ownerUsername === null || ownerUsername === '') {
      patch.ownerId = null;
    } else if (typeof ownerUsername === 'string') {
      const u = await prisma.user.findUnique({ where: { username: ownerUsername.trim().toLowerCase() } });
      if (!u) {
        res.status(400).json({ error: `User not found: ${ownerUsername}` });
        return;
      }
      patch.ownerId = u.id;
    } else {
      res.status(400).json({ error: 'ownerUsername must be a string or null.' });
      return;
    }
  }

  if ('orgSlug' in (req.body ?? {})) {
    if (orgSlug === null || orgSlug === '') {
      patch.orgId = null;
    } else if (typeof orgSlug === 'string') {
      const org = await prisma.organization.findUnique({ where: { slug: orgSlug.trim() } });
      if (!org) {
        res.status(400).json({ error: `Org not found: ${orgSlug}` });
        return;
      }
      patch.orgId = org.id;
    } else {
      res.status(400).json({ error: 'orgSlug must be a string or null.' });
      return;
    }
  }

  // Honest classification + provenance — admins may set/clear both freely.
  if ('standardStatus' in (req.body ?? {})) {
    if (standardStatusRaw === null || standardStatusRaw === '') {
      patch.standardStatus = null;
    } else {
      const normalized = normalizeStandardStatus(standardStatusRaw);
      if (normalized === null) {
        res.status(400).json({
          error: `standardStatus must be one of: ${STANDARD_STATUS_VALUES.join(', ')}.`,
        });
        return;
      }
      patch.standardStatus = normalized;
    }
  }
  if ('authority' in (req.body ?? {})) {
    patch.authority = normalizeAuthority(authorityRaw);
  }
  if ('portStatus' in (req.body ?? {})) {
    if (portStatusRaw === null || portStatusRaw === '') {
      patch.portStatus = null;
    } else {
      const normalized = normalizePortStatus(portStatusRaw);
      if (normalized === null) {
        res.status(400).json({
          error: `portStatus must be one of: ${PORT_STATUS_VALUES.join(', ')}.`,
        });
        return;
      }
      patch.portStatus = normalized;
    }
  }

  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: 'Nothing to update.' });
    return;
  }

  const updated = await prisma.extension.update({
    where: { id: pkg.id },
    data: patch,
    include: {
      owner: { select: { id: true, username: true, email: true } },
      org: { select: { id: true, slug: true, displayName: true } },
      _count: { select: { versions: true } },
      versions: {
        where: { isYanked: false },
        orderBy: { publishedAt: 'desc' },
        take: 80,
      },
    },
  });

  const { maturityLevel, capabilityBadges } = packageReadinessSummary(updated, updated.versions);

  res.json({
    package: {
      id: updated.id,
      slug: updated.slug,
      name: updated.name,
      description: updated.description,
      shortDescription: updated.shortDescription ?? null,
      longDescription: updated.longDescription ?? null,
      keywords: updated.keywords,
      license: updated.license ?? null,
      repositoryUrl: updated.repositoryUrl ?? null,
      homepageUrl: updated.homepageUrl ?? null,
      isDeprecated: updated.isDeprecated,
      deprecationMessage: updated.deprecationMessage ?? null,
      standardStatus: updated.standardStatus ?? null,
      authority: updated.authority ?? null,
      portStatus: updated.portStatus ?? null,
      latestVersion: updated.latestVersion ?? null,
      totalDownloads: updated.totalDownloads,
      weeklyDownloads: updated.weeklyDownloads,
      versionCount: updated._count.versions,
      readinessLevel: maturityLevel,
      maturityLevel,
      capabilityBadges,
      owner: updated.owner
        ? { id: updated.owner.id, username: updated.owner.username, email: updated.owner.email }
        : null,
      org: updated.org
        ? { id: updated.org.id, slug: updated.org.slug, displayName: updated.org.displayName }
        : null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}

/**
 * DELETE /admin/packages/:slug
 */
export async function deleteAdminPackage(req: Request, res: Response): Promise<void> {
  const slug = String(req.params.slug ?? '').trim();
  if (!slug) {
    res.status(400).json({ error: 'slug is required.' });
    return;
  }
  const pkg = await prisma.extension.findUnique({ where: { slug }, select: { id: true } });
  if (!pkg) {
    res.status(404).json({ error: 'Package not found.' });
    return;
  }
  await prisma.extension.delete({ where: { id: pkg.id } });
  res.status(204).send();
}
