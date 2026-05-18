import { describe, it, expect } from 'vitest';
import {
  buildPackageCitation,
  buildCff,
  buildBibtex,
  extractDoiFromCitationUrl,
} from '../src/lib/packageCitation';

const baseInput = {
  slug: 'rvx-demo',
  title: 'RVX Demo',
  version: '1.0.0',
  description: 'A demo extension for tests.',
  license: 'Apache-2.0',
  repositoryUrl: 'https://github.com/org/rvx-demo',
  homepageUrl: null,
  registryPageUrl: 'https://extensilica.com/package/rvx-demo',
  authors: [{ name: 'alice' }, { name: 'bob' }],
  doi: '10.5281/zenodo.1234567',
  dateReleased: '2026-05-01',
};

describe('extractDoiFromCitationUrl', () => {
  it('parses doi.org URLs', () => {
    expect(
      extractDoiFromCitationUrl('https://doi.org/10.5281/zenodo.1234567'),
    ).toBe('10.5281/zenodo.1234567');
  });

  it('finds DOI in arbitrary URLs', () => {
    expect(
      extractDoiFromCitationUrl('https://zenodo.org/record/1'),
    ).toBeNull();
  });
});

describe('buildCff', () => {
  it('includes core fields and DOI', () => {
    const cff = buildCff(baseInput);
    expect(cff).toContain('cff-version: 1.2.0');
    expect(cff).toContain('title: RVX Demo');
    expect(cff).toContain('version: 1.0.0');
    expect(cff).toContain('license: Apache-2.0');
    expect(cff).toContain('doi: 10.5281/zenodo.1234567');
    expect(cff).toContain('repository-code: https://github.com/org/rvx-demo');
    expect(cff).toContain('- name: alice');
  });
});

describe('buildBibtex', () => {
  it('emits @software entry', () => {
    const bib = buildBibtex(baseInput);
    expect(bib).toMatch(/^@software\{rvx_demo_1_0_0,/m);
    expect(bib).toContain('author = {alice and bob}');
    expect(bib).toContain('doi = {10.5281/zenodo.1234567}');
  });
});

describe('buildPackageCitation', () => {
  it('returns both formats', () => {
    const out = buildPackageCitation(baseInput);
    expect(out.slug).toBe('rvx-demo');
    expect(out.cff.length).toBeGreaterThan(50);
    expect(out.bibtex.length).toBeGreaterThan(50);
  });
});
