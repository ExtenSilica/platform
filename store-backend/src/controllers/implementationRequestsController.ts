import { Request, Response } from 'express';
import {
  ImplementationRequestStatus,
  ImplementationRequestVisibility,
  VerificationRunOutcome,
} from '@prisma/client';
import { prisma } from '../db';
import { isPlatformAdminUser } from '../lib/platformAdmin';
import {
  rejectStructuredMoney,
  validateTitle,
  validateDescription,
  validateVisibility,
  validateFundingContactEmail,
  validateOptionalShortText,
  validateHttpsUrl,
  parseCreatedByOrgId,
  parsePositiveInt,
  requestStatusSideEffects,
  validateMilestoneTitle,
  validateSubmissionSummary,
  validateInterestMessage,
  isImplementationRequestStatus,
  isVerificationRunOutcome,
  ACCEPTANCE_CRITERIA_MAX,
  TARGET_CAPABILITY_MAX,
  FUNDING_NOTE_MAX,
} from '../lib/implementationRequest';
import {
  canEditRequest,
  canViewImplementationRequest,
  canTransitionRequestStatus,
  canVerifySubmission,
  loadPackageMembershipFlags,
  isOrgMember,
  type PackageAccessContext,
  type RequestAccessContext,
  type UserAccessContext,
} from '../lib/implementationAccess';
import {
  notifyNewSubmissionEmails,
  notifyVerificationFailedEmail,
} from '../lib/notifyImplementationFlow';

// ── Includes / serializers ────────────────────────────────────────────────────

const requestInclude = {
  package: {
    select: {
      id: true,
      slug: true,
      name: true,
      ownerId: true,
      orgId: true,
    },
  },
  createdBy: {
    select: { id: true, username: true, avatarUrl: true, implementerGithubUrl: true },
  },
  createdByOrg: { select: { id: true, slug: true, displayName: true } },
  assignedImplementer: {
    select: { id: true, username: true, avatarUrl: true, implementerGithubUrl: true },
  },
  milestones: { orderBy: { sortOrder: 'asc' as const } },
  _count: { select: { interests: true, submissions: true } },
} as const;

const submissionInclude = {
  submittedBy: {
    select: { id: true, username: true, avatarUrl: true, implementerGithubUrl: true },
  },
  request: {
    select: {
      id: true,
      packageId: true,
      status: true,
      title: true,
      package: { select: { id: true, slug: true, name: true, ownerId: true, orgId: true } },
    },
  },
  verificationRuns: { orderBy: { createdAt: 'desc' as const }, take: 20 },
} as const;

function userCtx(user: { id: number; email: string }): UserAccessContext {
  return { id: user.id, email: user.email };
}

function serializeRequest(row: {
  id: number;
  packageId: number;
  createdByUserId: number;
  createdByOrgId: number | null;
  title: string;
  description: string;
  visibility: ImplementationRequestVisibility;
  status: ImplementationRequestStatus;
  targetCapability: string | null;
  acceptanceCriteriaSummary: string | null;
  fundingContactEmail: string | null;
  fundingNote: string | null;
  assignedImplementerUserId: number | null;
  openedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  package?: { id: number; slug: string; name: string; ownerId: number | null; orgId: number | null };
  createdBy?: { id: number; username: string; avatarUrl: string | null; implementerGithubUrl: string | null };
  createdByOrg?: { id: number; slug: string; displayName: string } | null;
  assignedImplementer?: {
    id: number;
    username: string;
    avatarUrl: string | null;
    implementerGithubUrl: string | null;
  } | null;
  milestones?: Array<{
    id: number;
    title: string;
    description: string | null;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }>;
  _count?: { interests: number; submissions: number };
}) {
  return {
    id: row.id,
    packageId: row.packageId,
    createdByUserId: row.createdByUserId,
    createdByOrgId: row.createdByOrgId,
    title: row.title,
    description: row.description,
    visibility: row.visibility,
    status: row.status,
    targetCapability: row.targetCapability,
    acceptanceCriteriaSummary: row.acceptanceCriteriaSummary,
    fundingContactEmail: row.fundingContactEmail,
    fundingNote: row.fundingNote,
    assignedImplementerUserId: row.assignedImplementerUserId,
    openedAt: row.openedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    package: row.package,
    createdBy: row.createdBy,
    createdByOrg: row.createdByOrg ?? null,
    assignedImplementer: row.assignedImplementer ?? null,
    milestones: row.milestones?.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      sortOrder: m.sortOrder,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    })),
    interestCount: row._count?.interests ?? 0,
    submissionCount: row._count?.submissions ?? 0,
  };
}

function serializeSubmission(row: {
  id: number;
  requestId: number;
  submittedById: number;
  status: string;
  summary: string;
  evidenceUrl: string | null;
  versionId: number | null;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  submittedBy?: {
    id: number;
    username: string;
    avatarUrl: string | null;
    implementerGithubUrl: string | null;
  };
  request?: {
    id: number;
    packageId: number;
    status: ImplementationRequestStatus;
    title: string;
    package: { id: number; slug: string; name: string; ownerId: number | null; orgId: number | null };
  };
  verificationRuns?: Array<{
    id: number;
    outcome: VerificationRunOutcome;
    notes: string | null;
    logUrl: string | null;
    createdAt: Date;
    verifierId: number;
  }>;
}) {
  return {
    id: row.id,
    requestId: row.requestId,
    submittedById: row.submittedById,
    status: row.status,
    summary: row.summary,
    evidenceUrl: row.evidenceUrl,
    versionId: row.versionId,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    submittedBy: row.submittedBy,
    request: row.request,
    verificationRuns: row.verificationRuns?.map((v) => ({
      id: v.id,
      outcome: v.outcome,
      notes: v.notes,
      logUrl: v.logUrl,
      verifierId: v.verifierId,
      createdAt: v.createdAt.toISOString(),
    })),
  };
}

async function loadPackageBySlug(slug: string) {
  return prisma.extension.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, ownerId: true, orgId: true },
  });
}

function pkgCtx(pkg: { id: number; ownerId: number | null; orgId: number | null }): PackageAccessContext {
  return { id: pkg.id, ownerId: pkg.ownerId, orgId: pkg.orgId };
}

async function loadRequestContext(
  requestId: number,
  user: UserAccessContext | null,
) {
  const row = await prisma.implementationRequest.findUnique({
    where: { id: requestId },
    include: { package: { select: { id: true, ownerId: true, orgId: true } } },
  });
  if (!row) return null;

  const membership = user
    ? await loadPackageMembershipFlags(user.id, pkgCtx(row.package), row.createdByOrgId)
    : {
        isOwner: false,
        isMaintainer: false,
        isPackageOrgOwnerOrAdmin: false,
        isRequestOrgOwnerOrAdmin: false,
      };

  const [isPackageOrgMember, isRequestOrgMember] = user
    ? await Promise.all([
        row.package.orgId ? isOrgMember(user.id, row.package.orgId) : false,
        row.createdByOrgId ? isOrgMember(user.id, row.createdByOrgId) : false,
      ])
    : [false, false];

  const requestCtx: RequestAccessContext = {
    id: row.id,
    packageId: row.packageId,
    createdByUserId: row.createdByUserId,
    createdByOrgId: row.createdByOrgId,
    status: row.status,
    assignedImplementerUserId: row.assignedImplementerUserId,
  };

  const visible = canViewImplementationRequest({
    request: { ...requestCtx, visibility: row.visibility },
    user,
    membership,
    isPackageOrgMember,
    isRequestOrgMember,
  });

  return { row, membership, requestCtx, visible };
}

function deny(res: Response, status: number, message: string) {
  res.status(status).json({ error: message });
}

// ── Package-scoped ────────────────────────────────────────────────────────────

export async function createPackageImplementationRequest(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    deny(res, 401, 'Authentication required.');
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const moneyErr = rejectStructuredMoney(body);
  if (moneyErr) {
    deny(res, 400, moneyErr);
    return;
  }

  const pkg = await loadPackageBySlug(String(req.params.name));
  if (!pkg) {
    deny(res, 404, 'Package not found.');
    return;
  }

  const titleErr = validateTitle(body.title);
  if (titleErr) {
    deny(res, 400, titleErr);
    return;
  }
  const descErr = validateDescription(body.description);
  if (descErr) {
    deny(res, 400, descErr);
    return;
  }

  const visRaw = body.visibility ?? 'public';
  const visErr = validateVisibility(visRaw);
  if (visErr) {
    deny(res, 400, visErr);
    return;
  }

  const capErr = validateOptionalShortText(body.targetCapability, 'targetCapability', TARGET_CAPABILITY_MAX);
  if (capErr) {
    deny(res, 400, capErr);
    return;
  }
  const accErr = validateOptionalShortText(
    body.acceptanceCriteriaSummary,
    'acceptanceCriteriaSummary',
    ACCEPTANCE_CRITERIA_MAX,
  );
  if (accErr) {
    deny(res, 400, accErr);
    return;
  }
  const fundEmailErr = validateFundingContactEmail(body.fundingContactEmail);
  if (fundEmailErr) {
    deny(res, 400, fundEmailErr);
    return;
  }
  const fundNoteErr = validateOptionalShortText(body.fundingNote, 'fundingNote', FUNDING_NOTE_MAX);
  if (fundNoteErr) {
    deny(res, 400, fundNoteErr);
    return;
  }

  const orgParsed = parseCreatedByOrgId(body.createdByOrgId);
  if (orgParsed.error) {
    deny(res, 400, orgParsed.error);
    return;
  }
  if (orgParsed.value) {
    const member = await isOrgMember(req.user.id, orgParsed.value);
    if (!member) {
      deny(res, 403, 'You must be a member of the organization to file on its behalf.');
      return;
    }
  }

  const created = await prisma.implementationRequest.create({
    data: {
      packageId: pkg.id,
      createdByUserId: req.user.id,
      createdByOrgId: orgParsed.value,
      title: String(body.title).trim(),
      description: String(body.description).trim(),
      visibility: visRaw as ImplementationRequestVisibility,
      targetCapability:
        typeof body.targetCapability === 'string' && body.targetCapability.trim()
          ? body.targetCapability.trim()
          : null,
      acceptanceCriteriaSummary:
        typeof body.acceptanceCriteriaSummary === 'string' &&
        body.acceptanceCriteriaSummary.trim()
          ? body.acceptanceCriteriaSummary.trim()
          : null,
      fundingContactEmail:
        typeof body.fundingContactEmail === 'string' && body.fundingContactEmail.trim()
          ? body.fundingContactEmail.trim()
          : null,
      fundingNote:
        typeof body.fundingNote === 'string' && body.fundingNote.trim()
          ? body.fundingNote.trim()
          : null,
    },
    include: requestInclude,
  });

  res.status(201).json({ request: serializeRequest(created) });
}

export async function listPackageImplementationRequests(
  req: Request,
  res: Response,
): Promise<void> {
  const pkg = await loadPackageBySlug(String(req.params.name));
  if (!pkg) {
    deny(res, 404, 'Package not found.');
    return;
  }

  const viewer = req.user ? userCtx(req.user) : null;
  const membership = viewer
    ? await loadPackageMembershipFlags(viewer.id, pkgCtx(pkg))
    : {
        isOwner: false,
        isMaintainer: false,
        isPackageOrgOwnerOrAdmin: false,
        isRequestOrgOwnerOrAdmin: false,
      };

  const rows = await prisma.implementationRequest.findMany({
    where: { packageId: pkg.id },
    include: requestInclude,
    orderBy: { createdAt: 'desc' },
  });

  const isPackageOrgMember =
    viewer && pkg.orgId ? await isOrgMember(viewer.id, pkg.orgId) : false;

  const visible = [];
  for (const row of rows) {
    const isRequestOrgMember =
      viewer && row.createdByOrgId
        ? await isOrgMember(viewer.id, row.createdByOrgId)
        : false;
  const requestMembership = viewer
      ? await loadPackageMembershipFlags(viewer.id, pkgCtx(pkg), row.createdByOrgId)
      : membership;

    if (
      canViewImplementationRequest({
        request: {
          id: row.id,
          packageId: row.packageId,
          createdByUserId: row.createdByUserId,
          createdByOrgId: row.createdByOrgId,
          status: row.status,
          assignedImplementerUserId: row.assignedImplementerUserId,
          visibility: row.visibility,
        },
        user: viewer,
        membership: requestMembership,
        isPackageOrgMember,
        isRequestOrgMember,
      })
    ) {
      visible.push(serializeRequest(row));
    }
  }

  res.json({ requests: visible });
}

// ── Top-level request routes ──────────────────────────────────────────────────

export async function listImplementationRequests(
  req: Request,
  res: Response,
): Promise<void> {
  const statusFilter =
    typeof req.query.status === 'string' && isImplementationRequestStatus(req.query.status)
      ? req.query.status
      : undefined;
  const capabilityFilter =
    typeof req.query.capability === 'string' && req.query.capability.trim()
      ? req.query.capability.trim()
      : undefined;

  const viewer = req.user ? userCtx(req.user) : null;

  const rows = await prisma.implementationRequest.findMany({
    where: {
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(capabilityFilter
        ? { targetCapability: { contains: capabilityFilter, mode: 'insensitive' } }
        : {}),
    },
    include: requestInclude,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const requests = [];
  for (const row of rows) {
    const loaded = await loadRequestContext(row.id, viewer);
    if (loaded?.visible) {
      const full = await prisma.implementationRequest.findUnique({
        where: { id: row.id },
        include: requestInclude,
      });
      if (full) requests.push(serializeRequest(full));
    }
  }

  res.json({ requests });
}

export async function getImplementationRequest(
  req: Request,
  res: Response,
): Promise<void> {
  const id = Number.parseInt(String(req.params.id), 10);
  if (!Number.isInteger(id) || id <= 0) {
    deny(res, 400, 'Request id must be a positive integer.');
    return;
  }

  const viewer = req.user ? userCtx(req.user) : null;
  const loaded = await loadRequestContext(id, viewer);
  if (!loaded) {
    deny(res, 404, 'Implementation request not found.');
    return;
  }
  if (!loaded.visible) {
    deny(res, 404, 'Implementation request not found.');
    return;
  }

  const full = await prisma.implementationRequest.findUnique({
    where: { id },
    include: requestInclude,
  });
  if (!full) {
    deny(res, 404, 'Implementation request not found.');
    return;
  }

  res.json({ request: serializeRequest(full) });
}

export async function patchImplementationRequest(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    deny(res, 401, 'Authentication required.');
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const moneyErr = rejectStructuredMoney(body);
  if (moneyErr) {
    deny(res, 400, moneyErr);
    return;
  }

  const id = Number.parseInt(String(req.params.id), 10);
  if (!Number.isInteger(id) || id <= 0) {
    deny(res, 400, 'Request id must be a positive integer.');
    return;
  }

  const loaded = await loadRequestContext(id, userCtx(req.user));
  if (!loaded || !loaded.visible) {
    deny(res, 404, 'Implementation request not found.');
    return;
  }

  const edit = canEditRequest({
    user: userCtx(req.user),
    request: loaded.requestCtx,
    membership: loaded.membership,
  });
  if (!edit.allowed) {
    deny(res, 403, edit.reason);
    return;
  }

  const data: Record<string, unknown> = {};

  if (body.title !== undefined) {
    const err = validateTitle(body.title);
    if (err) {
      deny(res, 400, err);
      return;
    }
    data.title = String(body.title).trim();
  }
  if (body.description !== undefined) {
    const err = validateDescription(body.description);
    if (err) {
      deny(res, 400, err);
      return;
    }
    data.description = String(body.description).trim();
  }
  if (body.visibility !== undefined) {
    const err = validateVisibility(body.visibility);
    if (err) {
      deny(res, 400, err);
      return;
    }
    if (loaded.row.status !== 'draft') {
      deny(res, 400, 'visibility can only be changed while the request is a draft.');
      return;
    }
    data.visibility = body.visibility;
  }
  if (body.targetCapability !== undefined) {
    const err = validateOptionalShortText(body.targetCapability, 'targetCapability', TARGET_CAPABILITY_MAX);
    if (err) {
      deny(res, 400, err);
      return;
    }
    data.targetCapability =
      typeof body.targetCapability === 'string' && body.targetCapability.trim()
        ? body.targetCapability.trim()
        : null;
  }
  if (body.acceptanceCriteriaSummary !== undefined) {
    const err = validateOptionalShortText(
      body.acceptanceCriteriaSummary,
      'acceptanceCriteriaSummary',
      ACCEPTANCE_CRITERIA_MAX,
    );
    if (err) {
      deny(res, 400, err);
      return;
    }
    data.acceptanceCriteriaSummary =
      typeof body.acceptanceCriteriaSummary === 'string' &&
      body.acceptanceCriteriaSummary.trim()
        ? body.acceptanceCriteriaSummary.trim()
        : null;
  }
  if (body.fundingContactEmail !== undefined) {
    const err = validateFundingContactEmail(body.fundingContactEmail);
    if (err) {
      deny(res, 400, err);
      return;
    }
    data.fundingContactEmail =
      typeof body.fundingContactEmail === 'string' && body.fundingContactEmail.trim()
        ? body.fundingContactEmail.trim()
        : null;
  }
  if (body.fundingNote !== undefined) {
    const err = validateOptionalShortText(body.fundingNote, 'fundingNote', FUNDING_NOTE_MAX);
    if (err) {
      deny(res, 400, err);
      return;
    }
    data.fundingNote =
      typeof body.fundingNote === 'string' && body.fundingNote.trim()
        ? body.fundingNote.trim()
        : null;
  }
  if (body.assignedImplementerUserId !== undefined) {
    const parsed = parsePositiveInt(body.assignedImplementerUserId, 'assignedImplementerUserId');
    if (parsed.error) {
      deny(res, 400, parsed.error);
      return;
    }
    if (parsed.value) {
      const u = await prisma.user.findUnique({ where: { id: parsed.value }, select: { id: true } });
      if (!u) {
        deny(res, 400, 'assignedImplementerUserId does not match a user.');
        return;
      }
    }
    data.assignedImplementerUserId = parsed.value;
  }

  if (body.status !== undefined) {
    if (!isImplementationRequestStatus(body.status)) {
      deny(res, 400, 'Invalid status value.');
      return;
    }
    const toStatus = body.status;
    const transition = canTransitionRequestStatus({
      user: userCtx(req.user),
      request: loaded.requestCtx,
      membership: loaded.membership,
      toStatus,
    });
    if (!transition.allowed) {
      deny(res, 403, transition.reason);
      return;
    }
    data.status = toStatus;
    Object.assign(data, requestStatusSideEffects(toStatus, loaded.row));
  }

  if (Object.keys(data).length === 0) {
    deny(res, 400, 'Nothing to update.');
    return;
  }

  const updated = await prisma.implementationRequest.update({
    where: { id },
    data,
    include: requestInclude,
  });

  res.json({ request: serializeRequest(updated) });
}

// ── Interests / milestones / submissions (nested) ─────────────────────────────

export async function createImplementationInterest(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    deny(res, 401, 'Authentication required.');
    return;
  }

  const moneyErr = rejectStructuredMoney((req.body ?? {}) as Record<string, unknown>);
  if (moneyErr) {
    deny(res, 400, moneyErr);
    return;
  }

  const id = Number.parseInt(String(req.params.id), 10);
  const loaded = await loadRequestContext(id, userCtx(req.user));
  if (!loaded || !loaded.visible) {
    deny(res, 404, 'Implementation request not found.');
    return;
  }
  if (loaded.row.status === 'draft' || loaded.row.status === 'cancelled') {
    deny(res, 409, 'Cannot express interest on a draft or cancelled request.');
    return;
  }

  const msgErr = validateInterestMessage(req.body?.message);
  if (msgErr) {
    deny(res, 400, msgErr);
    return;
  }

  const message =
    typeof req.body?.message === 'string' && req.body.message.trim()
      ? req.body.message.trim()
      : null;

  try {
    const interest = await prisma.implementationInterest.create({
      data: { requestId: id, userId: req.user.id, message },
    });
    res.status(201).json({
      interest: {
        id: interest.id,
        requestId: interest.requestId,
        userId: interest.userId,
        message: interest.message,
        createdAt: interest.createdAt.toISOString(),
      },
    });
  } catch {
    res.status(409).json({ error: 'You have already expressed interest in this request.' });
  }
}

export async function createImplementationMilestone(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    deny(res, 401, 'Authentication required.');
    return;
  }

  const id = Number.parseInt(String(req.params.id), 10);
  const loaded = await loadRequestContext(id, userCtx(req.user));
  if (!loaded || !loaded.visible) {
    deny(res, 404, 'Implementation request not found.');
    return;
  }

  const edit = canEditRequest({
    user: userCtx(req.user),
    request: loaded.requestCtx,
    membership: loaded.membership,
  });
  if (!edit.allowed) {
    deny(res, 403, edit.reason);
    return;
  }

  const titleErr = validateMilestoneTitle(req.body?.title);
  if (titleErr) {
    deny(res, 400, titleErr);
    return;
  }
  const descErr = validateOptionalShortText(req.body?.description, 'description', 2000);
  if (descErr) {
    deny(res, 400, descErr);
    return;
  }

  const sortOrder =
    typeof req.body?.sortOrder === 'number' && Number.isInteger(req.body.sortOrder)
      ? req.body.sortOrder
      : 0;

  const milestone = await prisma.implementationMilestone.create({
    data: {
      requestId: id,
      title: String(req.body.title).trim(),
      description:
        typeof req.body?.description === 'string' && req.body.description.trim()
          ? req.body.description.trim()
          : null,
      sortOrder,
    },
  });

  res.status(201).json({
    milestone: {
      id: milestone.id,
      requestId: milestone.requestId,
      title: milestone.title,
      description: milestone.description,
      sortOrder: milestone.sortOrder,
      createdAt: milestone.createdAt.toISOString(),
      updatedAt: milestone.updatedAt.toISOString(),
    },
  });
}

export async function patchImplementationMilestone(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    deny(res, 401, 'Authentication required.');
    return;
  }

  const requestId = Number.parseInt(String(req.params.id), 10);
  const milestoneId = Number.parseInt(String(req.params.mid), 10);
  const loaded = await loadRequestContext(requestId, userCtx(req.user));
  if (!loaded || !loaded.visible) {
    deny(res, 404, 'Implementation request not found.');
    return;
  }

  const edit = canEditRequest({
    user: userCtx(req.user),
    request: loaded.requestCtx,
    membership: loaded.membership,
  });
  if (!edit.allowed) {
    deny(res, 403, edit.reason);
    return;
  }

  const existing = await prisma.implementationMilestone.findFirst({
    where: { id: milestoneId, requestId },
  });
  if (!existing) {
    deny(res, 404, 'Milestone not found.');
    return;
  }

  const data: Record<string, unknown> = {};
  if (req.body?.title !== undefined) {
    const err = validateMilestoneTitle(req.body.title);
    if (err) {
      deny(res, 400, err);
      return;
    }
    data.title = String(req.body.title).trim();
  }
  if (req.body?.description !== undefined) {
    const err = validateOptionalShortText(req.body.description, 'description', 2000);
    if (err) {
      deny(res, 400, err);
      return;
    }
    data.description =
      typeof req.body.description === 'string' && req.body.description.trim()
        ? req.body.description.trim()
        : null;
  }
  if (req.body?.sortOrder !== undefined) {
    if (!Number.isInteger(req.body.sortOrder)) {
      deny(res, 400, 'sortOrder must be an integer.');
      return;
    }
    data.sortOrder = req.body.sortOrder;
  }

  if (Object.keys(data).length === 0) {
    deny(res, 400, 'Nothing to update.');
    return;
  }

  const updated = await prisma.implementationMilestone.update({
    where: { id: milestoneId },
    data,
  });

  res.json({
    milestone: {
      id: updated.id,
      requestId: updated.requestId,
      title: updated.title,
      description: updated.description,
      sortOrder: updated.sortOrder,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}

export async function createImplementationSubmission(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    deny(res, 401, 'Authentication required.');
    return;
  }

  const moneyErr = rejectStructuredMoney((req.body ?? {}) as Record<string, unknown>);
  if (moneyErr) {
    deny(res, 400, moneyErr);
    return;
  }

  const requestId = Number.parseInt(String(req.params.id), 10);
  const loaded = await loadRequestContext(requestId, userCtx(req.user));
  if (!loaded || !loaded.visible) {
    deny(res, 404, 'Implementation request not found.');
    return;
  }

  if (!['open', 'in_progress'].includes(loaded.row.status)) {
    deny(res, 409, 'Submissions are only accepted while the request is open or in progress.');
    return;
  }

  const summaryErr = validateSubmissionSummary(req.body?.summary);
  if (summaryErr) {
    deny(res, 400, summaryErr);
    return;
  }
  const urlErr = validateHttpsUrl(req.body?.evidenceUrl, 'evidenceUrl');
  if (urlErr) {
    deny(res, 400, urlErr);
    return;
  }

  const versionParsed = parsePositiveInt(req.body?.versionId, 'versionId');
  if (versionParsed.error) {
    deny(res, 400, versionParsed.error);
    return;
  }
  if (versionParsed.value) {
    const ver = await prisma.version.findFirst({
      where: { id: versionParsed.value, extensionId: loaded.row.packageId },
    });
    if (!ver) {
      deny(res, 400, 'versionId does not belong to this package.');
      return;
    }
  }

  const submission = await prisma.implementationSubmission.create({
    data: {
      requestId,
      submittedById: req.user.id,
      summary: String(req.body.summary).trim(),
      evidenceUrl:
        typeof req.body?.evidenceUrl === 'string' && req.body.evidenceUrl.trim()
          ? req.body.evidenceUrl.trim()
          : null,
      versionId: versionParsed.value,
    },
    include: submissionInclude,
  });

  res.status(201).json({ submission: serializeSubmission(submission) });
}

export async function patchImplementationSubmission(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    deny(res, 401, 'Authentication required.');
    return;
  }

  const moneyErr = rejectStructuredMoney((req.body ?? {}) as Record<string, unknown>);
  if (moneyErr) {
    deny(res, 400, moneyErr);
    return;
  }

  const submissionId = Number.parseInt(String(req.params.id), 10);
  const existing = await prisma.implementationSubmission.findUnique({
    where: { id: submissionId },
    include: {
      request: { include: { package: { select: { id: true, ownerId: true, orgId: true } } } },
    },
  });
  if (!existing) {
    deny(res, 404, 'Submission not found.');
    return;
  }

  const viewer = userCtx(req.user);
  const membership = await loadPackageMembershipFlags(
    viewer.id,
    pkgCtx(existing.request.package),
    existing.request.createdByOrgId,
  );

  const isAuthor = existing.submittedById === req.user.id;
  const edit = canEditRequest({
    user: viewer,
    request: {
      id: existing.request.id,
      packageId: existing.request.packageId,
      createdByUserId: existing.request.createdByUserId,
      createdByOrgId: existing.request.createdByOrgId,
      status: existing.request.status,
      assignedImplementerUserId: existing.request.assignedImplementerUserId,
    },
    membership,
  });

  if (!isAuthor && !edit.allowed) {
    deny(res, 403, 'You cannot edit this submission.');
    return;
  }

  const data: Record<string, unknown> = {};

  if (req.body?.summary !== undefined) {
    if (existing.status === 'submitted' && !isPlatformAdminUser(viewer)) {
      deny(res, 400, 'Cannot change summary after submission.');
      return;
    }
    const err = validateSubmissionSummary(req.body.summary);
    if (err) {
      deny(res, 400, err);
      return;
    }
    data.summary = String(req.body.summary).trim();
  }

  if (req.body?.evidenceUrl !== undefined) {
    const err = validateHttpsUrl(req.body.evidenceUrl, 'evidenceUrl');
    if (err) {
      deny(res, 400, err);
      return;
    }
    data.evidenceUrl =
      typeof req.body.evidenceUrl === 'string' && req.body.evidenceUrl.trim()
        ? req.body.evidenceUrl.trim()
        : null;
  }

  if (req.body?.status === 'submitted') {
    if (existing.status === 'submitted') {
      deny(res, 409, 'Submission is already submitted.');
      return;
    }
    if (!isAuthor) {
      deny(res, 403, 'Only the author may submit this deliverable.');
      return;
    }
    data.status = 'submitted';
    data.submittedAt = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.implementationSubmission.update({ where: { id: submissionId }, data });
      if (existing.request.status === 'in_progress') {
        await tx.implementationRequest.update({
          where: { id: existing.requestId },
          data: { status: 'submitted' },
        });
      }
    });

    const refreshed = await prisma.implementationSubmission.findUnique({
      where: { id: submissionId },
      include: submissionInclude,
    });
    notifyNewSubmissionEmails(submissionId);
    res.json({ submission: serializeSubmission(refreshed!) });
    return;
  }

  if (Object.keys(data).length === 0) {
    deny(res, 400, 'Nothing to update.');
    return;
  }

  const updated = await prisma.implementationSubmission.update({
    where: { id: submissionId },
    data,
    include: submissionInclude,
  });

  res.json({ submission: serializeSubmission(updated) });
}

export async function createVerificationRun(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    deny(res, 401, 'Authentication required.');
    return;
  }

  const moneyErr = rejectStructuredMoney((req.body ?? {}) as Record<string, unknown>);
  if (moneyErr) {
    deny(res, 400, moneyErr);
    return;
  }

  const submissionId = Number.parseInt(String(req.params.id), 10);
  const submission = await prisma.implementationSubmission.findUnique({
    where: { id: submissionId },
    include: {
      request: { include: { package: { select: { id: true, ownerId: true, orgId: true } } } },
    },
  });
  if (!submission) {
    deny(res, 404, 'Submission not found.');
    return;
  }
  if (submission.status !== 'submitted') {
    deny(res, 409, 'Only submitted deliverables can be verified.');
    return;
  }
  if (submission.request.status !== 'submitted') {
    deny(res, 409, 'The parent request must be in submitted status.');
    return;
  }

  const viewer = userCtx(req.user);
  const membership = await loadPackageMembershipFlags(
    viewer.id,
    pkgCtx(submission.request.package),
    submission.request.createdByOrgId,
  );

  const verify = canVerifySubmission({
    user: viewer,
    submissionSubmittedById: submission.submittedById,
    membership,
  });
  if (!verify.allowed) {
    deny(res, 403, verify.reason);
    return;
  }

  if (!isVerificationRunOutcome(req.body?.outcome)) {
    deny(res, 400, 'outcome must be "pass" or "fail".');
    return;
  }

  const notesErr = validateOptionalShortText(req.body?.notes, 'notes', 4000);
  if (notesErr) {
    deny(res, 400, notesErr);
    return;
  }
  const logErr = validateHttpsUrl(req.body?.logUrl, 'logUrl');
  if (logErr) {
    deny(res, 400, logErr);
    return;
  }

  const outcome = req.body.outcome as VerificationRunOutcome;
  const notes =
    typeof req.body?.notes === 'string' && req.body.notes.trim() ? req.body.notes.trim() : null;
  const logUrl =
    typeof req.body?.logUrl === 'string' && req.body.logUrl.trim() ? req.body.logUrl.trim() : null;

  // PR-C4: verification records outcome only — never auto-promotes Extension.portStatus.
  const run = await prisma.$transaction(async (tx) => {
    const created = await tx.verificationRun.create({
      data: {
        submissionId,
        verifierId: req.user!.id,
        outcome,
        notes,
        logUrl,
      },
    });

    if (outcome === 'pass') {
      await tx.implementationRequest.update({
        where: { id: submission.requestId },
        data: { status: 'verified' },
      });
    }

    return created;
  });

  if (outcome === 'fail') {
    const verifier = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { username: true },
    });
    notifyVerificationFailedEmail(
      submissionId,
      verifier?.username ?? 'reviewer',
      notes,
      logUrl,
    );
  }

  res.status(201).json({
    verificationRun: {
      id: run.id,
      submissionId: run.submissionId,
      verifierId: run.verifierId,
      outcome: run.outcome,
      notes: run.notes,
      logUrl: run.logUrl,
      createdAt: run.createdAt.toISOString(),
    },
  });
}

// ── /me ───────────────────────────────────────────────────────────────────────

export async function listMyImplementationRequests(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    deny(res, 401, 'Authentication required.');
    return;
  }

  const rows = await prisma.implementationRequest.findMany({
    where: {
      OR: [
        { createdByUserId: req.user.id },
        { assignedImplementerUserId: req.user.id },
        { interests: { some: { userId: req.user.id } } },
      ],
    },
    include: requestInclude,
    orderBy: { updatedAt: 'desc' },
  });

  res.json({ requests: rows.map(serializeRequest) });
}

export async function listMyImplementationSubmissions(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    deny(res, 401, 'Authentication required.');
    return;
  }

  const rows = await prisma.implementationSubmission.findMany({
    where: { submittedById: req.user.id },
    include: submissionInclude,
    orderBy: { updatedAt: 'desc' },
  });

  res.json({ submissions: rows.map(serializeSubmission) });
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export async function adminListImplementationRequests(
  req: Request,
  res: Response,
): Promise<void> {
  const statusFilter =
    typeof req.query.status === 'string' && isImplementationRequestStatus(req.query.status)
      ? req.query.status
      : undefined;

  const rows = await prisma.implementationRequest.findMany({
    where: statusFilter ? { status: statusFilter } : undefined,
    include: requestInclude,
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });

  res.json({ requests: rows.map(serializeRequest) });
}

export async function adminCancelImplementationRequest(
  req: Request,
  res: Response,
): Promise<void> {
  const id = Number.parseInt(String(req.params.id), 10);
  if (!Number.isInteger(id) || id <= 0) {
    deny(res, 400, 'Request id must be a positive integer.');
    return;
  }

  const existing = await prisma.implementationRequest.findUnique({ where: { id } });
  if (!existing) {
    deny(res, 404, 'Implementation request not found.');
    return;
  }
  if (existing.status === 'cancelled' || existing.status === 'completed') {
    deny(res, 409, `Request is already ${existing.status}.`);
    return;
  }

  const updated = await prisma.implementationRequest.update({
    where: { id },
    data: { status: 'cancelled', ...requestStatusSideEffects('cancelled', existing) },
    include: requestInclude,
  });

  res.json({ request: serializeRequest(updated) });
}
