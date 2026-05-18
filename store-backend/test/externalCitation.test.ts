import { describe, it, expect } from 'vitest';
import {
  validateCitationLabel,
  validateCitationUrl,
  validateCitationKind,
  isExternalCitationKind,
  parseOptionalPackageSlug,
} from '../src/lib/externalCitation';

describe('externalCitation validators', () => {
  it('accepts valid label and url', () => {
    expect(validateCitationLabel('Zenodo deposit')).toBeNull();
    expect(validateCitationUrl('https://doi.org/10.5281/zenodo.123')).toBeNull();
    expect(validateCitationKind('doi')).toBeNull();
  });

  it('rejects invalid kind', () => {
    expect(validateCitationKind('wallet')).toMatch(/kind must be/);
    expect(isExternalCitationKind('doi')).toBe(true);
    expect(isExternalCitationKind('paid')).toBe(false);
  });

  it('rejects non-http url', () => {
    expect(validateCitationUrl('ftp://example.com/x')).toMatch(/http/);
  });

  it('parses optional package slug', () => {
    expect(parseOptionalPackageSlug('')).toEqual({ value: null, error: null });
    expect(parseOptionalPackageSlug('rvx-demo')).toEqual({
      value: 'rvx-demo',
      error: null,
    });
  });
});
