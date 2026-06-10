import { Router } from 'express';
import {
  getCollisionGraph,
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

// GET /api/graph/collisions — aggregate graph for the /compatibility page
// (cached in-memory for 5 minutes; ~50 KB payload for ~100 extensions).
router.get('/graph/collisions', getCollisionGraph);

export default router;
