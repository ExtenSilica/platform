import { Request, Response } from 'express';
import { prisma } from '../db';
import { sortBySemverDesc } from '../lib/semverSort';
import {
  buildPackageCitation,
  extractDoiFromCitationUrl,
  type PackageCitationAuthor,
} from '../lib/packageCitation';

function siteUrl(): string {
  return (process.env.SITE_URL ?? 'https://extensilica.com').replace(/\/+$/, '');
}

function resolveAuthors(
  authorField: string,
  maintainers: { user: { username: string } }[],
): PackageCitationAuthor[] {
  const fromMaintainers = maintainers
    .map((m) => m.user.username.trim())
    .filter(Boolean);
  if (fromMaintainers.length > 0) {
    return fromMaintainers.map((name) => ({ name }));
  }
  const author = authorField.trim();
  if (author) return [{ name: author }];
  return [{ name: 'Unknown' }];
}

function pickDoi(
  citations: { kind: string; url: string }[],
): string | null {
  for (const row of citations) {
    if (row.kind !== 'doi') continue;
    const doi = extractDoiFromCitationUrl(row.url);
    if (doi) return doi;
  }
  for (const row of citations) {
    const doi = extractDoiFromCitationUrl(row.url);
    if (doi) return doi;
  }
  return null;
}

/** GET /packages/:name/citation — CFF + BibTeX (PR-G2b). */
export async function getPackageCitation(
  req: Request,
  res: Response,
): Promise<void> {
  const slug = String(req.params.name ?? '').trim();
  if (!slug) {
    res.status(400).json({ error: 'Package name is required.' });
    return;
  }

  const versionQuery =
    typeof req.query.version === 'string' ? req.query.version.trim() : '';

  const pkg = await prisma.extension.findUnique({
    where: { slug },
    include: {
      versions: true,
      maintainers: {
        include: { user: { select: { username: true } } },
        orderBy: { addedAt: 'asc' },
      },
      externalCitations: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { kind: true, url: true },
      },
    },
  });

  if (!pkg) {
    res.status(404).json({ error: 'Package not found.' });
    return;
  }

  const sorted = sortBySemverDesc(pkg.versions);
  let target = sorted.find((v) => !v.isYanked) ?? sorted[0];
  if (versionQuery) {
    const explicit = sorted.find((v) => v.version === versionQuery);
    if (!explicit) {
      res.status(404).json({ error: `Version '${versionQuery}' not found.` });
      return;
    }
    target = explicit;
  }

  if (!target) {
    res.status(404).json({ error: 'No published version available for citation.' });
    return;
  }

  const version = target.version;
  const registryPageUrl = `${siteUrl()}/package/${encodeURIComponent(slug)}`;
  const doi = pickDoi(pkg.externalCitations);
  const dateReleased = target.publishedAt.toISOString().slice(0, 10);

  const payload = buildPackageCitation({
    slug,
    title: pkg.name,
    version,
    description: pkg.description || pkg.shortDescription || '',
    license: pkg.license,
    repositoryUrl: pkg.repositoryUrl,
    homepageUrl: pkg.homepageUrl,
    registryPageUrl,
    authors: resolveAuthors(pkg.author, pkg.maintainers),
    doi,
    dateReleased,
  });

  const format =
    typeof req.query.format === 'string' ? req.query.format.trim().toLowerCase() : '';

  if (format === 'cff') {
    res.type('text/plain; charset=utf-8').send(payload.cff);
    return;
  }
  if (format === 'bibtex') {
    res.type('text/plain; charset=utf-8').send(payload.bibtex);
    return;
  }

  res.json(payload);
}
