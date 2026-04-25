import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requirePlatformAdmin } from '../middleware/requirePlatformAdmin';
import {
  getAdminHealth,
  listAdminUsers,
  listAdminPackages,
  patchAdminPackage,
  postAdminVerifyUserEmail,
} from '../controllers/platformAdminController';

const router = Router();

router.get('/health', requireAuth, requirePlatformAdmin, getAdminHealth);
router.get('/users', requireAuth, requirePlatformAdmin, listAdminUsers);
router.get('/packages', requireAuth, requirePlatformAdmin, listAdminPackages);
router.patch('/packages', requireAuth, requirePlatformAdmin, patchAdminPackage);
router.post('/users/:id/verify-email', requireAuth, requirePlatformAdmin, postAdminVerifyUserEmail);

export default router;
