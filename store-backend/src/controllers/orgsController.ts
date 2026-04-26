import { Request, Response } from 'express';
import { prisma } from '../db';
import { sortBySemverDesc } from '../lib/semverSort';
import { computePackageMaturityFromVersion } from '../lib/maturity';

// ── Slug validation ───────────────────────────────────────────────────────────

const ORG_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$|^[a-z0-9]{1,2}$/;

const RESERVED_ORG_SLUGS = new Set([
  'admin', 'administrator', 'root', 'system', 'official', 'staff', 'support',
  'security', 'moderator', 'extensilica', 'xsil', 'registry', 'store',
  'undefined', 'null', 'test', 'example', 'demo',
]);

/** Optional LinkedIn company (or school) page — https only. */
function validateLinkedinUrl(raw: string | undefined | null): string | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const u = raw.trim();
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== 'https:') return 'linkedinUrl must use https.';
    const host = parsed.hostname.replace(/^www\./i, '');
    if (host !== 'linkedin.com') return 'linkedinUrl must be a linkedin.com address.';
    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    if (!/^\/(company|school)\/[^/]+/i.test(path)) {
      return 'Use a LinkedIn company or school URL, e.g. https://www.linkedin.com/company/your-org';
    }
    return null;
  } catch {
    return 'linkedinUrl must be a valid URL.';
  }
}

function validateOrgSlug(slug: string): string | null {
  if (slug.length < 2) return 'Organization name is too short (minimum 2 characters).';
  if (slug.length > 64) return 'Organization name is too long (maximum 64 characters).';
  if (!ORG_SLUG_RE.test(slug)) {
    return 'Organization name may only contain lowercase letters, digits, and hyphens.';
  }
  if (RESERVED_ORG_SLUGS.has(slug)) {
    return `"${slug}" is a reserved name and cannot be used for an organization.`;
  }
  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function requireOrgRole(
  orgId: number,
  userId: number,
  allowedRoles: string[]
): Promise<boolean> {
  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
  });
  return membership !== null && allowedRoles.includes(membership.role);
}

// ── Handlers ──────────────────────────────────────────────────────────────────

/**
 * POST /orgs
 * Create a new organization. The requesting user becomes the owner.
 */
export const createOrg = async (req: Request, res: Response): Promise<void> => {
  const user = req.user;
  if (!user) { res.status(401).json({ error: 'Authentication required.' }); return; }

  const { name, displayName, description, websiteUrl, linkedinUrl } = req.body as Record<
    string,
    string | undefined
  >;

  if (!name?.trim()) { res.status(400).json({ error: 'Organization name is required.' }); return; }
  if (!displayName?.trim()) { res.status(400).json({ error: 'Display name is required.' }); return; }

  const slug = name.trim().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/_/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const slugError = validateOrgSlug(slug);
  if (slugError) { res.status(400).json({ error: slugError }); return; }

  if (websiteUrl && !/^https?:\/\/.+/.test(websiteUrl)) {
    res.status(400).json({ error: 'websiteUrl must be a valid http/https URL.' });
    return;
  }

  const liErr = validateLinkedinUrl(linkedinUrl);
  if (liErr) {
    res.status(400).json({ error: liErr });
    return;
  }

  try {
    const existing = await prisma.organization.findUnique({ where: { slug } });
    if (existing) {
      res.status(409).json({ error: `An organization named "@${slug}" already exists.` });
      return;
    }

    const org = await prisma.organization.create({
      data: {
        slug,
        displayName: displayName.trim(),
        description: description?.trim() || null,
        websiteUrl: websiteUrl?.trim() || null,
        linkedinUrl: linkedinUrl?.trim() || null,
        members: {
          create: { userId: user.id, role: 'owner' },
        },
      },
      include: { members: { include: { user: { select: { id: true, username: true, avatarUrl: true } } } } },
    });

    res.status(201).json(org);
  } catch (err) {
    console.error('[orgs/create]', err);
    res.status(500).json({ error: 'Failed to create organization.' });
  }
};

/**
 * GET /orgs/:slug
 * Public org profile: info + member list + packages.
 */
export const getOrg = async (req: Request, res: Response): Promise<void> => {
  const { slug } = req.params;
  try {
    const org = await prisma.organization.findUnique({
      where: { slug },
      include: {
        members: {
          orderBy: { joinedAt: 'asc' },
          include: { user: { select: { id: true, username: true, avatarUrl: true } } },
        },
        packages: {
          orderBy: { totalDownloads: 'desc' },
          include: {
            versions: {
              where: { isYanked: false },
              orderBy: { publishedAt: 'desc' },
              take: 80,
            },
          },
        },
      },
    });

    if (!org) { res.status(404).json({ error: 'Organization not found.' }); return; }

    const { packages: rawPackages, ...orgRest } = org;
    const packages = rawPackages.map((pkg) => {
      const nonY = pkg.versions.filter((v) => !v.isYanked);
      const sorted = sortBySemverDesc(nonY);
      const latest = sorted[0] ?? sortBySemverDesc(pkg.versions)[0];
      const { level, badges } = computePackageMaturityFromVersion(latest ?? null);
      return {
        id: pkg.id,
        slug: pkg.slug,
        name: pkg.name,
        description: pkg.description,
        latestVersion: pkg.latestVersion,
        totalDownloads: pkg.totalDownloads,
        weeklyDownloads: pkg.weeklyDownloads,
        isDeprecated: pkg.isDeprecated,
        createdAt: pkg.createdAt.toISOString(),
        maturityLevel: level,
        capabilityBadges: badges,
      };
    });

    res.json({ ...orgRest, packages });
  } catch (err) {
    console.error('[orgs/get]', err);
    res.status(500).json({ error: 'Failed to retrieve organization.' });
  }
};

/**
 * GET /orgs
 * List all organizations (paginated).
 */
export const listOrgs = async (req: Request, res: Response): Promise<void> => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip = (page - 1) * limit;

  try {
    const [total, orgs] = await prisma.$transaction([
      prisma.organization.count(),
      prisma.organization.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, slug: true, displayName: true, description: true,
          avatarUrl: true, linkedinUrl: true, createdAt: true,
          _count: { select: { members: true, packages: true } },
        },
      }),
    ]);
    res.json({ total, page, limit, orgs });
  } catch (err) {
    console.error('[orgs/list]', err);
    res.status(500).json({ error: 'Failed to list organizations.' });
  }
};

/**
 * PATCH /orgs/:slug
 * Update org metadata. Requires owner or admin role.
 */
export const updateOrg = async (req: Request, res: Response): Promise<void> => {
  const user = req.user;
  if (!user) { res.status(401).json({ error: 'Authentication required.' }); return; }

  const { slug } = req.params;

  try {
    const org = await prisma.organization.findUnique({ where: { slug } });
    if (!org) { res.status(404).json({ error: 'Organization not found.' }); return; }

    const allowed = await requireOrgRole(org.id, user.id, ['owner', 'admin']);
    if (!allowed) { res.status(403).json({ error: 'Only org owners or admins can update organization settings.' }); return; }

    const { displayName, description, avatarUrl, websiteUrl, linkedinUrl } = req.body as Record<
      string,
      string | undefined | null
    >;

    if (websiteUrl && !/^https?:\/\/.+/.test(websiteUrl)) {
      res.status(400).json({ error: 'websiteUrl must be a valid http/https URL.' });
      return;
    }
    if (avatarUrl && !/^https?:\/\/.+/.test(avatarUrl)) {
      res.status(400).json({ error: 'avatarUrl must be a valid http/https URL.' });
      return;
    }
    if (linkedinUrl !== undefined && linkedinUrl !== null && linkedinUrl !== '') {
      const le = validateLinkedinUrl(linkedinUrl);
      if (le) {
        res.status(400).json({ error: le });
        return;
      }
    }

    const updated = await prisma.organization.update({
      where: { slug },
      data: {
        ...(displayName !== undefined && { displayName: displayName?.trim() || org.displayName }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(avatarUrl !== undefined && { avatarUrl: avatarUrl?.trim() || null }),
        ...(websiteUrl !== undefined && { websiteUrl: websiteUrl?.trim() || null }),
        ...(linkedinUrl !== undefined && { linkedinUrl: linkedinUrl?.trim() || null }),
      },
    });
    res.json(updated);
  } catch (err) {
    console.error('[orgs/update]', err);
    res.status(500).json({ error: 'Failed to update organization.' });
  }
};

/**
 * DELETE /orgs/:slug
 * Delete an org. Requires owner role. Fails if org has published packages.
 */
export const deleteOrg = async (req: Request, res: Response): Promise<void> => {
  const user = req.user;
  if (!user) { res.status(401).json({ error: 'Authentication required.' }); return; }

  const { slug } = req.params;

  try {
    const org = await prisma.organization.findUnique({
      where: { slug },
      include: { _count: { select: { packages: true } } },
    });
    if (!org) { res.status(404).json({ error: 'Organization not found.' }); return; }

    const isOwner = await requireOrgRole(org.id, user.id, ['owner']);
    if (!isOwner) { res.status(403).json({ error: 'Only the org owner can delete the organization.' }); return; }

    if (org._count.packages > 0) {
      res.status(409).json({
        error: `Cannot delete "@${slug}": it owns ${org._count.packages} package(s). Transfer or delete them first.`,
      });
      return;
    }

    await prisma.organization.delete({ where: { slug } });
    res.status(204).send();
  } catch (err) {
    console.error('[orgs/delete]', err);
    res.status(500).json({ error: 'Failed to delete organization.' });
  }
};

/**
 * GET /orgs/:slug/members
 * List all members of an org.
 */
export const listOrgMembers = async (req: Request, res: Response): Promise<void> => {
  const { slug } = req.params;
  try {
    const org = await prisma.organization.findUnique({ where: { slug } });
    if (!org) { res.status(404).json({ error: 'Organization not found.' }); return; }

    const members = await prisma.orgMember.findMany({
      where: { orgId: org.id },
      orderBy: { joinedAt: 'asc' },
      include: { user: { select: { id: true, username: true, avatarUrl: true } } },
    });
    res.json(members);
  } catch (err) {
    console.error('[orgs/members/list]', err);
    res.status(500).json({ error: 'Failed to list members.' });
  }
};

/**
 * POST /orgs/:slug/members
 * Add a member to the org. Requires owner or admin role.
 * Body: { username: string, role?: "admin" | "member" }
 */
export const addOrgMember = async (req: Request, res: Response): Promise<void> => {
  const requestingUser = req.user;
  if (!requestingUser) { res.status(401).json({ error: 'Authentication required.' }); return; }

  const { slug } = req.params;
  const { username, role = 'member' } = req.body as { username?: string; role?: string };

  if (!username?.trim()) { res.status(400).json({ error: 'username is required.' }); return; }
  if (!['owner', 'admin', 'member'].includes(role)) {
    res.status(400).json({ error: 'role must be one of: owner, admin, member.' });
    return;
  }

  try {
    const org = await prisma.organization.findUnique({ where: { slug } });
    if (!org) { res.status(404).json({ error: 'Organization not found.' }); return; }

    const canManage = await requireOrgRole(org.id, requestingUser.id, ['owner', 'admin']);
    if (!canManage) {
      res.status(403).json({ error: 'Only org owners and admins can add members.' });
      return;
    }

    // Only owners can add other owners or admins
    if (role !== 'member') {
      const isOwner = await requireOrgRole(org.id, requestingUser.id, ['owner']);
      if (!isOwner) {
        res.status(403).json({ error: 'Only the org owner can assign the owner or admin role.' });
        return;
      }
    }

    const targetUser = await prisma.user.findUnique({ where: { username: username.trim() } });
    if (!targetUser) { res.status(404).json({ error: `User "${username}" not found.` }); return; }

    const existing = await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId: org.id, userId: targetUser.id } },
    });
    if (existing) {
      res.status(409).json({ error: `@${username} is already a member of this organization.` });
      return;
    }

    const member = await prisma.orgMember.create({
      data: { orgId: org.id, userId: targetUser.id, role },
      include: { user: { select: { id: true, username: true, avatarUrl: true } } },
    });
    res.status(201).json(member);
  } catch (err) {
    console.error('[orgs/members/add]', err);
    res.status(500).json({ error: 'Failed to add member.' });
  }
};

/**
 * PATCH /orgs/:slug/members/:username
 * Update a member's role. Requires owner.
 */
export const updateOrgMemberRole = async (req: Request, res: Response): Promise<void> => {
  const requestingUser = req.user;
  if (!requestingUser) { res.status(401).json({ error: 'Authentication required.' }); return; }

  const { slug, username } = req.params;
  const { role } = req.body as { role?: string };

  if (!role || !['owner', 'admin', 'member'].includes(role)) {
    res.status(400).json({ error: 'role must be one of: owner, admin, member.' });
    return;
  }

  try {
    const org = await prisma.organization.findUnique({ where: { slug } });
    if (!org) { res.status(404).json({ error: 'Organization not found.' }); return; }

    const isOwner = await requireOrgRole(org.id, requestingUser.id, ['owner']);
    if (!isOwner) {
      res.status(403).json({ error: 'Only the org owner can change member roles.' });
      return;
    }

    const targetUser = await prisma.user.findUnique({ where: { username } });
    if (!targetUser) { res.status(404).json({ error: `User "${username}" not found.` }); return; }

    const membership = await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId: org.id, userId: targetUser.id } },
    });
    if (!membership) {
      res.status(404).json({ error: `@${username} is not a member of this organization.` });
      return;
    }

    // Prevent demoting yourself if you're the only owner
    if (membership.userId === requestingUser.id && role !== 'owner') {
      const ownerCount = await prisma.orgMember.count({ where: { orgId: org.id, role: 'owner' } });
      if (ownerCount <= 1) {
        res.status(409).json({ error: 'Cannot demote the only owner. Assign another owner first.' });
        return;
      }
    }

    const updated = await prisma.orgMember.update({
      where: { orgId_userId: { orgId: org.id, userId: targetUser.id } },
      data: { role },
      include: { user: { select: { id: true, username: true, avatarUrl: true } } },
    });
    res.json(updated);
  } catch (err) {
    console.error('[orgs/members/update-role]', err);
    res.status(500).json({ error: 'Failed to update member role.' });
  }
};

/**
 * DELETE /orgs/:slug/members/:username
 * Remove a member. Owners/admins can remove others; anyone can remove themselves.
 */
export const removeOrgMember = async (req: Request, res: Response): Promise<void> => {
  const requestingUser = req.user;
  if (!requestingUser) { res.status(401).json({ error: 'Authentication required.' }); return; }

  const { slug, username } = req.params;

  try {
    const org = await prisma.organization.findUnique({ where: { slug } });
    if (!org) { res.status(404).json({ error: 'Organization not found.' }); return; }

    const targetUser = await prisma.user.findUnique({ where: { username } });
    if (!targetUser) { res.status(404).json({ error: `User "${username}" not found.` }); return; }

    const isSelf = targetUser.id === requestingUser.id;
    if (!isSelf) {
      const canManage = await requireOrgRole(org.id, requestingUser.id, ['owner', 'admin']);
      if (!canManage) {
        res.status(403).json({ error: 'Only org owners and admins can remove members.' });
        return;
      }
    }

    const membership = await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId: org.id, userId: targetUser.id } },
    });
    if (!membership) {
      res.status(404).json({ error: `@${username} is not a member of this organization.` });
      return;
    }

    // Prevent removing the last owner
    if (membership.role === 'owner') {
      const ownerCount = await prisma.orgMember.count({ where: { orgId: org.id, role: 'owner' } });
      if (ownerCount <= 1) {
        res.status(409).json({ error: 'Cannot remove the only owner. Assign another owner first.' });
        return;
      }
    }

    await prisma.orgMember.delete({
      where: { orgId_userId: { orgId: org.id, userId: targetUser.id } },
    });
    res.status(204).send();
  } catch (err) {
    console.error('[orgs/members/remove]', err);
    res.status(500).json({ error: 'Failed to remove member.' });
  }
};

/**
 * GET /auth/me/orgs
 * List organizations the authenticated user belongs to.
 */
export const getMyOrgs = async (req: Request, res: Response): Promise<void> => {
  const user = req.user;
  if (!user) { res.status(401).json({ error: 'Authentication required.' }); return; }

  try {
    const memberships = await prisma.orgMember.findMany({
      where: { userId: user.id },
      orderBy: { joinedAt: 'asc' },
      include: {
        org: {
          select: {
            id: true, slug: true, displayName: true, avatarUrl: true, linkedinUrl: true,
            _count: { select: { members: true, packages: true } },
          },
        },
      },
    });
    res.json(memberships.map((m) => ({ ...m.org, role: m.role, joinedAt: m.joinedAt })));
  } catch (err) {
    console.error('[orgs/my-orgs]', err);
    res.status(500).json({ error: 'Failed to retrieve your organizations.' });
  }
};
