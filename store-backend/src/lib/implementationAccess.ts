/**
 * Access rules for implementation coordination (Phase C).
 *
 * Pure decision helpers take preloaded flags so unit tests stay DB-free.
 * Async loaders query Prisma for controllers (C3+).
 */

import { prisma } from '../db';
import { isPlatformAdminUser } from './platformAdmin';
import type {
  ImplementationRequestStatus,
  ImplementationRequestVisibility,
} from './implementationRequest';
import {
  isTerminalRequestStatus,
  validateRequestStatusTransition,
} from './implementationRequest';

export type UserAccessContext = {
  id: number;
  email: string;
};

export type PackageAccessContext = {
  id: number;
  ownerId: number | null;
  orgId: number | null;
};

export type RequestAccessContext = {
  id: number;
  packageId: number;
  createdByUserId: number;
  createdByOrgId: number | null;
  status: ImplementationRequestStatus;
  assignedImplementerUserId: number | null;
};

/** Preloaded membership relative to a package (and optionally the request's org). */
export type PackageMembershipFlags = {
  isOwner: boolean;
  isMaintainer: boolean;
  /** Owner or admin of the package's publishing org (`Extension.orgId`). */
  isPackageOrgOwnerOrAdmin: boolean;
  /** Owner or admin of `ImplementationRequest.createdByOrgId` when set. */
  isRequestOrgOwnerOrAdmin: boolean;
};

export type AccessDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

export function isUpstreamMaintainerFromFlags(flags: PackageMembershipFlags): boolean {
  return flags.isOwner || flags.isMaintainer || flags.isPackageOrgOwnerOrAdmin;
}

/**
 * True when the user represents upstream for the package (owner, maintainer,
 * or org owner/admin for scoped packages).
 */
export function isPackageUpstreamMaintainerFromFlags(
  flags: PackageMembershipFlags,
): boolean {
  return isUpstreamMaintainerFromFlags(flags);
}

export function isRequestCreatorOrOrgDelegate(
  userId: number,
  request: Pick<RequestAccessContext, 'createdByUserId' | 'createdByOrgId'>,
  flags: PackageMembershipFlags,
): boolean {
  if (request.createdByUserId === userId) return true;
  if (request.createdByOrgId !== null && flags.isRequestOrgOwnerOrAdmin) return true;
  return false;
}

/**
 * Whether the user may PATCH an implementation request (metadata or workflow).
 * Fine-grained field rules live in the controller; this is the coarse gate.
 */
export function canEditRequest(input: {
  user: UserAccessContext;
  request: RequestAccessContext;
  membership: PackageMembershipFlags;
}): AccessDecision {
  if (isPlatformAdminUser(input.user)) {
    return { allowed: true };
  }

  const { request, membership, user } = input;

  if (isTerminalRequestStatus(request.status)) {
    return {
      allowed: false,
      reason: `Requests in status "${request.status}" cannot be edited.`,
    };
  }

  if (isRequestCreatorOrOrgDelegate(user.id, request, membership)) {
    if (request.status === 'draft' || request.status === 'open') {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: 'Only draft or open requests can be edited by the creator.',
    };
  }

  if (isUpstreamMaintainerFromFlags(membership)) {
    return { allowed: true };
  }

  if (request.assignedImplementerUserId === user.id) {
    return {
      allowed: false,
      reason: 'Assigned implementers update work via submissions, not by editing the request.',
    };
  }

  return {
    allowed: false,
    reason: 'You do not have permission to edit this implementation request.',
  };
}

/**
 * Default verifier: upstream maintainer or platform admin. Submitters cannot
 * verify their own work.
 */
export function canVerifySubmission(input: {
  user: UserAccessContext;
  submissionSubmittedById: number;
  membership: PackageMembershipFlags;
}): AccessDecision {
  if (input.user.id === input.submissionSubmittedById) {
    return {
      allowed: false,
      reason: 'You cannot verify a submission you authored.',
    };
  }

  if (isPlatformAdminUser(input.user)) {
    return { allowed: true };
  }

  if (isUpstreamMaintainerFromFlags(input.membership)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: 'Only the package upstream maintainer or a platform admin can verify submissions.',
  };
}

export async function isOrgOwnerOrAdmin(userId: number, orgId: number): Promise<boolean> {
  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
    select: { role: true },
  });
  return membership !== null && ['owner', 'admin'].includes(membership.role);
}

/**
 * Load maintainer / owner / org-admin flags for a user on a package.
 * Pass `requestOrgId` when evaluating a specific implementation request.
 */
export async function loadPackageMembershipFlags(
  userId: number,
  pkg: PackageAccessContext,
  requestOrgId?: number | null,
): Promise<PackageMembershipFlags> {
  const [maintainer, packageOrgAdmin, requestOrgAdmin] = await Promise.all([
    prisma.maintainer.findUnique({
      where: { packageId_userId: { packageId: pkg.id, userId } },
      select: { id: true },
    }),
    pkg.orgId ? isOrgOwnerOrAdmin(userId, pkg.orgId) : Promise.resolve(false),
    requestOrgId ? isOrgOwnerOrAdmin(userId, requestOrgId) : Promise.resolve(false),
  ]);

  return {
    isOwner: pkg.ownerId !== null && pkg.ownerId === userId,
    isMaintainer: maintainer !== null,
    isPackageOrgOwnerOrAdmin: packageOrgAdmin,
    isRequestOrgOwnerOrAdmin: requestOrgAdmin,
  };
}

export async function isPackageUpstreamMaintainer(
  userId: number,
  pkg: PackageAccessContext,
): Promise<boolean> {
  const flags = await loadPackageMembershipFlags(userId, pkg);
  return isPackageUpstreamMaintainerFromFlags(flags);
}

export async function isOrgMember(userId: number, orgId: number): Promise<boolean> {
  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
    select: { id: true },
  });
  return membership !== null;
}

/** Whether an authenticated or anonymous viewer may see a request. */
export function canViewImplementationRequest(input: {
  request: RequestAccessContext & { visibility: ImplementationRequestVisibility };
  user: UserAccessContext | null;
  membership: PackageMembershipFlags;
  isPackageOrgMember: boolean;
  isRequestOrgMember: boolean;
}): boolean {
  const { request, user, membership } = input;

  if (user && isPlatformAdminUser(user)) return true;
  if (user && isRequestCreatorOrOrgDelegate(user.id, request, membership)) return true;
  if (user && isUpstreamMaintainerFromFlags(membership)) return true;

  if (request.status === 'draft') return false;

  if (request.visibility === 'unlisted') {
    return false;
  }

  if (request.visibility === 'org_only') {
    if (!user) return false;
    return input.isPackageOrgMember || input.isRequestOrgMember;
  }

  return request.visibility === 'public';
}

export function canTransitionRequestStatus(input: {
  user: UserAccessContext;
  request: RequestAccessContext;
  membership: PackageMembershipFlags;
  toStatus: ImplementationRequestStatus;
}): AccessDecision {
  const transitionErr = validateRequestStatusTransition(input.request.status, input.toStatus);
  if (transitionErr) {
    return { allowed: false, reason: transitionErr };
  }

  if (isPlatformAdminUser(input.user)) {
    return { allowed: true };
  }

  const { request, membership, user } = input;
  const isCreator = isRequestCreatorOrOrgDelegate(user.id, request, membership);
  const isUpstream = isUpstreamMaintainerFromFlags(membership);
  const isAssignee = request.assignedImplementerUserId === user.id;
  const from = request.status;
  const to = input.toStatus;

  if (to === 'cancelled') {
    if (isCreator && (from === 'draft' || from === 'open')) {
      return { allowed: true };
    }
    if (isUpstream) return { allowed: true };
    return {
      allowed: false,
      reason: 'Only the creator (draft/open) or upstream maintainer may cancel this request.',
    };
  }

  if (from === 'draft' && to === 'open') {
    return isCreator
      ? { allowed: true }
      : { allowed: false, reason: 'Only the request creator may publish a draft.' };
  }

  if (from === 'open' && to === 'in_progress') {
    return isCreator || isUpstream
      ? { allowed: true }
      : {
          allowed: false,
          reason: 'Only the creator or upstream maintainer may start work.',
        };
  }

  if (from === 'in_progress' && to === 'submitted') {
    return isAssignee || isUpstream
      ? { allowed: true }
      : {
          allowed: false,
          reason: 'Only the assigned implementer or upstream maintainer may mark submitted.',
        };
  }

  if (from === 'verified' && to === 'completed') {
    return isUpstream
      ? { allowed: true }
      : {
          allowed: false,
          reason: 'Only the upstream maintainer may complete a verified request.',
        };
  }

  if (from === 'submitted' && to === 'verified') {
    return {
      allowed: false,
      reason: 'Use a verification run to mark a submission as verified.',
    };
  }

  return {
    allowed: false,
    reason: `You cannot move this request from "${from}" to "${to}".`,
  };
}
