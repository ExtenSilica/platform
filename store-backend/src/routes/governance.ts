import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  getGovernancePublic,
  getGovernanceMeHandler,
} from '../controllers/governanceController';

const router = Router();

router.get('/', getGovernancePublic);
router.get('/me', requireAuth, getGovernanceMeHandler);

export default router;
