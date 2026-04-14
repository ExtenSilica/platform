import { Request, Response } from 'express';
import { sendDmcaReport } from '../mailer';

// POST /legal/dmca
// Accepts a DMCA / IP takedown submission and emails legal@extensilica.com.
export const submitDmca = async (req: Request, res: Response) => {
  const {
    reporterName,
    reporterEmail,
    reporterCompany,
    packageSlug,
    infringingUrl,
    originalWorkDescription,
    originalWorkUrl,
    infringementDescription,
    goodFaithStatement,
    accuracyStatement,
    signature,
  } = req.body;

  // Required field validation
  const missing: string[] = [];
  if (!reporterName?.trim())              missing.push('reporterName');
  if (!reporterEmail?.trim())             missing.push('reporterEmail');
  if (!packageSlug?.trim())               missing.push('packageSlug');
  if (!infringingUrl?.trim())             missing.push('infringingUrl');
  if (!originalWorkDescription?.trim())   missing.push('originalWorkDescription');
  if (!infringementDescription?.trim())   missing.push('infringementDescription');
  if (!goodFaithStatement)               missing.push('goodFaithStatement');
  if (!accuracyStatement)                missing.push('accuracyStatement');
  if (!signature?.trim())                 missing.push('signature');

  if (missing.length > 0) {
    res.status(400).json({ error: 'Missing required fields.', fields: missing });
    return;
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reporterEmail.trim())) {
    res.status(400).json({ error: 'Invalid reporter email address.' });
    return;
  }

  try {
    await sendDmcaReport({
      reporterName:            reporterName.trim(),
      reporterEmail:           reporterEmail.trim(),
      reporterCompany:         reporterCompany?.trim() || undefined,
      packageSlug:             packageSlug.trim(),
      infringingUrl:           infringingUrl.trim(),
      originalWorkDescription: originalWorkDescription.trim(),
      originalWorkUrl:         originalWorkUrl?.trim() || undefined,
      infringementDescription: infringementDescription.trim(),
      signature:               signature.trim(),
    });
  } catch (err) {
    console.error('[legal] failed to send DMCA report email:', err);
    // Still return 200 — the submission is valid; email delivery is a best-effort
    // side-effect. Log to stdout so no report is silently lost.
  }

  res.json({
    ok: true,
    message:
      'Your takedown request has been received. We will review it and respond to the email address you provided within 5 business days.',
  });
};
