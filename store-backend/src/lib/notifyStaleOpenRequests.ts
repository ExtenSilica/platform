import { prisma } from '../db';
import { sendStaleOpenRequestEmail } from '../mailerImplementation';
import {
  DEFAULT_STALE_OPEN_DAYS,
  filterStaleOpenRequests,
} from './staleOpenImplementationRequests';

type UserRow = { id: number; email: string; username: string };

async function loadUpstreamUsers(
  packageId: number,
  ownerId: number | null,
  orgId: number | null,
): Promise<UserRow[]> {
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

  if (ids.size === 0) return [];

  return prisma.user.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, email: true, username: true },
  });
}

export type RunStaleOpenNotificationsResult = {
  scanned: number;
  notified: number;
  emailsSent: number;
};

/**
 * Find `open` requests older than staleDays without a prior reminder; email creator
 * and upstream maintainers once, then set staleOpenNotifiedAt.
 */
export async function runStaleOpenNotifications(
  staleDays: number = DEFAULT_STALE_OPEN_DAYS,
): Promise<RunStaleOpenNotificationsResult> {
  const now = new Date();

  const candidates = await prisma.implementationRequest.findMany({
    where: {
      status: 'open',
      staleOpenNotifiedAt: null,
    },
    select: {
      id: true,
      title: true,
      openedAt: true,
      createdAt: true,
      createdByUserId: true,
      packageId: true,
      package: {
        select: { id: true, slug: true, name: true, ownerId: true, orgId: true },
      },
      createdBy: { select: { id: true, email: true, username: true } },
    },
    take: 200,
  });

  const stale = filterStaleOpenRequests(candidates, now, staleDays);
  let emailsSent = 0;

  for (const row of stale) {
    const full = candidates.find((c) => c.id === row.id);
    if (!full) continue;

    const pkg = full.package;
    const daysOpen = Math.floor(
      (now.getTime() - (full.openedAt ?? full.createdAt).getTime()) /
        (24 * 60 * 60 * 1000),
    );

    const base = {
      requestTitle: full.title,
      requestId: full.id,
      packageSlug: pkg.slug,
      packageName: pkg.name,
      daysOpen,
    };

    const emailed = new Set<number>();

    if (full.createdBy.email) {
      emailed.add(full.createdBy.id);
      await sendStaleOpenRequestEmail({
        toEmail: full.createdBy.email,
        toUsername: full.createdBy.username,
        ...base,
      });
      emailsSent += 1;
    }

    const upstreamUsers = await loadUpstreamUsers(pkg.id, pkg.ownerId, pkg.orgId);
    for (const user of upstreamUsers) {
      if (emailed.has(user.id) || !user.email) continue;
      if (user.id === full.createdByUserId) continue;
      emailed.add(user.id);
      await sendStaleOpenRequestEmail({
        toEmail: user.email,
        toUsername: user.username,
        ...base,
      });
      emailsSent += 1;
    }

    await prisma.implementationRequest.update({
      where: { id: full.id },
      data: { staleOpenNotifiedAt: now },
    });
  }

  return {
    scanned: candidates.length,
    notified: stale.length,
    emailsSent,
  };
}
