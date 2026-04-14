import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { submitDmca } from '../controllers/legalController';

const router = Router();

// Rate-limit DMCA submissions — 5 per hour per IP to deter spam.
const dmcaLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many takedown submissions from this IP. Please try again later.' },
});

// POST /legal/dmca
router.post('/dmca', dmcaLimiter, submitDmca);

export default router;
