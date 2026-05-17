import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  canEditRequest,
  canVerifySubmission,
  canTransitionRequestStatus,
  isPackageUpstreamMaintainerFromFlags,
  isRequestCreatorOrOrgDelegate,
  type PackageMembershipFlags,
  type RequestAccessContext,
  type UserAccessContext,
} from '../src/lib/implementationAccess';
import { clearPlatformAdminCacheForTests } from '../src/lib/platformAdmin';

const alice: UserAccessContext = { id: 10, email: 'alice@example.com' };
const bob: UserAccessContext = { id: 20, email: 'bob@example.com' };
const admin: UserAccessContext = { id: 1, email: 'platform-admin@extensilica.com' };

function flags(overrides: Partial<PackageMembershipFlags> = {}): PackageMembershipFlags {
  return {
    isOwner: false,
    isMaintainer: false,
    isPackageOrgOwnerOrAdmin: false,
    isRequestOrgOwnerOrAdmin: false,
    ...overrides,
  };
}

function request(overrides: Partial<RequestAccessContext> = {}): RequestAccessContext {
  return {
    id: 1,
    packageId: 100,
    createdByUserId: alice.id,
    createdByOrgId: null,
    status: 'open',
    assignedImplementerUserId: null,
    ...overrides,
  };
}

describe('isPackageUpstreamMaintainerFromFlags', () => {
  it('is true for owner, maintainer, or package org admin', () => {
    expect(isPackageUpstreamMaintainerFromFlags(flags({ isOwner: true }))).toBe(true);
    expect(isPackageUpstreamMaintainerFromFlags(flags({ isMaintainer: true }))).toBe(true);
    expect(isPackageUpstreamMaintainerFromFlags(flags({ isPackageOrgOwnerOrAdmin: true }))).toBe(
      true,
    );
  });

  it('is false with no upstream relationship', () => {
    expect(isPackageUpstreamMaintainerFromFlags(flags())).toBe(false);
  });
});

describe('isRequestCreatorOrOrgDelegate', () => {
  it('recognizes the creating user', () => {
    expect(isRequestCreatorOrOrgDelegate(alice.id, request(), flags())).toBe(true);
    expect(isRequestCreatorOrOrgDelegate(bob.id, request(), flags())).toBe(false);
  });

  it('recognizes org owner/admin when request was filed for an org', () => {
    expect(
      isRequestCreatorOrOrgDelegate(
        bob.id,
        request({ createdByOrgId: 5 }),
        flags({ isRequestOrgOwnerOrAdmin: true }),
      ),
    ).toBe(true);
  });
});

describe('canEditRequest', () => {
  it('allows the creator on draft and open requests', () => {
    expect(
      canEditRequest({ user: alice, request: request({ status: 'draft' }), membership: flags() }),
    ).toEqual({ allowed: true });
    expect(
      canEditRequest({ user: alice, request: request({ status: 'open' }), membership: flags() }),
    ).toEqual({ allowed: true });
  });

  it('denies the creator once work has moved past open', () => {
    const decision = canEditRequest({
      user: alice,
      request: request({ status: 'in_progress' }),
      membership: flags(),
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.reason).toMatch(/creator/i);
    }
  });

  it('allows upstream maintainers on active requests', () => {
    expect(
      canEditRequest({
        user: bob,
        request: request({ status: 'in_progress' }),
        membership: flags({ isMaintainer: true }),
      }),
    ).toEqual({ allowed: true });
  });

  it('denies assigned implementers', () => {
    const decision = canEditRequest({
      user: bob,
      request: request({
        status: 'in_progress',
        assignedImplementerUserId: bob.id,
      }),
      membership: flags(),
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.reason).toMatch(/submissions/i);
    }
  });

  it('denies edits on terminal requests for non-admins', () => {
    const decision = canEditRequest({
      user: bob,
      request: request({ status: 'completed' }),
      membership: flags({ isMaintainer: true }),
    });
    expect(decision.allowed).toBe(false);
  });
});

describe('canVerifySubmission', () => {
  it('allows upstream maintainers who did not submit', () => {
    expect(
      canVerifySubmission({
        user: bob,
        submissionSubmittedById: alice.id,
        membership: flags({ isOwner: true }),
      }),
    ).toEqual({ allowed: true });
  });

  it('denies self-verification', () => {
    const decision = canVerifySubmission({
      user: alice,
      submissionSubmittedById: alice.id,
      membership: flags({ isOwner: true }),
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.reason).toMatch(/you authored/i);
    }
  });

  it('denies unrelated users', () => {
    const decision = canVerifySubmission({
      user: bob,
      submissionSubmittedById: alice.id,
      membership: flags(),
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.reason).toMatch(/upstream maintainer/i);
    }
  });
});

describe('canTransitionRequestStatus', () => {
  it('blocks direct submitted → verified transition', () => {
    const decision = canTransitionRequestStatus({
      user: bob,
      request: request({ status: 'submitted' }),
      membership: flags({ isOwner: true }),
      toStatus: 'verified',
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.reason).toMatch(/verification run/i);
    }
  });
});

describe('platform admin overrides', () => {
  const prevIds = process.env.PLATFORM_ADMIN_USER_IDS;
  const prevEmails = process.env.PLATFORM_ADMIN_EMAILS;

  beforeEach(() => {
    process.env.PLATFORM_ADMIN_USER_IDS = String(admin.id);
    delete process.env.PLATFORM_ADMIN_EMAILS;
    clearPlatformAdminCacheForTests();
  });

  afterEach(() => {
    if (prevIds === undefined) delete process.env.PLATFORM_ADMIN_USER_IDS;
    else process.env.PLATFORM_ADMIN_USER_IDS = prevIds;
    if (prevEmails === undefined) delete process.env.PLATFORM_ADMIN_EMAILS;
    else process.env.PLATFORM_ADMIN_EMAILS = prevEmails;
  });

  it('allows platform admin to edit completed requests', () => {
    expect(
      canEditRequest({
        user: admin,
        request: request({ status: 'completed' }),
        membership: flags(),
      }),
    ).toEqual({ allowed: true });
  });

  it('allows platform admin to verify without being upstream', () => {
    expect(
      canVerifySubmission({
        user: admin,
        submissionSubmittedById: alice.id,
        membership: flags(),
      }),
    ).toEqual({ allowed: true });
  });
});
