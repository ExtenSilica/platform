import { describe, it, expect } from 'vitest';
import { specs } from '../src/swagger';

describe('OpenAPI spec (implementation coordination)', () => {
  it('includes implementation coordination paths', () => {
    const paths = specs.paths ?? {};
    expect(paths['/implementation-requests']).toBeDefined();
    expect(paths['/implementation-requests/{id}']).toBeDefined();
    expect(paths['/packages/{name}/implementation-requests']).toBeDefined();
    expect(paths['/submissions/{id}/verification-runs']).toBeDefined();
    expect(paths['/me/implementation-requests']).toBeDefined();
    expect(paths['/admin/implementation-requests']).toBeDefined();
    expect(paths['/users/{username}/contributions']).toBeDefined();
  });

  it('defines bearerAuth and implementation schemas', () => {
    expect(specs.components?.securitySchemes?.bearerAuth).toBeDefined();
    expect(specs.components?.schemas?.ImplementationRequest).toBeDefined();
    expect(specs.components?.schemas?.CreateVerificationRunBody).toBeDefined();
  });
});
