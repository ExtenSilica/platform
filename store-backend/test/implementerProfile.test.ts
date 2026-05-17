import { describe, expect, it } from 'vitest';
import {
  IMPLEMENTER_BIO_MAX,
  normalizeImplementerBio,
  normalizeImplementerGithubUrl,
  validateImplementerBio,
  validateImplementerGithubUrl,
} from '../src/lib/implementerProfile';

describe('validateImplementerGithubUrl', () => {
  it('accepts a canonical profile URL', () => {
    expect(validateImplementerGithubUrl('https://github.com/octocat')).toBeNull();
    expect(validateImplementerGithubUrl('https://github.com/octocat/')).toBeNull();
  });

  it('rejects repository URLs', () => {
    expect(validateImplementerGithubUrl('https://github.com/octocat/hello-world')).toMatch(
      /not a repository/i,
    );
  });

  it('rejects non-GitHub hosts', () => {
    expect(validateImplementerGithubUrl('https://gitlab.com/octocat')).toMatch(/github\.com/);
  });

  it('rejects http', () => {
    expect(validateImplementerGithubUrl('http://github.com/octocat')).toMatch(/https/);
  });
});

describe('normalizeImplementerGithubUrl', () => {
  it('canonicalizes trailing slash and casing in path', () => {
    expect(normalizeImplementerGithubUrl('https://github.com/OctoCat/')).toBe(
      'https://github.com/OctoCat',
    );
  });

  it('clears empty string', () => {
    expect(normalizeImplementerGithubUrl('')).toBeNull();
    expect(normalizeImplementerGithubUrl(null)).toBeNull();
  });
});

describe('validateImplementerBio', () => {
  it('accepts short bios', () => {
    expect(validateImplementerBio('RISC-V extension ports and Spike bring-up.')).toBeNull();
  });

  it('rejects overlong bios', () => {
    expect(validateImplementerBio('x'.repeat(IMPLEMENTER_BIO_MAX + 1))).toMatch(/at most/);
  });
});

describe('normalizeImplementerBio', () => {
  it('trims whitespace', () => {
    expect(normalizeImplementerBio('  hello  ')).toBe('hello');
  });

  it('clears empty', () => {
    expect(normalizeImplementerBio('   ')).toBeNull();
  });
});
