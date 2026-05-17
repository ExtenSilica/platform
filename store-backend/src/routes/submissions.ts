import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  patchImplementationSubmission,
  createVerificationRun,
} from '../controllers/implementationRequestsController';

const router = Router();

router.patch('/:id', requireAuth, patchImplementationSubmission);
router.post('/:id/verification-runs', requireAuth, createVerificationRun);

export default router;
