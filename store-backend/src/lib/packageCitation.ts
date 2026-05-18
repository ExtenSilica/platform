/**
 * Canonical CFF and BibTeX for registry packages — PR-G2b.
 */

export interface PackageCitationAuthor {
  name: string;
}

export interface PackageCitationInput {
  slug: string;
  title: string;
  version: string;
  description: string;
  license: string | null;
  repositoryUrl: string | null;
  homepageUrl: string | null;
  registryPageUrl: string;
  authors: PackageCitationAuthor[];
  doi: string | null;
  /** ISO date (YYYY-MM-DD) from version publish date when known. */
  dateReleased: string | null;
}

export interface PackageCitationPayload {
  slug: string;
  version: string;
  title: string;
  license: string | null;
  registryPageUrl: string;
  repositoryUrl: string | null;
  doi: string | null;
  authors: PackageCitationAuthor[];
  cff: string;
  bibtex: string;
}

function yamlQuote(value: string): string {
  if (/^[\w .\-/:+@]+$/.test(value) && !value.includes(': ')) {
    return value;
  }
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function bibtexEscape(value: string): string {
  return value.replace(/[{}\\]/g, (c) => `\\${c}`);
}

function bibtexKey(slug: string, version: string): string {
  const base = slug.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'package';
  const ver = version.replace(/[^a-zA-Z0-9]+/g, '_');
  return `${base}_${ver}`;
}

/** Extract bare DOI (10.xxxx/…) from a citation URL when present. */
export function extractDoiFromCitationUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.hostname === 'doi.org' || u.hostname === 'dx.doi.org') {
      const path = u.pathname.replace(/^\//, '');
      return path || null;
    }
  } catch {
    // fall through to regex
  }
  const m = trimmed.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
  return m ? m[0] : null;
}

export function buildPackageCitation(input: PackageCitationInput): PackageCitationPayload {
  const cff = buildCff(input);
  const bibtex = buildBibtex(input);
  return {
    slug: input.slug,
    version: input.version,
    title: input.title,
    license: input.license,
    registryPageUrl: input.registryPageUrl,
    repositoryUrl: input.repositoryUrl,
    doi: input.doi,
    authors: input.authors,
    cff,
    bibtex,
  };
}

export function buildCff(input: PackageCitationInput): string {
  const lines: string[] = [
    'cff-version: 1.2.0',
    'type: software',
    `title: ${yamlQuote(input.title)}`,
    `version: ${yamlQuote(input.version)}`,
  ];

  if (input.authors.length > 0) {
    lines.push('authors:');
    for (const a of input.authors) {
      lines.push(`  - name: ${yamlQuote(a.name)}`);
    }
  }

  const desc = input.description.trim().slice(0, 500);
  if (desc) {
    lines.push(`abstract: ${yamlQuote(desc)}`);
  }

  lines.push(
    'message: "If you use this software, please cite it using the metadata from this file."',
  );

  if (input.license) {
    lines.push(`license: ${yamlQuote(input.license)}`);
  }

  if (input.repositoryUrl) {
    lines.push(`repository-code: ${yamlQuote(input.repositoryUrl)}`);
  }

  if (input.homepageUrl) {
    lines.push(`url: ${yamlQuote(input.homepageUrl)}`);
  } else {
    lines.push(`url: ${yamlQuote(input.registryPageUrl)}`);
  }

  if (input.dateReleased) {
    lines.push(`date-released: ${yamlQuote(input.dateReleased)}`);
  }

  if (input.doi) {
    lines.push(`doi: ${yamlQuote(input.doi)}`);
  }

  lines.push('identifiers:');
  lines.push('  - type: url');
  lines.push(`    value: ${yamlQuote(input.registryPageUrl)}`);
  if (input.repositoryUrl && input.repositoryUrl !== input.registryPageUrl) {
    lines.push('  - type: url');
    lines.push(`    value: ${yamlQuote(input.repositoryUrl)}`);
  }

  return `${lines.join('\n')}\n`;
}

export function buildBibtex(input: PackageCitationInput): string {
  const key = bibtexKey(input.slug, input.version);
  const authorNames = input.authors.map((a) => a.name).filter(Boolean);
  const authorField =
    authorNames.length > 0
      ? authorNames.map((n) => bibtexEscape(n)).join(' and ')
      : 'Unknown';

  const year =
    input.dateReleased?.slice(0, 4) ??
    String(new Date().getUTCFullYear());

  const lines = [
    `@software{${key},`,
    `  title = {${bibtexEscape(input.title)}},`,
    `  author = {${authorField}},`,
    `  year = {${year}},`,
    `  version = {${bibtexEscape(input.version)}},`,
    `  url = {${bibtexEscape(input.registryPageUrl)}},`,
  ];

  if (input.license) {
    lines.push(`  license = {${bibtexEscape(input.license)}},`);
  }
  if (input.repositoryUrl) {
    lines.push(`  repository = {${bibtexEscape(input.repositoryUrl)}},`);
  }
  if (input.doi) {
    lines.push(`  doi = {${bibtexEscape(input.doi)}},`);
  }

  lines.push('}');
  return `${lines.join('\n')}\n`;
}
