import { Router } from 'express';
import { getUserProfile } from '../controllers/usersController';

const router = Router();

// GET /users/:username — public profile (no auth required)
router.get('/:username', getUserProfile);

export default router;
