import { Request, Response } from 'express';
import { Extension, Version } from '@prisma/client';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as semver from 'semver';
import { prisma } from '../db';
import {
  validatePublishedXsilBuffer,
  XsilValidationError,
} from '../lib/xsilPublishValidate';
import { storage } from '../storage';

export type ExtensionWithVersions = Extension & { versions: Version[] };

const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([\w.-]+))?(?:\+([\w.-]+))?$/;

// ── Package name policy ───────────────────────────────────────────────────────
//
// Rules (see docs/name-policy-v3.md for rationale):
//   1. Allowed characters: lowercase letters, digits, hyphens.
//      Underscores are normalised to hyphens during slug generation.
//   2. Length: 2–64 characters.
//   3. Must start and end with a letter or digit (no leading/trailing hyphen).
//   4. Reserved names below are permanently blocked.
//
// Decisions NOT enforced in code (documented only):
//   - Typosquatting similarity checks (future work, too many false-positives).
//   - Automated name-reclamation for abandoned packages (no-versions after 30 days).

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$|^[a-z0-9]{1,2}$/;

const NAME_MIN = 2;
const NAME_MAX = 64;

/**
 * Names that can never be registered, regardless of who asks.
 * Covers platform identifiers, privilege names, common stubs, and single words
 * that would give a false sense of "official" ownership.
 */
const RESERVED_NAMES = new Set<string>([
  // Platform / brand
  'xsil', 'extensilica', 'registry', 'store', 'platform',

  // Privilege / system
  'admin', 'administrator', 'root', 'system', 'superuser', 'sudo',
  'moderator', 'staff', 'support', 'official', 'security',

  // Common stubs / placeholder abuse
  'test', 'testing', 'demo', 'example', 'sample', 'placeholder',
  'undefined', 'null', 'none', 'noop', 'empty', 'blank',
  'todo', 'fixme', 'temp', 'tmp',

  // Generic top-level words that cause namespace pollution
  'lib', 'core', 'base', 'common', 'utils', 'util', 'tools',
  'api', 'sdk', 'cli', 'app', 'pkg', 'package',
  'v1', 'v2', 'v3',
]);

/**
 * Validate a normalised package slug.
 * Returns an error message string, or `null` if the slug is valid.
 */
function validatePackageSlug(slug: string): string | null {
  if (slug.length < NAME_MIN) {
    return `Package name is too short (minimum ${NAME_MIN} characters).`;
  }
  if (slug.length > NAME_MAX) {
    return `Package name is too long (maximum ${NAME_MAX} characters).`;
  }
  if (!SLUG_RE.test(slug)) {
    return 'Package name may only contain lowercase letters, digits, and hyphens, and must start and end with a letter or digit.';
  }
  if (RESERVED_NAMES.has(slug)) {
    return `"${slug}" is a reserved name and cannot be used for a package.`;
  }
  return null;
}

/**
 * Sort versions by semver descending (newest first).
 * Versions that are not valid semver strings are placed at the end.
 */
function sortBySemverDesc<T extends { version: string }>(versions: T[]): T[] {
  return [...versions].sort((a, b) => {
    const av = semver.valid(a.version);
    const bv = semver.valid(b.version);
    if (av && bv) return semver.rcompare(av, bv);
    if (av) return -1; // valid sorts before invalid
    if (bv) return 1;
    return a.version.localeCompare(b.version);
  });
}

/**
 * Return the highest non-yanked semver from a list of version records.
 * Falls back to the highest yanked version if all are yanked.
 */
function firstFormString(body: Record<string, unknown>, key: string): string | undefined {
  const v = body[key];
  if (v == null) return undefined;
  if (Array.isArray(v)) {
    const x = v[0];
    return typeof x === 'string' ? x : undefined;
  }
  return typeof v === 'string' ? v : undefined;
}

function computeLatestVersion(versions: Array<{ version: string; isYanked: boolean }>): string | null {
  const valid = (v: string) => semver.valid(v) !== null;
  const rcompare = (a: string, b: string) => semver.rcompare(a, b);

  const active = versions.filter((v) => !v.isYanked && valid(v.version));
  if (active.length > 0) return active.sort((a, b) => rcompare(a.version, b.version))[0].version;

  const all = versions.filter((v) => valid(v.version));
  if (all.length > 0) return all.sort((a, b) => rcompare(a.version, b.version))[0].version;

  return null;
}

function mapVersion(v: Version) {
  return {
    id: v.id,
    version: v.version,
    changelog: v.changelog,
    xsilUrl: v.xsilUrl,
    checksum: v.checksum,
    checksumPayload: v.checksumPayload,
    targets: v.targets,
    toolchain: v.toolchain,
    isa: v.isa,
    size: v.size,
    downloadCount: v.downloadCount,
    isYanked: v.isYanked,
    yankReason: v.yankReason,
    publishedAt: v.publishedAt.toISOString(),
  };
}

interface ReviewStats {
  reviewCount: number;
  averageRating: number | null;
}

export function mapPackage(
  ext: ExtensionWithVersions,
  reviewStats: ReviewStats = { reviewCount: 0, averageRating: null },
) {
  // Always return versions in semver descending order so clients can rely on ordering.
  const versions = sortBySemverDesc(ext.versions.map(mapVersion));
  const latest = versions.find((v) => !v.isYanked) ?? versions[0];

  return {
    id: ext.id,
    slug: ext.slug,
    name: ext.name,
    description: ext.description,
    shortDescription: ext.shortDescription,
    longDescription: (ext as Extension & { longDescription?: string | null }).longDescription ?? null,
    author: ext.author,
    ownerId: ext.ownerId,
    iconUrl: ext.iconUrl,
    keywords: ext.keywords ? ext.keywords.split(',').map((t) => t.trim()).filter(Boolean) : [],
    license: ext.license,
    repositoryUrl: ext.repositoryUrl,
    homepageUrl: ext.homepageUrl,
    latestVersion: ext.latestVersion ?? latest?.version ?? null,
    totalDownloads: ext.totalDownloads,
    weeklyDownloads: ext.weeklyDownloads,
    isDeprecated: ext.isDeprecated,
    deprecationMessage: (ext as Extension & { deprecationMessage?: string | null }).deprecationMessage ?? null,
    reviewCount: reviewStats.reviewCount,
    averageRating: reviewStats.averageRating,
    createdAt: ext.createdAt.toISOString(),
    updatedAt: ext.updatedAt.toISOString(),
    versions,
  };
}

/* ─── Read ──────────────────────────────────────────────────────────────── */

export const listPackages = async (req: Request, res: Response) => {
  const { q } = req.query;
  const where: { OR?: Array<Record<string, { contains: string }>> } = {};

  if (q && typeof q === 'string' && q.trim()) {
    where.OR = [
      { name: { contains: q } },
      { description: { contains: q } },
      { keywords: { contains: q } },
    ];
  }

  try {
    const packages = await prisma.extension.findMany({
      where,
      include: {
        versions: {
          where: { isYanked: false },
          orderBy: { publishedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(packages.map((p) => mapPackage(p)));
  } catch (error) {
    console.error('[packages/list]', error);
    res.status(500).json({ error: 'Failed to list packages.' });
  }
};

export const getPackageBySlug = async (req: Request, res: Response) => {
  const { name } = req.params;
  try {
    const [pkg, reviewAgg] = await Promise.all([
      prisma.extension.findUnique({
        where: { slug: name },
        include: { versions: { orderBy: { publishedAt: 'desc' } } },
      }),
      prisma.review.aggregate({
        where: { package: { slug: name } },
        _avg: { rating: true },
        _count: { id: true },
      }),
    ]);
    if (!pkg) {
      res.status(404).json({ error: 'Package not found.' });
      return;
    }
    res.json(mapPackage(pkg, {
      reviewCount: reviewAgg._count.id,
      averageRating: reviewAgg._avg.rating,
    }));
  } catch (error) {
    console.error('[packages/slug]', error);
    res.status(500).json({ error: 'Failed to fetch package.' });
  }
};

export const getPackageVersion = async (req: Request, res: Response) => {
  const { name, version } = req.params;
  try {
    const pkg = await prisma.extension.findUnique({
      where: { slug: name },
      include: { versions: { orderBy: { publishedAt: 'desc' } } },
    });
    if (!pkg) {
      res.status(404).json({ error: 'Package not found.' });
      return;
    }

    const sortedVersions = sortBySemverDesc(pkg.versions);

    let target: Version | undefined;
    if (version === 'latest') {
      target = sortedVersions.find((v) => !v.isYanked) ?? sortedVersions[0];
    } else {
      target = sortedVersions.find((v) => v.version === version);
    }

    if (!target) {
      res.status(404).json({ error: `Version '${version}' not found for package '${name}'.` });
      return;
    }

    // Return the full package (all versions) with the requested version marked.
    res.json({ ...mapPackage(pkg), requestedVersion: target.version });
  } catch (error) {
    console.error('[packages/version]', error);
    res.status(500).json({ error: 'Failed to fetch package version.' });
  }
};

// GET /packages/:name/versions — semver-sorted version list
export const listVersions = async (req: Request, res: Response) => {
  const { name } = req.params;
  try {
    const pkg = await prisma.extension.findUnique({
      where: { slug: name },
      include: { versions: { orderBy: { publishedAt: 'desc' } } },
    });
    if (!pkg) {
      res.status(404).json({ error: 'Package not found.' });
      return;
    }
    const sorted = sortBySemverDesc(pkg.versions);
    const latestVer = pkg.latestVersion ?? computeLatestVersion(sorted);
    res.json({
      package: pkg.slug,
      latestVersion: latestVer,
      versions: sorted.map((v) => ({
        version: v.version,
        isLatest: v.version === latestVer,
        isYanked: v.isYanked,
        yankReason: v.yankReason,
        publishedAt: v.publishedAt.toISOString(),
        changelog: v.changelog,
        isa: v.isa,
        targets: v.targets,
        toolchain: v.toolchain,
        size: v.size,
        downloadCount: v.downloadCount,
        checksum: v.checksum,
      })),
    });
  } catch (error) {
    console.error('[packages/versions]', error);
    res.status(500).json({ error: 'Failed to list versions.' });
  }
};

/* ─── Create package ────────────────────────────────────────────────────── */

export const createPackage = async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const { name, scope, description, shortDescription, longDescription, keywords, license, repositoryUrl, homepageUrl, iconUrl } = req.body as Record<string, string | undefined>;

  if (!name?.trim()) {
    res.status(400).json({ error: 'Package name is required.' });
    return;
  }
  if (!description?.trim()) {
    res.status(400).json({ error: 'Package description is required.' });
    return;
  }

  // Normalise the package name part (no @ or org prefix)
  const pkgName = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/_/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const slugError = validatePackageSlug(pkgName);
  if (slugError) {
    res.status(400).json({ error: slugError });
    return;
  }

  // Resolve scope → org and determine full slug
  let finalSlug = pkgName;
  let orgId: number | null = null;

  if (scope) {
    // Accept "@orgslug" or "orgslug"
    const orgSlug = scope.replace(/^@/, '').trim().toLowerCase();

    if (!/^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$|^[a-z0-9]{1,2}$/.test(orgSlug)) {
      res.status(400).json({ error: 'Invalid org scope format.' });
      return;
    }

    const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
    if (!org) {
      res.status(404).json({ error: `Organization "@${orgSlug}" not found.` });
      return;
    }

    // User must be an org owner or admin to publish under the scope
    const membership = await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId: org.id, userId: user.id } },
    });
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      res.status(403).json({ error: `You must be an owner or admin of "@${orgSlug}" to publish packages under its scope.` });
      return;
    }

    finalSlug = `@${orgSlug}/${pkgName}`;
    orgId = org.id;
  }

  try {
    const existing = await prisma.extension.findUnique({ where: { slug: finalSlug } });
    if (existing) {
      res.status(409).json({ error: `A package named "${finalSlug}" already exists.` });
      return;
    }

    const pkg = await prisma.extension.create({
      data: {
        slug: finalSlug,
        name: name.trim(),
        description: description.trim(),
        shortDescription: shortDescription?.trim() || null,
        longDescription: longDescription?.trim() || null,
        author: user.username,
        ownerId: user.id,
        orgId,
        keywords: typeof keywords === 'string' ? keywords.trim() : '',
        license: license?.trim() || null,
        repositoryUrl: repositoryUrl?.trim() || null,
        homepageUrl: homepageUrl?.trim() || null,
        iconUrl: iconUrl?.trim() || null,
      },
      include: { versions: true },
    });

    res.status(201).json(mapPackage(pkg));
  } catch (error) {
    console.error('[packages/create]', error);
    res.status(500).json({ error: 'Failed to create package.' });
  }
};

/* ─── Publish version ───────────────────────────────────────────────────── */

export const publishVersion = async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const { name } = req.params;
  const { version, changelog, isa, targets, toolchain } = req.body as Record<string, string | undefined>;
  const file = req.file;

  if (!file) {
    res.status(400).json({ error: 'A .xsil package file is required.' });
    return;
  }

  if (!version || !SEMVER_RE.test(version)) {
    fs.unlinkSync(file.path);
    res.status(400).json({ error: 'Version must be a valid semantic version (e.g. 1.0.0).' });
    return;
  }

  try {
    const pkg = await prisma.extension.findUnique({
      where: { slug: name },
      include: { maintainers: { where: { userId: user.id } } },
    });

    if (!pkg) {
      fs.unlinkSync(file.path);
      res.status(404).json({ error: 'Package not found.' });
      return;
    }

    const isOwner = pkg.ownerId === user.id;
    const isMaintainer = (pkg as typeof pkg & { maintainers: unknown[] }).maintainers.length > 0;
    if (!isOwner && !isMaintainer) {
      fs.unlinkSync(file.path);
      res.status(403).json({ error: 'You do not have permission to publish to this package.' });
      return;
    }

    const existingVersion = await prisma.version.findUnique({
      where: { extensionId_version: { extensionId: pkg.id, version } },
    });
    if (existingVersion) {
      fs.unlinkSync(file.path);
      res.status(409).json({ error: `Version ${version} has already been published and cannot be overwritten.` });
      return;
    }

    // Read bytes once: archive checksum + structural / integrity validation (same bar as CLI).
    const fileBuffer = fs.readFileSync(file.path);
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const rawBody = req.body as Record<string, unknown>;
    let validated;
    try {
      validated = validatePublishedXsilBuffer(fileBuffer, {
        slug: name,
        formVersion: version,
        optionalClientArchiveHash: firstFormString(rawBody, 'checksumArchive'),
        optionalClientPayloadHash: firstFormString(rawBody, 'checksumPayload'),
      });
    } catch (err) {
      fs.unlinkSync(file.path);
      if (err instanceof XsilValidationError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }

    // Key under which the file lives in the storage backend.
    const key = file.filename; // "<uuid>.xsil"
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
    // xsilUrl always points to our own proxy endpoint so download tracking works
    // transparently regardless of whether the backend is local or S3.
    const xsilUrl = `${baseUrl}/uploads/${key}`;

    // Transfer the temp file to the storage backend (moves for local, uploads for S3).
    await storage.put(key, file.path);

    let newVersion;
    try {
      newVersion = await prisma.version.create({
        data: {
          extensionId: pkg.id,
          version,
          changelog: changelog ?? '',
          xsilUrl,
          checksum,
          checksumPayload: validated.checksumPayloadStored,
          isa: isa?.trim() || null,
          targets: targets?.trim() || null,
          toolchain: toolchain?.trim() || null,
          size: file.size,
        },
      });
    } catch (dbError) {
      // DB write failed after the file was stored — attempt to clean up the blob.
      await storage.delete(key).catch(() => {});
      throw dbError;
    }

    // Recompute latestVersion as the semver-greatest non-yanked version so that
    // publishing an older patch (e.g. 1.0.1 after 1.1.0) does not overwrite latest.
    const allVersions = await prisma.version.findMany({
      where: { extensionId: pkg.id },
      select: { version: true, isYanked: true },
    });
    const newLatest = computeLatestVersion(allVersions);

    await prisma.extension.update({
      where: { id: pkg.id },
      data: { latestVersion: newLatest },
    });

    res.status(201).json(mapVersion(newVersion));
  } catch (error) {
    // Clean up temp file if storage.put() hadn't consumed it yet.
    if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    console.error('[packages/publish-version]', error);
    res.status(500).json({ error: 'Failed to publish version.' });
  }
};

/* ─── Update package metadata ───────────────────────────────────────────── */

export const updatePackage = async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const { name } = req.params;

  try {
    const pkg = await prisma.extension.findUnique({
      where: { slug: name },
      include: { maintainers: { where: { userId: user.id } } },
    });

    if (!pkg) {
      res.status(404).json({ error: 'Package not found.' });
      return;
    }

    const isOwner = pkg.ownerId === user.id;
    const isMaintainer = (pkg as typeof pkg & { maintainers: unknown[] }).maintainers.length > 0;
    if (!isOwner && !isMaintainer) {
      res.status(403).json({ error: 'You do not have permission to edit this package.' });
      return;
    }

    const {
      description, shortDescription, longDescription, keywords,
      license, repositoryUrl, homepageUrl, iconUrl, isDeprecated, deprecationMessage,
    } = req.body as Record<string, string | boolean | undefined>;

    // Validate deprecationMessage length
    if (deprecationMessage !== undefined && typeof deprecationMessage === 'string' && deprecationMessage.length > 500) {
      res.status(400).json({ error: 'Deprecation message must be 500 characters or fewer.' });
      return;
    }

    const updated = await prisma.extension.update({
      where: { slug: name },
      data: {
        ...(description !== undefined && { description: String(description) }),
        ...(shortDescription !== undefined && { shortDescription: shortDescription ? String(shortDescription) : null }),
        ...(longDescription !== undefined && { longDescription: longDescription ? String(longDescription) : null }),
        ...(keywords !== undefined && { keywords: String(keywords) }),
        ...(license !== undefined && { license: license ? String(license) : null }),
        ...(repositoryUrl !== undefined && { repositoryUrl: repositoryUrl ? String(repositoryUrl) : null }),
        ...(homepageUrl !== undefined && { homepageUrl: homepageUrl ? String(homepageUrl) : null }),
        ...(iconUrl !== undefined && { iconUrl: iconUrl ? String(iconUrl) : null }),
        ...(isDeprecated !== undefined && { isDeprecated: isDeprecated === true || isDeprecated === 'true' }),
        // Auto-clear the deprecation message when un-deprecating.
        ...(isDeprecated !== undefined && (isDeprecated === false || isDeprecated === 'false') && {
          deprecationMessage: null,
        }),
        ...(deprecationMessage !== undefined && {
          deprecationMessage: typeof deprecationMessage === 'string' && deprecationMessage.trim()
            ? deprecationMessage.trim()
            : null,
        }),
      },
      include: { versions: { orderBy: { publishedAt: 'desc' } } },
    });

    res.json(mapPackage(updated));
  } catch (error) {
    console.error('[packages/update]', error);
    res.status(500).json({ error: 'Failed to update package.' });
  }
};

/* ─── Maintainers ───────────────────────────────────────────────────────── */

export const listMaintainers = async (req: Request, res: Response) => {
  const { name } = req.params;
  try {
    const pkg = await prisma.extension.findUnique({ where: { slug: name } });
    if (!pkg) {
      res.status(404).json({ error: 'Package not found.' });
      return;
    }
    const maintainers = await prisma.maintainer.findMany({
      where: { packageId: pkg.id },
      include: { user: { select: { id: true, username: true, avatarUrl: true } } },
    });
    res.json(
      maintainers.map((m) => ({
        id: m.id,
        userId: m.userId,
        username: m.user.username,
        avatarUrl: m.user.avatarUrl,
        role: m.role,
        addedAt: m.addedAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error('[packages/maintainers/list]', error);
    res.status(500).json({ error: 'Failed to list maintainers.' });
  }
};

export const addMaintainer = async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const { name } = req.params;
  const { username } = req.body as { username?: string };

  if (!username?.trim()) {
    res.status(400).json({ error: 'Username is required.' });
    return;
  }

  try {
    const pkg = await prisma.extension.findUnique({ where: { slug: name } });
    if (!pkg) {
      res.status(404).json({ error: 'Package not found.' });
      return;
    }
    if (pkg.ownerId !== user.id) {
      res.status(403).json({ error: 'Only the package owner can manage maintainers.' });
      return;
    }

    const target = await prisma.user.findUnique({ where: { username } });
    if (!target) {
      res.status(404).json({ error: `User "${username}" not found.` });
      return;
    }

    const existing = await prisma.maintainer.findUnique({
      where: { packageId_userId: { packageId: pkg.id, userId: target.id } },
    });
    if (existing) {
      res.status(409).json({ error: `${username} is already a maintainer.` });
      return;
    }

    const m = await prisma.maintainer.create({
      data: { packageId: pkg.id, userId: target.id, role: 'maintainer' },
      include: { user: { select: { id: true, username: true, avatarUrl: true } } },
    });

    res.status(201).json({
      id: m.id,
      userId: m.userId,
      username: m.user.username,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
      addedAt: m.addedAt.toISOString(),
    });
  } catch (error) {
    console.error('[packages/maintainers/add]', error);
    res.status(500).json({ error: 'Failed to add maintainer.' });
  }
};

export const removeMaintainer = async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const { name, userId: userIdStr } = req.params;
  const userId = parseInt(userIdStr, 10);

  try {
    const pkg = await prisma.extension.findUnique({ where: { slug: name } });
    if (!pkg) {
      res.status(404).json({ error: 'Package not found.' });
      return;
    }
    if (pkg.ownerId !== user.id) {
      res.status(403).json({ error: 'Only the package owner can manage maintainers.' });
      return;
    }

    await prisma.maintainer.deleteMany({ where: { packageId: pkg.id, userId } });
    res.status(204).send();
  } catch (error) {
    console.error('[packages/maintainers/remove]', error);
    res.status(500).json({ error: 'Failed to remove maintainer.' });
  }
};

/* ─── User packages list ─────────────────────────────────────────────────── */

export const getMyPackages = async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  try {
    const packages = await prisma.extension.findMany({
      where: { ownerId: user.id },
      include: {
        versions: {
          orderBy: { publishedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(packages.map((p) => mapPackage(p)));
  } catch (error) {
    console.error('[packages/mine]', error);
    res.status(500).json({ error: 'Failed to fetch your packages.' });
  }
};

/* ─── Yank / unyank a version ───────────────────────────────────────────── */

export const yankVersion = async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const { name, version } = req.params;
  const { yanked, reason } = req.body ?? {};

  if (typeof yanked !== 'boolean') {
    res.status(400).json({ error: '"yanked" must be a boolean.' });
    return;
  }

  if (reason !== undefined && reason !== null && typeof reason !== 'string') {
    res.status(400).json({ error: '"reason" must be a string.' });
    return;
  }

  const yankReason = yanked
    ? (typeof reason === 'string' && reason.trim() ? reason.trim() : null)
    : null; // clear reason on unyank

  try {
    const pkg = await prisma.extension.findUnique({
      where: { slug: name },
      include: { maintainers: { where: { userId: user.id } } },
    });

    if (!pkg) {
      res.status(404).json({ error: 'Package not found.' });
      return;
    }

    const isOwner = pkg.ownerId === user.id;
    const isMaintainer = (pkg as typeof pkg & { maintainers: unknown[] }).maintainers.length > 0;
    if (!isOwner && !isMaintainer) {
      res.status(403).json({ error: 'You do not have permission to yank versions of this package.' });
      return;
    }

    const ver = await prisma.version.findUnique({
      where: { extensionId_version: { extensionId: pkg.id, version } },
    });

    if (!ver) {
      res.status(404).json({ error: `Version ${version} not found.` });
      return;
    }

    const updatedVer = await prisma.version.update({
      where: { id: ver.id },
      data: { isYanked: yanked, yankReason },
    });

    // Recompute latestVersion now that yank status has changed.
    const allVersions = await prisma.version.findMany({
      where: { extensionId: pkg.id },
      select: { version: true, isYanked: true },
    });
    const newLatest = computeLatestVersion(allVersions);
    await prisma.extension.update({
      where: { id: pkg.id },
      data: { latestVersion: newLatest },
    });

    res.json({
      version:    updatedVer.version,
      isYanked:   updatedVer.isYanked,
      yankReason: updatedVer.yankReason,
      latestVersion: newLatest,
    });
  } catch (error) {
    console.error('[packages/yank]', error);
    res.status(500).json({ error: 'Failed to update version yank status.' });
  }
};
