import { prisma } from '../db';
import {
  sendNewSubmissionEmail,
  sendVerificationFailedEmail,
} from '../mailerImplementation';

const SUMMARY_PREVIEW_MAX = 400;

type UserRow = { id: number; email: string; username: string };

function summaryPreview(summary: string): string {
  const trimmed = summary.trim();
  if (trimmed.length <= SUMMARY_PREVIEW_MAX) return trimmed;
  return `${trimmed.slice(0, SUMMARY_PREVIEW_MAX)}…`;
}

async function loadUpstreamUsers(packageId: number, ownerId: number | null, orgId: number | null) {
  const ids = new Set<number>();
  if (ownerId) ids.add(ownerId);

  const maintainers = await prisma.maintainer.findMany({
    where: { packageId },
    select: { userId: true },
  });
  for (const m of maintainers) ids.add(m.userId);

  if (orgId) {
    const orgAdmins = await prisma.orgMember.findMany({
      where: { orgId, role: { in: ['owner', 'admin'] } },
      select: { userId: true },
    });
    for (const m of orgAdmins) ids.add(m.userId);
  }

  if (ids.size === 0) return [] as UserRow[];

  return prisma.user.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, email: true, username: true },
  });
}

/** Notify request creator and upstream maintainers after a deliverable is submitted. */
export function notifyNewSubmissionEmails(submissionId: number): void {
  void (async () => {
    const submission = await prisma.implementationSubmission.findUnique({
      where: { id: submissionId },
      include: {
        submittedBy: { select: { id: true, username: true } },
        request: {
          include: {
            createdBy: { select: { id: true, email: true, username: true } },
            package: { select: { id: true, slug: true, name: true, ownerId: true, orgId: true } },
          },
        },
      },
    });
    if (!submission || submission.status !== 'submitted') return;

    const { request } = submission;
    const pkg = request.package;
    const preview = summaryPreview(submission.summary);
    const base = {
      requestTitle: request.title,
      requestId: request.id,
      packageSlug: pkg.slug,
      packageName: pkg.name,
      submitterUsername: submission.submittedBy.username,
      summaryPreview: preview,
    };

    const emailed = new Set<number>();

    const creator = request.createdBy;
    if (creator.email) {
      emailed.add(creator.id);
      await sendNewSubmissionEmail({
        toEmail: creator.email,
        toUsername: creator.username,
        ...base,
      });
    }

    const upstreamUsers = await loadUpstreamUsers(pkg.id, pkg.ownerId, pkg.orgId);
    for (const user of upstreamUsers) {
      if (emailed.has(user.id)) continue;
      if (!user.email) continue;
      emailed.add(user.id);
      await sendNewSubmissionEmail({
        toEmail: user.email,
        toUsername: user.username,
        ...base,
      });
    }
  })().catch((err) => {
    console.error('[mailer/implementation] failed to send new-submission emails:', err);
  });
}

/** Notify the implementer when verification fails. */
export function notifyVerificationFailedEmail(
  submissionId: number,
  verifierUsername: string,
  notes?: string | null,
  logUrl?: string | null,
): void {
  void (async () => {
    const submission = await prisma.implementationSubmission.findUnique({
      where: { id: submissionId },
      include: {
        submittedBy: { select: { id: true, email: true, username: true } },
        request: {
          include: {
            package: { select: { slug: true, name: true } },
          },
        },
      },
    });
    if (!submission?.submittedBy.email) return;

    await sendVerificationFailedEmail({
      toEmail: submission.submittedBy.email,
      toUsername: submission.submittedBy.username,
      requestTitle: submission.request.title,
      requestId: submission.request.id,
      packageSlug: submission.request.package.slug,
      packageName: submission.request.package.name,
      verifierUsername,
      notes: notes ?? null,
      logUrl: logUrl ?? null,
    });
  })().catch((err) => {
    console.error('[mailer/implementation] failed to send verification-failed email:', err);
  });
}
