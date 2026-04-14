import { Router } from 'express';
import { getPackageStats, triggerWeeklyRefresh } from '../controllers/statsController';

const router = Router();

router.get('/packages/:name', getPackageStats);

// POST /stats/refresh — manually trigger weeklyDownloads recomputation (auth required)
router.post('/refresh', triggerWeeklyRefresh);

export default router;
