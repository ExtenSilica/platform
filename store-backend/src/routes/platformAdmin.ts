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

export default router;
