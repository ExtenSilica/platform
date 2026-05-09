import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { generate } from '../controllers/wizardController';

const router = Router();

// Rate-limit skeleton generation — 30 per 10 min per IP. The endpoint is public;
// this is enough headroom for a real user iterating in the wizard, but caps abuse.
const wizardLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many wizard requests from this IP. Please try again later.' },
});

// POST /wizard/generate — body: WizardInput; response: application/gzip (.xsil)
router.post('/generate', wizardLimiter, generate);

export default router;
