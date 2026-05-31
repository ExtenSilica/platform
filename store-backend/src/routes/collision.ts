import { Router } from 'express';
import {
  getExtensionConflicts,
  postCheckOpcode,
  postResolve,
} from '../controllers/collisionController';

const router = Router();

// Contract shared with CLI:
// GET /api/package/:id/conflicts
router.get('/package/:id/conflicts', getExtensionConflicts);

// POST /api/opcodes/check
router.post('/opcodes/check', postCheckOpcode);

// POST /api/resolve
router.post('/resolve', postResolve);

export default router;
