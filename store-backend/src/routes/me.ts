import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  listMyRequests,
  withdrawMyRequest,
} from '../controllers/ownershipRequestsController';
import {
  listMyImplementationRequests,
  listMyImplementationSubmissions,
} from '../controllers/implementationRequestsController';

const router = Router();

/* ─── Ownership requests submitted by the current user ─────────────────────
 * GET  /me/ownership-requests              — list, optional ?status= filter
 * POST /me/ownership-requests/:id/withdraw — withdraw a still-pending request
 */
router.get('/ownership-requests', requireAuth, listMyRequests);
router.post(
  '/ownership-requests/:id/withdraw',
  requireAuth,
  withdrawMyRequest,
);

router.get('/implementation-requests', requireAuth, listMyImplementationRequests);
router.get('/implementation-submissions', requireAuth, listMyImplementationSubmissions);

export default router;
