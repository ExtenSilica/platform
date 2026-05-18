import { Request, Response } from 'express';
import { prisma } from '../db';
import {
  validateCitationKind,
  validateCitationLabel,
  validateCitationUrl,
  parseOptionalPackageSlug,
  type ExternalCitationKind,
} from '../lib/externalCitation';

function serializeCitation(row: {
  id: number;
  packageId: number | null;
  label: string;
  url: string;
  kind: string;
  createdByUserId: number;
  createdAt: Date;
  updatedAt: Date;
  package?: { id: number; slug: string; name: string } | null;
  createdBy?: { id: number; username: string };
}) {
  return {
    id: row.id,
    packageId: row.packageId,
    label: row.label,
    url: row.url,
    kind: row.kind,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    package: row.package
      ? { id: row.package.id, slug: row.package.slug, name: row.package.name }
      : null,
    createdBy: row.createdBy
      ? { id: row.createdBy.id, username: row.createdBy.username }
      : undefined,
  };
}

const citationInclude = {
  package: { select: { id: true, slug: true, name: true } },
  createdBy: { select: { id: true, username: true } },
} as const;

function clampLimit(raw: unknown, fallback = 50, max = 200): number {
  const n = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isInteger(n) || n < 1) return fallback;
  return Math.min(n, max);
}

/** GET /packages/:name/citations — public list for a package (PR-G2). */
export async function listPackageExternalCitations(
  req: Request,
  res: Response,
): Promise<void> {
  const slug = String(req.params.name ?? '').trim();
  if (!slug) {
    res.status(400).json({ error: 'Package name is required.' });
    return;
  }

  const pkg = await prisma.extension.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!pkg) {
    res.status(404).json({ error: 'Package not found.' });
    return;
  }

  const rows = await prisma.externalCitation.findMany({
    where: { packageId: pkg.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: citationInclude,
  });

  res.json({ citations: rows.map(serializeCitation) });
}

/** GET /admin/citations — platform admin list (optional filters). */
export async function adminListExternalCitations(
  req: Request,
  res: Response,
): Promise<void> {
  const limit = clampLimit(req.query.limit);
  const skip = Math.max(
    0,
    Number.parseInt(String(req.query.skip ?? '0'), 10) || 0,
  );
  const kindFilter =
    typeof req.query.kind === 'string' && req.query.kind.trim()
      ? req.query.kind.trim()
      : undefined;
  const packageSlug =
    typeof req.query.packageSlug === 'string' && req.query.packageSlug.trim()
      ? req.query.packageSlug.trim()
      : undefined;

  let packageId: number | undefined;
  if (packageSlug) {
    const pkg = await prisma.extension.findUnique({
      where: { slug: packageSlug },
      select: { id: true },
    });
    if (!pkg) {
      res.status(404).json({ error: 'Package not found.' });
      return;
    }
    packageId = pkg.id;
  }

  const where = {
    ...(packageId !== undefined ? { packageId } : {}),
    ...(kindFilter ? { kind: kindFilter } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.externalCitation.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: citationInclude,
    }),
    prisma.externalCitation.count({ where }),
  ]);

  res.json({
    total,
    skip,
    limit,
    citations: rows.map(serializeCitation),
  });
}

/** POST /admin/citations — create citation (package optional). */
export async function adminCreateExternalCitation(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;

  const labelErr = validateCitationLabel(body.label);
  if (labelErr) {
    res.status(400).json({ error: labelErr });
    return;
  }
  const urlErr = validateCitationUrl(body.url);
  if (urlErr) {
    res.status(400).json({ error: urlErr });
    return;
  }
  const kindErr = validateCitationKind(body.kind);
  if (kindErr) {
    res.status(400).json({ error: kindErr });
    return;
  }

  const slugParsed = parseOptionalPackageSlug(body.packageSlug);
  if (slugParsed.error) {
    res.status(400).json({ error: slugParsed.error });
    return;
  }

  let packageId: number | null = null;
  if (slugParsed.value) {
    const pkg = await prisma.extension.findUnique({
      where: { slug: slugParsed.value },
      select: { id: true },
    });
    if (!pkg) {
      res.status(404).json({ error: 'Package not found.' });
      return;
    }
    packageId = pkg.id;
  } else if (body.packageId !== undefined && body.packageId !== null && body.packageId !== '') {
    const id =
      typeof body.packageId === 'number'
        ? body.packageId
        : Number.parseInt(String(body.packageId), 10);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'packageId must be a positive integer.' });
      return;
    }
    const pkg = await prisma.extension.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!pkg) {
      res.status(404).json({ error: 'Package not found.' });
      return;
    }
    packageId = pkg.id;
  }

  const created = await prisma.externalCitation.create({
    data: {
      packageId,
      label: String(body.label).trim(),
      url: String(body.url).trim(),
      kind: body.kind as ExternalCitationKind,
      createdByUserId: req.user.id,
    },
    include: citationInclude,
  });

  res.status(201).json({ citation: serializeCitation(created) });
}

/** DELETE /admin/citations/:id */
export async function adminDeleteExternalCitation(
  req: Request,
  res: Response,
): Promise<void> {
  const id = Number.parseInt(String(req.params.id), 10);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Citation id must be a positive integer.' });
    return;
  }

  const existing = await prisma.externalCitation.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Citation not found.' });
    return;
  }

  await prisma.externalCitation.delete({ where: { id } });
  res.json({ ok: true, id });
}
