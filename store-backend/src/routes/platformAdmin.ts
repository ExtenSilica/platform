import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requirePlatformAdmin } from '../middleware/requirePlatformAdmin';
import {
  getAdminHealth,
  listAdminUsers,
  listAdminPackages,
  patchAdminPackage,
  patchAdminUser,
  postAdminCreateUser,
  postAdminResetUserPassword,
  deleteAdminUser,
  postAdminVerifyUserEmail,
  postAdminCreatePackage,
  patchAdminPackageBySlug,
  deleteAdminPackage,
} from '../controllers/platformAdminController';
import {
  adminListRequests,
  adminApproveRequest,
  adminRejectRequest,
} from '../controllers/ownershipRequestsController';
import {
  adminListImplementationRequests,
  adminCancelImplementationRequest,
} from '../controllers/implementationRequestsController';
import {
  adminListExternalCitations,
  adminCreateExternalCitation,
  adminDeleteExternalCitation,
} from '../controllers/externalCitationsController';
import {
  adminApproveTokenGrant,
  adminCreateManualTokenGrant,
  adminListTokenGrants,
  adminRejectTokenGrant,
} from '../controllers/adminTokenGrantsController';

const router = Router();

router.get('/health', requireAuth, requirePlatformAdmin, getAdminHealth);
router.get('/users', requireAuth, requirePlatformAdmin, listAdminUsers);
router.post('/users', requireAuth, requirePlatformAdmin, postAdminCreateUser);
router.patch('/users/:id', requireAuth, requirePlatformAdmin, patchAdminUser);
router.post('/users/:id/reset-password', requireAuth, requirePlatformAdmin, postAdminResetUserPassword);
router.delete('/users/:id', requireAuth, requirePlatformAdmin, deleteAdminUser);
router.get('/packages', requireAuth, requirePlatformAdmin, listAdminPackages);
router.patch('/packages', requireAuth, requirePlatformAdmin, patchAdminPackage);
router.post('/packages', requireAuth, requirePlatformAdmin, postAdminCreatePackage);
router.patch('/packages/:slug', requireAuth, requirePlatformAdmin, patchAdminPackageBySlug);
router.delete('/packages/:slug', requireAuth, requirePlatformAdmin, deleteAdminPackage);
router.post('/users/:id/verify-email', requireAuth, requirePlatformAdmin, postAdminVerifyUserEmail);

// ── Ownership-request review queue ───────────────────────────────────────────
router.get('/ownership-requests', requireAuth, requirePlatformAdmin, adminListRequests);
router.post('/ownership-requests/:id/approve', requireAuth, requirePlatformAdmin, adminApproveRequest);
router.post('/ownership-requests/:id/reject',  requireAuth, requirePlatformAdmin, adminRejectRequest);

router.get(
  '/implementation-requests',
  requireAuth,
  requirePlatformAdmin,
  adminListImplementationRequests,
);
router.post(
  '/implementation-requests/:id/cancel',
  requireAuth,
  requirePlatformAdmin,
  adminCancelImplementationRequest,
);

// ── External citations (PR-G2) ───────────────────────────────────────────────
router.get('/citations', requireAuth, requirePlatformAdmin, adminListExternalCitations);
router.post('/citations', requireAuth, requirePlatformAdmin, adminCreateExternalCitation);
router.delete('/citations/:id', requireAuth, requirePlatformAdmin, adminDeleteExternalCitation);

router.get('/token-grants', requireAuth, requirePlatformAdmin, adminListTokenGrants);
router.post('/token-grants/manual', requireAuth, requirePlatformAdmin, adminCreateManualTokenGrant);
router.post('/token-grants/:id/approve', requireAuth, requirePlatformAdmin, adminApproveTokenGrant);
router.post('/token-grants/:id/reject', requireAuth, requirePlatformAdmin, adminRejectTokenGrant);

export default router;
