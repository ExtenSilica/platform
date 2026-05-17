import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  listImplementationRequests,
  getImplementationRequest,
  patchImplementationRequest,
  createImplementationInterest,
  createImplementationMilestone,
  patchImplementationMilestone,
  createImplementationSubmission,
} from '../controllers/implementationRequestsController';

const router = Router();

router.get('/', listImplementationRequests);
router.get('/:id', getImplementationRequest);
router.patch('/:id', requireAuth, patchImplementationRequest);

router.post('/:id/interests', requireAuth, createImplementationInterest);
router.post('/:id/milestones', requireAuth, createImplementationMilestone);
router.patch('/:id/milestones/:mid', requireAuth, patchImplementationMilestone);
router.post('/:id/submissions', requireAuth, createImplementationSubmission);

export default router;
