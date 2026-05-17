import nodemailer from 'nodemailer';
import { emailBrandHeaderCell, getEmailLogoAttachments } from './mailerBranding';

const {
  SMTP_HOST = 'smtp.zoho.com',
  SMTP_PORT = '587',
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
  SITE_URL = 'https://extensilica.com',
} = process.env;

function buildTransport() {
  if (!SMTP_USER || !SMTP_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

const transport = buildTransport();
const FROM = SMTP_FROM ?? `ExtenSilica <${SMTP_USER ?? 'noreply@extensilica.com'}>`;

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type ImplementationRecipient = {
  toEmail: string;
  toUsername: string;
};

export type NewSubmissionEmailInput = ImplementationRecipient & {
  requestTitle: string;
  requestId: number;
  packageSlug: string;
  packageName: string;
  submitterUsername: string;
  summaryPreview: string;
};

export type VerificationFailedEmailInput = ImplementationRecipient & {
  requestTitle: string;
  requestId: number;
  packageSlug: string;
  packageName: string;
  verifierUsername: string;
  notes?: string | null;
  logUrl?: string | null;
};

export async function sendNewSubmissionEmail(input: NewSubmissionEmailInput): Promise<void> {
  const {
    toEmail,
    toUsername,
    requestTitle,
    requestId,
    packageSlug,
    packageName,
    submitterUsername,
    summaryPreview,
  } = input;

  const requestUrl = `${SITE_URL}/requests/${requestId}`;
  const packageUrl = `${SITE_URL}/package/${encodeURIComponent(packageSlug)}`;
  const subject = `New submission — ${requestTitle}`;

  const text = [
    `Hi ${toUsername},`,
    '',
    `@${submitterUsername} submitted work for the implementation request "${requestTitle}" on ${packageName} (${packageSlug}).`,
    '',
    `Summary preview:\n${summaryPreview}`,
    '',
    `View request: ${requestUrl}`,
    `Package: ${packageUrl}`,
    '',
    '— ExtenSilica',
  ].join('\n');

  const logoAtt = await getEmailLogoAttachments();
  const showLogo = logoAtt.length > 0;

  const html = buildHtmlEmail({
    showLogo,
    headline: 'New implementation submission',
    greeting: toUsername,
    body: `
      <p style="margin:0 0 16px;color:#374151;line-height:1.6">
        <strong>@${escapeHtml(submitterUsername)}</strong> submitted work for
        <strong>${escapeHtml(requestTitle)}</strong> on
        <strong>${escapeHtml(packageName)}</strong>
        (<code>${escapeHtml(packageSlug)}</code>).
      </p>
      <p style="margin:0 0 16px;padding:12px 16px;background:#f9fafb;border-radius:6px;
         font-size:14px;color:#374151;line-height:1.6">
        ${escapeHtml(summaryPreview).replace(/\n/g, '<br>')}
      </p>
    `,
    primaryUrl: requestUrl,
    primaryLabel: 'Review request',
    secondaryUrl: packageUrl,
    secondaryLabel: 'View package',
  });

  await deliver({ toEmail, subject, text, html, logoAtt });
}

export async function sendVerificationFailedEmail(
  input: VerificationFailedEmailInput,
): Promise<void> {
  const {
    toEmail,
    toUsername,
    requestTitle,
    requestId,
    packageSlug,
    packageName,
    verifierUsername,
    notes,
    logUrl,
  } = input;

  const requestUrl = `${SITE_URL}/requests/${requestId}`;
  const subject = `Verification did not pass — ${requestTitle}`;

  const noteBlock = notes?.trim()
    ? `\n\nReviewer note:\n${notes.trim()}`
    : '';
  const logBlock = logUrl?.trim() ? `\n\nLog / CI URL:\n${logUrl.trim()}` : '';

  const text = [
    `Hi ${toUsername},`,
    '',
    `Your submission for "${requestTitle}" on ${packageName} (${packageSlug}) was reviewed by @${verifierUsername} and did not pass verification.`,
    noteBlock,
    logBlock,
    '',
    `View request: ${requestUrl}`,
    '',
    'You may submit an updated deliverable when the request is open for work.',
    '',
    '— ExtenSilica',
  ].join('\n');

  const logoAtt = await getEmailLogoAttachments();
  const showLogo = logoAtt.length > 0;

  const noteHtml = notes?.trim()
    ? `<p style="margin:16px 0;padding:12px 16px;background:#fef2f2;border-radius:6px;
         font-size:14px;color:#374151;line-height:1.6">
         <strong>Note from @${escapeHtml(verifierUsername)}:</strong><br>
         ${escapeHtml(notes.trim()).replace(/\n/g, '<br>')}
       </p>`
    : '';

  const logHtml = logUrl?.trim()
    ? `<p style="margin:0 0 16px;font-size:13px;color:#6b7280;word-break:break-all">
         Log: <a href="${escapeHtml(logUrl.trim())}">${escapeHtml(logUrl.trim())}</a>
       </p>`
    : '';

  const html = buildHtmlEmail({
    showLogo,
    headline: 'Verification did not pass',
    greeting: toUsername,
    body: `
      <p style="margin:0 0 16px;color:#374151;line-height:1.6">
        Your submission for <strong>${escapeHtml(requestTitle)}</strong> on
        <strong>${escapeHtml(packageName)}</strong> was reviewed by
        <strong>@${escapeHtml(verifierUsername)}</strong> and
        <strong>did not pass</strong> verification.
      </p>
      ${noteHtml}
      ${logHtml}
      <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6">
        You may submit an updated deliverable when the request accepts new work.
      </p>
    `,
    primaryUrl: requestUrl,
    primaryLabel: 'View request',
  });

  await deliver({ toEmail, subject, text, html, logoAtt });
}

function buildHtmlEmail(opts: {
  showLogo: boolean;
  headline: string;
  greeting: string;
  body: string;
  primaryUrl: string;
  primaryLabel: string;
  secondaryUrl?: string;
  secondaryLabel?: string;
}): string {
  const secondary =
    opts.secondaryUrl && opts.secondaryLabel
      ? `<a href="${opts.secondaryUrl}"
           style="display:inline-block;border:1px solid #d1d5db;color:#111827;
                  padding:12px 24px;border-radius:6px;font-weight:600;
                  font-size:14px;text-decoration:none;margin-left:8px">
           ${escapeHtml(opts.secondaryLabel)}
         </a>`
      : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>${escapeHtml(opts.headline)}</title></head>
<body style="font-family:sans-serif;background:#f9fafb;margin:0;padding:0">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:40px">
        ${emailBrandHeaderCell(undefined, { showRasterLogo: opts.showLogo })}
        <tr>
          <td style="padding-top:28px">
            <h1 style="margin:0 0 8px;font-size:22px;color:#111827">${escapeHtml(opts.headline)}</h1>
            <p style="margin:0 0 20px;color:#374151;line-height:1.6">
              Hi <strong>${escapeHtml(opts.greeting)}</strong>,
            </p>
            ${opts.body}
            <p style="margin:24px 0 0">
              <a href="${opts.primaryUrl}"
                 style="display:inline-block;background:#111827;color:#fff;
                        padding:12px 24px;border-radius:6px;font-weight:600;
                        font-size:14px;text-decoration:none">
                ${escapeHtml(opts.primaryLabel)}
              </a>
              ${secondary}
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding-top:28px;border-top:1px solid #f3f4f6;font-size:12px;color:#9ca3af">
            &copy; ${new Date().getFullYear()} ExtenSilica &mdash;
            <a href="${SITE_URL}" style="color:#9ca3af">extensilica.com</a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
}

async function deliver(opts: {
  toEmail: string;
  subject: string;
  text: string;
  html: string;
  logoAtt: Awaited<ReturnType<typeof getEmailLogoAttachments>>;
}): Promise<void> {
  if (!transport) {
    console.log('[mailer/implementation] Would send email:');
    console.log(`  To:      ${opts.toEmail}`);
    console.log(`  Subject: ${opts.subject}`);
    console.log(opts.text);
    return;
  }

  await transport.sendMail({
    from: FROM,
    to: opts.toEmail,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    attachments: opts.logoAtt,
  });
}
