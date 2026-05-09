import { Request, Response } from 'express';
import { generateXsilSkeleton, WizardInput, WizardInputError } from '../lib/wizardGenerate';

/**
 * POST /wizard/generate
 * Public — produces a downloadable `.xsil` skeleton from form input.
 *
 * Body: WizardInput JSON. See `wizardGenerate.ts` for the schema.
 * Response on success: `application/gzip` body with the .xsil bytes.
 */
export const generate = async (req: Request, res: Response): Promise<void> => {
  let result;
  try {
    result = await generateXsilSkeleton(req.body as WizardInput);
  } catch (err) {
    if (err instanceof WizardInputError) {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error('[wizard/generate]', err);
    res.status(500).json({ error: 'Failed to generate .xsil skeleton.' });
    return;
  }

  res.setHeader('Content-Type', 'application/gzip');
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  res.setHeader('X-Xsil-Slug', result.slug);
  res.setHeader('X-Xsil-Version', result.version);
  res.setHeader('X-Xsil-Payload-Checksum', result.payloadChecksum);
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).end(result.buffer);
};
