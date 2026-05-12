import { Request, Response } from 'express';
import { Extension, Version } from '@prisma/client';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../db';
import { Prisma } from '@prisma/client';
import { sortBySemverDesc } from '../lib/semverSort';
import { computeReadinessFromVersion } from '../lib/readiness';
import { syncExtensionLatestReadiness } from '../lib/extensionLatestReadiness';
import { computeLatestVersion } from '../lib/packageLatestVersion';
import {
  validatePublishedXsilBuffer,
  XsilValidationError,
} from '../lib/xsilPublishValidate';
import { storage } from '../storage';
import {
  extractDeclaredToolDependencies,
  isValidSha256,
  normalizeSha256,
} from '../lib/toolDependencies';
import {
  normalizeAuthority,
  normalizeStandardStatus,
  STANDARD_STATUS_VALUES,
  type StandardStatus,
} from '../lib/standardStatus';
import {
  normalizePortStatus,
  PORT_STATUS_VALUES,
  portStatusAfterOwnershipClaim,
  type PortStatus,
} from '../lib/portStatus';
import { isCatalogBotUser, isPlatformAdminUser } from '../lib/platformAdmin';

export type ExtensionWithVersions = Extension & {
  versions: Version[];
  org?: { slug: string; displayName: string } | null;
};

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

function firstFormString(body: Record<string, unknown>, key: string): string | undefined {
  const v = body[key];
  if (v == null) return undefined;
  if (Array.isArray(v)) {
    const x = v[0];
    return typeof x === 'string' ? x : undefined;
  }
  return typeof v === 'string' ? v : undefined;
}

function isExtensilicaArtifactUrl(urlRaw: string, baseUrl: string): boolean {
  try {
    const url = new URL(urlRaw);
    const base = new URL(baseUrl);
    if (url.origin !== base.origin) return false;
    return url.pathname.startsWith('/api/artifacts/tools/') || url.pathname.startsWith('/artifacts/tools/');
  } catch {
    return false;
  }
}

function mapVersion(v: Version) {
  const readinessLevel = (v as Version & { readinessLevel?: number | null }).readinessLevel ?? null;
  const capabilities = (v as Version & { capabilities?: string | null }).capabilities ?? null;
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
    execution: (v as Version & { execution?: string | null }).execution ?? null,
    dependencies: (v as Version & { dependencies?: string | null }).dependencies ?? null,
    resolutionMode: (v as Version & { resolutionMode?: string | null }).resolutionMode ?? null,
    readinessLevel,
    capabilities,
    evidence: (v as Version & { evidence?: string | null }).evidence ?? null,
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
    standardStatus: ext.standardStatus ?? null,
    authority: ext.authority ?? null,
    portStatus: (ext as Extension & { portStatus?: PortStatus | null }).portStatus ?? null,
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
    org:
      ext.org != null
        ? { slug: ext.org.slug, displayName: ext.org.displayName }
        : null,
  };
}

/** Keep only the latest non-yanked semver version row (for list payloads). */
function trimExtensionToLatestSemverVersion(ext: ExtensionWithVersions): ExtensionWithVersions {
  const nonYanked = ext.versions.filter((v) => !v.isYanked);
  const sorted = sortBySemverDesc(nonYanked);
  if (sorted.length > 0) {
    return { ...ext, versions: [sorted[0]] };
  }
  const fallback = sortBySemverDesc(ext.versions);
  return { ...ext, versions: fallback[0] ? [fallback[0]] : [] };
}

/* ─── Read ──────────────────────────────────────────────────────────────── */

export const listPackages = async (req: Request, res: Response) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const author = typeof req.query.author === 'string' ? req.query.author.trim() : '';
  const orgRaw = typeof req.query.org === 'string' ? req.query.org.trim().replace(/^@+/, '') : '';
  const levelRaw = typeof req.query.level === 'string' ? req.query.level.trim() : '';
  const sort = typeof req.query.sort === 'string' ? req.query.sort.trim().toLowerCase() : '';
  const orderRaw = typeof req.query.order === 'string' ? req.query.order.trim().toLowerCase() : '';
  const limitRaw = req.query.limit;

  const where: Prisma.ExtensionWhereInput = {};

  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { keywords: { contains: q, mode: 'insensitive' } },
      { slug: { contains: q, mode: 'insensitive' } },
      { author: { contains: q, mode: 'insensitive' } },
    ];
  }

  if (author) {
    where.author = { contains: author, mode: 'insensitive' };
  }

  if (orgRaw) {
    const orgSlug = orgRaw.toLowerCase();
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          { org: { slug: orgSlug } },
          { slug: { startsWith: `@${orgSlug}/`, mode: 'insensitive' } },
        ],
      },
    ];
  }

  const levelFilter =
    levelRaw && /^[1-5]$/.test(levelRaw) ? (parseInt(levelRaw, 10) as 1 | 2 | 3 | 4 | 5) : null;

  if (levelFilter !== null) {
    where.latestReadinessLevel = levelFilter;
  }

  // Optional ?standardStatus=ratified|draft|vendor|research|custom (CSV-friendly).
  // Unknown values are silently ignored; an explicitly empty list still means "no filter".
  const statusRaw = typeof req.query.standardStatus === 'string' ? req.query.standardStatus : '';
  if (statusRaw) {
    const wanted = statusRaw
      .split(',')
      .map((s) => normalizeStandardStatus(s))
      .filter((s): s is StandardStatus => s != null);
    if (wanted.length > 0) {
      where.standardStatus = { in: wanted };
    }
  }

  // Optional ?portStatus=seeded|community_port|claimed|official|archived (CSV-friendly).
  // Accepts hyphenated `community-port` as an alias.
  const portStatusRaw = typeof req.query.portStatus === 'string' ? req.query.portStatus : '';
  if (portStatusRaw) {
    const wanted = portStatusRaw
      .split(',')
      .map((s) => normalizePortStatus(s))
      .filter((s): s is PortStatus => s != null);
    if (wanted.length > 0) {
      (where as Prisma.ExtensionWhereInput & { portStatus?: { in: PortStatus[] } }).portStatus = {
        in: wanted,
      };
    }
  }

  const order = orderRaw === 'asc' ? 'asc' : 'desc';
  const sortDownloads = sort === 'downloads' || sort === 'totaldownloads';

  let limitN = 0;
  if (limitRaw !== undefined && limitRaw !== '') {
    const n = parseInt(String(limitRaw), 10);
    if (!Number.isNaN(n) && n > 0) limitN = Math.min(500, n);
  }

  try {
    const packages = await prisma.extension.findMany({
      where,
      include: {
        org: { select: { slug: true, displayName: true } },
        versions: {
          where: { isYanked: false },
          orderBy: { publishedAt: 'desc' },
          take: 80,
        },
      },
    });

    let rows = packages.map((p) => mapPackage(trimExtensionToLatestSemverVersion(p as ExtensionWithVersions)));

    rows.sort((a, b) => {
      if (sortDownloads) {
        return order === 'desc'
          ? b.totalDownloads - a.totalDownloads
          : a.totalDownloads - b.totalDownloads;
      }
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return order === 'desc' ? tb - ta : ta - tb;
    });

    if (limitN > 0) {
      rows = rows.slice(0, limitN);
    }

    res.json(rows);
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
        include: {
          org: { select: { slug: true, displayName: true } },
          versions: { orderBy: { publishedAt: 'desc' } },
        },
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
      include: {
        org: { select: { slug: true, displayName: true } },
        versions: { orderBy: { publishedAt: 'desc' } },
      },
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

  const {
    name,
    scope,
    description,
    shortDescription,
    longDescription,
    keywords,
    license,
    repositoryUrl,
    homepageUrl,
    iconUrl,
    standardStatus: standardStatusRaw,
    authority: authorityRaw,
  } = req.body as Record<string, string | undefined>;

  if (!name?.trim()) {
    res.status(400).json({ error: 'Package name is required.' });
    return;
  }
  if (!description?.trim()) {
    res.status(400).json({ error: 'Package description is required.' });
    return;
  }

  // Honest classification — required for new packages so the registry never
  // grows opaque "RISC-V extensions" rows. The wizard / CLI / catalog-seed
  // playbook all set this; only legacy clients will hit this path.
  const standardStatus = normalizeStandardStatus(standardStatusRaw);
  if (standardStatusRaw !== undefined && standardStatus === null) {
    res.status(400).json({
      error: `standardStatus must be one of: ${STANDARD_STATUS_VALUES.join(', ')}.`,
    });
    return;
  }
  const authority = normalizeAuthority(authorityRaw);

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
        standardStatus: standardStatus ?? null,
        authority,
        // SERVER-SET provenance: only the catalog-seed bot gets `seeded`
        // automatically. Regular publishers leave the field null so the
        // detail page does not falsely advertise an unverified port.
        portStatus: isCatalogBotUser(user) ? 'seeded' : null,
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
  const { version, changelog } = req.body as Record<string, string | undefined>;
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

    const mf = validated.manifest ?? {};
    const mfIsa = typeof mf.isa === 'string' ? mf.isa.trim() : '';
    const mfTargets = mf.targets != null ? JSON.stringify(mf.targets) : '';
    const mfToolchain = mf.toolchain != null ? JSON.stringify(mf.toolchain) : '';
    const mfExecution = mf.execution != null ? JSON.stringify(mf.execution) : '';
    const mfDeps = mf.dependencies != null ? JSON.stringify(mf.dependencies) : '';
    const mfResolution =
      mf.resolution && typeof mf.resolution === 'object' && (mf.resolution as Record<string, unknown>).mode
        ? String((mf.resolution as Record<string, unknown>).mode)
        : null;

    // Honest classification — pull from the manifest and reject malformed values.
    const mfStandardStatus = normalizeStandardStatus(mf.standardStatus);
    if (mf.standardStatus !== undefined && mfStandardStatus === null) {
      fs.unlinkSync(file.path);
      res.status(400).json({
        error: `manifest.standardStatus must be one of: ${STANDARD_STATUS_VALUES.join(', ')}.`,
      });
      return;
    }
    const mfAuthority = normalizeAuthority(mf.authority);
    const normalizedResolution = (mfResolution ?? '').trim().toLowerCase();
    const declaredDeps = extractDeclaredToolDependencies(mf as Record<string, unknown>);

    // Optional linkage to ToolArtifact rows: only when manifest is resolved and every
    // declared tool matches a registered artifact. Otherwise publish still succeeds
    // (bundled / host-dependent / manual URLs) — manifest.dependencies JSON is always stored.
    let dependencyRows: {
      toolArtifactId: number;
      toolName: string;
      toolVersion: string;
      platform: string;
      declaredUrl: string;
      declaredSha256: string;
    }[] = [];

    if (normalizedResolution === 'resolved' && declaredDeps.length > 0) {
      const invalidDep = declaredDeps.find((d) => {
        if (!isValidSha256(normalizeSha256(d.sha256))) return true;
        if (!isExtensilicaArtifactUrl(d.url, baseUrl)) return true;
        const shaInUrl = d.url.split('/').pop()?.trim().toLowerCase() ?? '';
        return shaInUrl !== normalizeSha256(d.sha256);
      });
      if (!invalidDep) {
        const depOrFilters = declaredDeps.map((d) => ({
          sha256: normalizeSha256(d.sha256),
          name: d.toolName,
          version: d.toolVersion,
          platform: d.platform,
        }));
        const knownArtifacts = await prisma.toolArtifact.findMany({
          where: { OR: depOrFilters },
        });
        const artifactMap = new Map(
          knownArtifacts.map((a) => [`${a.sha256}:${a.name}:${a.version}:${a.platform}`, a])
        );
        const missingDeps = declaredDeps.filter((d) => {
          const k = `${normalizeSha256(d.sha256)}:${d.toolName}:${d.toolVersion}:${d.platform}`;
          return !artifactMap.has(k);
        });
        if (missingDeps.length === 0) {
          dependencyRows = declaredDeps.map((d) => {
            const mapKey = `${normalizeSha256(d.sha256)}:${d.toolName}:${d.toolVersion}:${d.platform}`;
            const artifact = artifactMap.get(mapKey)!;
            return {
              toolArtifactId: artifact.id,
              toolName: d.toolName,
              toolVersion: d.toolVersion,
              platform: d.platform,
              declaredUrl: d.url,
              declaredSha256: normalizeSha256(d.sha256),
            };
          });
        }
      }
    }

    let newVersion;
    try {
      const readiness = computeReadinessFromVersion(
        {
          isa: mfIsa || null,
          toolchain: mfToolchain || null,
          targets: mfTargets || null,
          execution: mfExecution || null,
          dependencies: mfDeps || null,
          resolutionMode: mfResolution ? mfResolution.trim() : null,
        },
        { portStatus: pkg.portStatus ?? null },
      );
      newVersion = await prisma.version.create({
        data: {
          extensionId: pkg.id,
          version,
          changelog: changelog ?? '',
          xsilUrl,
          checksum,
          checksumPayload: validated.checksumPayloadStored,
          isa: mfIsa || null,
          targets: mfTargets || null,
          toolchain: mfToolchain || null,
          execution: mfExecution || null,
          dependencies: mfDeps || null,
          resolutionMode: mfResolution ? mfResolution.trim() : null,
          readinessLevel: readiness.readinessLevel,
          capabilities: JSON.stringify(readiness.capabilities),
          evidence: validated.evidenceJson,
          size: file.size,
          ...(dependencyRows.length > 0
            ? { toolDependencies: { create: dependencyRows } }
            : {}),
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

    // We only overwrite Extension.standardStatus / .authority when the manifest
    // carries a valid, non-empty value, so a maintainer's later edits via PATCH
    // stick across re-publishes that omit the field.
    const extensionUpdate: Prisma.ExtensionUpdateInput = { latestVersion: newLatest };
    if (mfStandardStatus !== null) {
      extensionUpdate.standardStatus = mfStandardStatus;
    }
    if (mfAuthority !== null) {
      extensionUpdate.authority = mfAuthority;
    }
    await prisma.extension.update({
      where: { id: pkg.id },
      data: extensionUpdate,
    });

    await syncExtensionLatestReadiness(pkg.id);

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
      standardStatus: standardStatusRaw, authority: authorityRaw,
      portStatus: portStatusRaw,
    } = req.body as Record<string, string | boolean | undefined>;

    // Validate deprecationMessage length
    if (deprecationMessage !== undefined && typeof deprecationMessage === 'string' && deprecationMessage.length > 500) {
      res.status(400).json({ error: 'Deprecation message must be 500 characters or fewer.' });
      return;
    }

    // Honest classification — accept null/empty (clear) and recognised values only.
    let standardStatusUpdate: { standardStatus: StandardStatus | null } | null = null;
    if (standardStatusRaw !== undefined) {
      if (standardStatusRaw === null || standardStatusRaw === '') {
        standardStatusUpdate = { standardStatus: null };
      } else {
        const normalized = normalizeStandardStatus(standardStatusRaw);
        if (normalized === null) {
          res.status(400).json({
            error: `standardStatus must be one of: ${STANDARD_STATUS_VALUES.join(', ')}.`,
          });
          return;
        }
        standardStatusUpdate = { standardStatus: normalized };
      }
    }
    const authorityUpdate =
      authorityRaw === undefined
        ? null
        : { authority: normalizeAuthority(authorityRaw) };

    // Port status is SERVER-SIDE provenance — only platform admins may set it
    // directly (e.g. flipping a hand-vetted package to `official`). Owners may
    // additionally archive their own package via `portStatus: "archived"`.
    let portStatusUpdate: { portStatus: PortStatus | null } | null = null;
    if (portStatusRaw !== undefined) {
      const admin = isPlatformAdminUser(user);
      if (portStatusRaw === null || portStatusRaw === '') {
        if (!admin) {
          res.status(403).json({ error: 'Only platform admins may clear portStatus.' });
          return;
        }
        portStatusUpdate = { portStatus: null };
      } else {
        const normalized = normalizePortStatus(portStatusRaw);
        if (normalized === null) {
          res.status(400).json({
            error: `portStatus must be one of: ${PORT_STATUS_VALUES.join(', ')}.`,
          });
          return;
        }
        // Owners (without admin) can only archive their own package.
        if (!admin && normalized !== 'archived') {
          res.status(403).json({
            error: 'Only platform admins may change portStatus (except `archived`, which the owner may set).',
          });
          return;
        }
        portStatusUpdate = { portStatus: normalized };
      }
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
        ...(standardStatusUpdate ?? {}),
        ...(authorityUpdate ?? {}),
        ...(portStatusUpdate ?? {}),
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
        org: { select: { slug: true, displayName: true } },
        versions: {
          where: { isYanked: false },
          orderBy: { publishedAt: 'desc' },
          take: 80,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(
      packages.map((p) =>
        mapPackage(trimExtensionToLatestSemverVersion(p as ExtensionWithVersions)),
      ),
    );
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

    await syncExtensionLatestReadiness(pkg.id);

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
