import { Router } from 'express';
import { listTargets } from '../controllers/targetsController';

const router = Router();

router.get('/', listTargets);

export default router;
