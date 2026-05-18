import { Router } from 'express';
import {
  getAdoptionStats,
  getCatalogStats,
  getPackageStats,
  triggerWeeklyRefresh,
} from '../controllers/statsController';

const router = Router();

router.get('/packages/:name', getPackageStats);

// GET /stats/catalog — aggregated counts grouped by `standardStatus` (public).
router.get('/catalog', getCatalogStats);

// GET /stats/adoption — registry-wide view/download time series (PR-G1)
router.get('/adoption', getAdoptionStats);

// POST /stats/refresh — manually trigger weeklyDownloads recomputation (auth required)
router.post('/refresh', triggerWeeklyRefresh);

export default router;
