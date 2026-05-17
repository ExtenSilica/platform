import { Router } from 'express';
import { getUserContributions, getUserProfile } from '../controllers/usersController';

const router = Router();

// GET /users/:username/contributions — public coordination history (before /:username)
router.get('/:username/contributions', getUserContributions);

// GET /users/:username — public profile (no auth required)
router.get('/:username', getUserProfile);

export default router;
