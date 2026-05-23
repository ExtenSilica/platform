import type { Request, Response } from 'express';
import type { TokenGrantReason, TokenGrantStatus } from '@prisma/client';
import { prisma } from '../db';
import {
  approveTokenGrant,
  createManualTokenGrant,
  rejectTokenGrant,
  serializeTokenGrant,
  TokenGrantError,
} from '../lib/tokenGrants';

const GRANT_STATUSES: TokenGrantStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'CLAIMED'];
const GRANT_REASONS: TokenGrantReason[] = [
  'FIRST_PACKAGE_PUBLISH',
  'PACKAGE_PUBLISH',
  'OWNERSHIP_CLAIM_APPROVED',
  'IMPLEMENTATION_SUBMISSION_ACCEPTED',
  'VERIFICATION_RUN_COMPLETED',
  'EXTERNAL_CITATION_VERIFIED',
  'CODE_CONTRIBUTION_MERGED',
  'VENDOR_CLAIM_APPROVED',
  'SECURITY_REPORT_FIXED',
  'ADMIN_DISCRETIONARY',
];

function handleError(res: Response, err: unknown): void {
  if (err instanceof TokenGrantError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error('[admin/token-grants]', err);
  res.status(500).json({ error: 'Failed to process token grant.' });
}

/** GET /admin/token-grants */
export async function adminListTokenGrants(req: Request, res: Response): Promise<void> {
  const statusRaw = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : 'PENDING';
  const status = GRANT_STATUSES.includes(statusRaw as TokenGrantStatus)
    ? (statusRaw as TokenGrantStatus)
    : 'PENDING';

  const userId = Number.parseInt(String(req.query.userId ?? ''), 10);
  const reasonRaw = typeof req.query.reason === 'string' ? req.query.reason.toUpperCase() : undefined;
  const reason =
    reasonRaw && GRANT_REASONS.includes(reasonRaw as TokenGrantReason)
      ? (reasonRaw as TokenGrantReason)
      : undefined;

  const where: {
    status: TokenGrantStatus;
    userId?: number;
    reason?: TokenGrantReason;
  } = { status };
  if (Number.isInteger(userId) && userId > 0) where.userId = userId;
  if (reason) where.reason = reason;

  const grants = await prisma.tokenGrant.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    take: 200,
    include: {
      user: { select: { id: true, username: true, email: true } },
    },
  });

  res.json({ grants: grants.map(serializeTokenGrant) });
}

/** POST /admin/token-grants/:id/approve */
export async function adminApproveTokenGrant(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const id = String(req.params.id);
  const amount =
    req.body?.amount != null ? Number.parseInt(String(req.body.amount), 10) : undefined;

  try {
    await approveTokenGrant(id, req.user.id, amount);
    const grant = await prisma.tokenGrant.findUnique({
      where: { id },
      include: { user: { select: { id: true, username: true, email: true } } },
    });
    res.json({ grant: grant ? serializeTokenGrant(grant) : null });
  } catch (err) {
    handleError(res, err);
  }
}

/** POST /admin/token-grants/:id/reject */
export async function adminRejectTokenGrant(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const id = String(req.params.id);
  const reason =
    typeof req.body?.reason === 'string' && req.body.reason.trim()
      ? req.body.reason.trim()
      : 'Rejected by platform admin.';

  try {
    await rejectTokenGrant(id, req.user.id, reason);
    const grant = await prisma.tokenGrant.findUnique({
      where: { id },
      include: { user: { select: { id: true, username: true, email: true } } },
    });
    res.json({ grant: grant ? serializeTokenGrant(grant) : null });
  } catch (err) {
    handleError(res, err);
  }
}

/** POST /admin/token-grants/manual */
export async function adminCreateManualTokenGrant(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const userId = Number.parseInt(String(req.body?.userId), 10);
  const amount = Number.parseInt(String(req.body?.amount), 10);
  const reason = String(req.body?.reason ?? '').toUpperCase() as TokenGrantReason;
  const note = typeof req.body?.note === 'string' ? req.body.note : undefined;
  const referenceId =
    typeof req.body?.referenceId === 'string' ? req.body.referenceId : undefined;

  if (!Number.isInteger(userId) || userId <= 0) {
    res.status(400).json({ error: 'userId must be a positive integer.' });
    return;
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    res.status(400).json({ error: 'amount must be a positive integer.' });
    return;
  }
  if (!GRANT_REASONS.includes(reason)) {
    res.status(400).json({ error: 'Invalid reason.' });
    return;
  }

  try {
    const { id } = await createManualTokenGrant({
      userId,
      amount,
      reason,
      note,
      referenceId,
      autoApprove: true,
      approvedById: req.user.id,
    });
    const grant = await prisma.tokenGrant.findUnique({
      where: { id },
      include: { user: { select: { id: true, username: true, email: true } } },
    });
    res.status(201).json({ grant: grant ? serializeTokenGrant(grant) : null });
  } catch (err) {
    handleError(res, err);
  }
}
