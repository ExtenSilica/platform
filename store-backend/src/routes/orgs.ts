import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  createOrg,
  getOrg,
  listOrgs,
  updateOrg,
  deleteOrg,
  listOrgMembers,
  addOrgMember,
  updateOrgMemberRole,
  removeOrgMember,
  getMyOrgs,
} from '../controllers/orgsController';

const router = Router();

/* ─── Authenticated user shortcut ───────────────────────────────────────── */

// GET /orgs/me  →  orgs the signed-in user belongs to
router.get('/me', requireAuth, getMyOrgs);

/* ─── Public read ───────────────────────────────────────────────────────── */

router.get('/', listOrgs);
router.get('/:slug', getOrg);
router.get('/:slug/members', listOrgMembers);

/* ─── Authenticated write ───────────────────────────────────────────────── */

router.post('/', requireAuth, createOrg);
router.patch('/:slug', requireAuth, updateOrg);
router.delete('/:slug', requireAuth, deleteOrg);

/* ─── Membership management ─────────────────────────────────────────────── */

router.post('/:slug/members', requireAuth, addOrgMember);
router.patch('/:slug/members/:username', requireAuth, updateOrgMemberRole);
router.delete('/:slug/members/:username', requireAuth, removeOrgMember);

export default router;
