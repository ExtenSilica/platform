import { Request, Response } from 'express';
import { prisma } from '../db';
import {
  validateReason,
  validateEvidenceUrl,
  validateDecisionNote,
  isOwnershipRequestStatus,
  evaluateEligibility,
  type OwnershipRequestStatus,
} from '../lib/ownershipRequest';

// ── Types ─────────────────────────────────────────────────────────────────────

type PrismaUser = {
  id: number;
  username: string;
  email: string;
  avatarUrl: string | null;
};

type PrismaOwnershipRequestRow = {
  id: number;
  packageId: number;
  userId: number;
  reason: string;
  evidenceUrl: string | null;
  status: string;
  decisionNote: string | null;
  decidedById: number | null;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  package?: {
    id: number;
    slug: string;
    name: string;
    description: string;
    iconUrl: string | null;
    ownerId: number | null;
    orgId: number | null;
    author: string;
    org?: { id: number; slug: string; displayName: string } | null;
  };
  user?: PrismaUser;
  decidedBy?: PrismaUser | null;
};

// ── Serializers ───────────────────────────────────────────────────────────────

function serializeUser(u?: PrismaUser | null) {
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    avatarUrl: u.avatarUrl,
  };
}

function serializeRequest(row: PrismaOwnershipRequestRow) {
  return {
    id: row.id,
    packageId: row.packageId,
    userId: row.userId,
    reason: row.reason,
    evidenceUrl: row.evidenceUrl,
    status: row.status as OwnershipRequestStatus,
    decisionNote: row.decisionNote,
    decidedById: row.decidedById,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    package: row.package
      ? {
          id: row.package.id,
          slug: row.package.slug,
          name: row.package.name,
          description: row.package.description,
          iconUrl: row.package.iconUrl,
          ownerId: row.package.ownerId,
          orgId: row.package.orgId,
          author: row.package.author,
          org: row.package.org ?? null,
        }
      : undefined,
    user: serializeUser(row.user),
    decidedBy: serializeUser(row.decidedBy),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loadPackageBySlug(slug: string) {
  return prisma.extension.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      ownerId: true,
      orgId: true,
    },
  });
}

async function isUserMaintainer(packageId: number, userId: number) {
  const m = await prisma.maintainer.findUnique({
    where: { packageId_userId: { packageId, userId } },
  });
  return m !== null;
}

async function isUserInOrg(orgId: number, userId: number) {
  const m = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
  });
  return m !== null;
}

async function hasUserPendingRequest(packageId: number, userId: number) {
  const r = await prisma.ownershipRequest.findFirst({
    where: { packageId, userId, status: 'pending' },
    select: { id: true },
  });
  return r !== null;
}

// ── Handlers — user-facing ────────────────────────────────────────────────────

/**
 * GET /packages/:name/ownership-requests/eligibility
 * Public when unauth (eligible=false). The frontend uses this to decide
 * whether to render the "Request ownership" CTA on the package page.
 */
export async function getEligibility(
  req: Request,
  res: Response,
): Promise<void> {
  const slug = String(req.params.name);
  const pkg = await loadPackageBySlug(slug);
  if (!pkg) {
    res.status(404).json({ error: `Package "${slug}" not found.` });
    return;
  }

  if (!req.user) {
    res.json({
      eligible: false,
      reason: 'Sign in to request ownership of this package.',
      requiresAuth: true,
    });
    return;
  }

  const [isMaintainer, isOrgMember, hasPending] = await Promise.all([
    isUserMaintainer(pkg.id, req.user.id),
    pkg.orgId ? isUserInOrg(pkg.orgId, req.user.id) : Promise.resolve(false),
    hasUserPendingRequest(pkg.id, req.user.id),
  ]);

  const decision = evaluateEligibility({
    userId: req.user.id,
    packageOwnerId: pkg.ownerId,
    isMaintainer,
    hasPendingRequest: hasPending,
    isOrgMember,
  });

  if (decision.eligible) {
    res.json({ eligible: true });
  } else {
    res.json({ eligible: false, reason: decision.reason });
  }
}

/**
 * POST /packages/:name/ownership-requests
 * Authenticated. Creates a pending OwnershipRequest after the eligibility check.
 */
export async function createRequest(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const slug = String(req.params.name);
  const pkg = await loadPackageBySlug(slug);
  if (!pkg) {
    res.status(404).json({ error: `Package "${slug}" not found.` });
    return;
  }

  const reasonErr = validateReason(req.body?.reason);
  if (reasonErr) {
    res.status(400).json({ error: reasonErr });
    return;
  }

  const evidenceErr = validateEvidenceUrl(req.body?.evidenceUrl);
  if (evidenceErr) {
    res.status(400).json({ error: evidenceErr });
    return;
  }

  const [isMaintainer, isOrgMember, hasPending] = await Promise.all([
    isUserMaintainer(pkg.id, req.user.id),
    pkg.orgId ? isUserInOrg(pkg.orgId, req.user.id) : Promise.resolve(false),
    hasUserPendingRequest(pkg.id, req.user.id),
  ]);

  const decision = evaluateEligibility({
    userId: req.user.id,
    packageOwnerId: pkg.ownerId,
    isMaintainer,
    hasPendingRequest: hasPending,
    isOrgMember,
  });

  if (!decision.eligible) {
    res.status(409).json({ error: decision.reason });
    return;
  }

  const reason = String(req.body.reason).trim();
  const evidenceUrl =
    typeof req.body?.evidenceUrl === 'string' && req.body.evidenceUrl.trim()
      ? req.body.evidenceUrl.trim()
      : null;

  const created = await prisma.ownershipRequest.create({
    data: {
      packageId: pkg.id,
      userId: req.user.id,
      reason,
      evidenceUrl,
    },
    include: {
      package: {
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          iconUrl: true,
          ownerId: true,
          orgId: true,
          author: true,
          org: { select: { id: true, slug: true, displayName: true } },
        },
      },
      user: {
        select: { id: true, username: true, email: true, avatarUrl: true },
      },
    },
  });

  res.status(201).json({ request: serializeRequest(created) });
}

/**
 * GET /me/ownership-requests
 * Authenticated. Lists the current user's own requests, newest first.
 */
export async function listMyRequests(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const status = String(req.query.status ?? '').trim();
  const where: { userId: number; status?: string } = { userId: req.user.id };
  if (status) {
    if (!isOwnershipRequestStatus(status)) {
      res.status(400).json({
        error: `status must be one of: pending, approved, rejected, withdrawn.`,
      });
      return;
    }
    where.status = status;
  }

  const rows = await prisma.ownershipRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      package: {
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          iconUrl: true,
          ownerId: true,
          orgId: true,
          author: true,
          org: { select: { id: true, slug: true, displayName: true } },
        },
      },
      decidedBy: {
        select: { id: true, username: true, email: true, avatarUrl: true },
      },
    },
  });

  res.json({ requests: rows.map(serializeRequest) });
}

/**
 * POST /me/ownership-requests/:id/withdraw
 * Authenticated. Owner of the request can withdraw it while still pending.
 */
export async function withdrawMyRequest(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const id = Number.parseInt(String(req.params.id), 10);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Request id must be a positive integer.' });
    return;
  }

  const existing = await prisma.ownershipRequest.findUnique({ where: { id } });
  if (!existing || existing.userId !== req.user.id) {
    res.status(404).json({ error: 'Ownership request not found.' });
    return;
  }
  if (existing.status !== 'pending') {
    res
      .status(409)
      .json({ error: `Cannot withdraw a request that is already ${existing.status}.` });
    return;
  }

  const updated = await prisma.ownershipRequest.update({
    where: { id },
    data: { status: 'withdrawn' },
    include: {
      package: {
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          iconUrl: true,
          ownerId: true,
          orgId: true,
          author: true,
          org: { select: { id: true, slug: true, displayName: true } },
        },
      },
    },
  });

  res.json({ request: serializeRequest(updated) });
}

// ── Handlers — admin-facing ───────────────────────────────────────────────────

/**
 * GET /admin/ownership-requests
 * Platform-admin only. Lists all requests; defaults to status=pending.
 */
export async function adminListRequests(
  req: Request,
  res: Response,
): Promise<void> {
  const status = String(req.query.status ?? 'pending').trim();
  const where: { status?: string } = {};
  if (status && status !== 'all') {
    if (!isOwnershipRequestStatus(status)) {
      res.status(400).json({
        error: `status must be one of: pending, approved, rejected, withdrawn, all.`,
      });
      return;
    }
    where.status = status;
  }

  const rows = await prisma.ownershipRequest.findMany({
    where,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: {
      package: {
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          iconUrl: true,
          ownerId: true,
          orgId: true,
          author: true,
          org: { select: { id: true, slug: true, displayName: true } },
        },
      },
      user: {
        select: { id: true, username: true, email: true, avatarUrl: true },
      },
      decidedBy: {
        select: { id: true, username: true, email: true, avatarUrl: true },
      },
    },
  });

  res.json({ requests: rows.map(serializeRequest) });
}

/**
 * POST /admin/ownership-requests/:id/approve
 *
 * Atomic: marks the request approved, sets Extension.ownerId to the requester,
 * and inserts a Maintainer { role: "owner" } row (idempotent via upsert).
 * All other pending requests for the same package become rejected automatically
 * with a synthetic decisionNote.
 */
export async function adminApproveRequest(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const id = Number.parseInt(String(req.params.id), 10);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Request id must be a positive integer.' });
    return;
  }

  const noteErr = validateDecisionNote(req.body?.decisionNote);
  if (noteErr) {
    res.status(400).json({ error: noteErr });
    return;
  }
  const decisionNote =
    typeof req.body?.decisionNote === 'string' && req.body.decisionNote.trim()
      ? req.body.decisionNote.trim()
      : null;

  const existing = await prisma.ownershipRequest.findUnique({
    where: { id },
    include: { package: true },
  });
  if (!existing) {
    res.status(404).json({ error: 'Ownership request not found.' });
    return;
  }
  if (existing.status !== 'pending') {
    res.status(409).json({
      error: `Cannot approve a request that is already ${existing.status}.`,
    });
    return;
  }

  const decidedById = req.user.id;
  const decidedAt = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const approved = await tx.ownershipRequest.update({
      where: { id },
      data: {
        status: 'approved',
        decisionNote,
        decidedById,
        decidedAt,
      },
      include: {
        package: {
          select: {
            id: true,
            slug: true,
            name: true,
            description: true,
            iconUrl: true,
            ownerId: true,
            orgId: true,
            author: true,
            org: { select: { id: true, slug: true, displayName: true } },
          },
        },
        user: {
          select: { id: true, username: true, email: true, avatarUrl: true },
        },
        decidedBy: {
          select: { id: true, username: true, email: true, avatarUrl: true },
        },
      },
    });

    await tx.extension.update({
      where: { id: existing.packageId },
      data: { ownerId: existing.userId },
    });

    await tx.maintainer.upsert({
      where: {
        packageId_userId: {
          packageId: existing.packageId,
          userId: existing.userId,
        },
      },
      create: {
        packageId: existing.packageId,
        userId: existing.userId,
        role: 'owner',
      },
      update: { role: 'owner' },
    });

    // Auto-reject any other still-pending requests for this package.
    await tx.ownershipRequest.updateMany({
      where: {
        packageId: existing.packageId,
        status: 'pending',
        id: { not: id },
      },
      data: {
        status: 'rejected',
        decisionNote:
          'Auto-rejected: another ownership request for this package was approved.',
        decidedById,
        decidedAt,
      },
    });

    return approved;
  });

  res.json({ request: serializeRequest(result) });
}

/**
 * POST /admin/ownership-requests/:id/reject
 * Platform-admin only. Marks the request as rejected.
 */
export async function adminRejectRequest(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const id = Number.parseInt(String(req.params.id), 10);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Request id must be a positive integer.' });
    return;
  }

  const noteErr = validateDecisionNote(req.body?.decisionNote);
  if (noteErr) {
    res.status(400).json({ error: noteErr });
    return;
  }
  const decisionNote =
    typeof req.body?.decisionNote === 'string' && req.body.decisionNote.trim()
      ? req.body.decisionNote.trim()
      : null;

  const existing = await prisma.ownershipRequest.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Ownership request not found.' });
    return;
  }
  if (existing.status !== 'pending') {
    res.status(409).json({
      error: `Cannot reject a request that is already ${existing.status}.`,
    });
    return;
  }

  const updated = await prisma.ownershipRequest.update({
    where: { id },
    data: {
      status: 'rejected',
      decisionNote,
      decidedById: req.user.id,
      decidedAt: new Date(),
    },
    include: {
      package: {
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          iconUrl: true,
          ownerId: true,
          orgId: true,
          author: true,
          org: { select: { id: true, slug: true, displayName: true } },
        },
      },
      user: {
        select: { id: true, username: true, email: true, avatarUrl: true },
      },
      decidedBy: {
        select: { id: true, username: true, email: true, avatarUrl: true },
      },
    },
  });

  res.json({ request: serializeRequest(updated) });
}
