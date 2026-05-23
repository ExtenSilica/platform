import nodemailer from 'nodemailer';
import { emailBrandHeaderCell, getEmailLogoAttachments } from './mailerBranding';
import { XSIL_LEGAL_DISCLAIMER, XSIL_LEGAL_DISCLAIMER_LINES } from './lib/xsilDisclaimer';
import { LEGAL_EMAIL } from './lib/siteContact';

/**
 * Zoho Mail SMTP transport for extensilica.com.
 *
 * Required environment variables:
 *   SMTP_USER   — e.g. noreply@extensilica.com
 *   SMTP_PASS   — app-specific password from Zoho Mail settings
 *   SITE_URL    — e.g. https://extensilica.com  (no trailing slash)
 *
 * Optional:
 *   SMTP_FROM   — display name + address, defaults to
 *                 "ExtenSilica <noreply@extensilica.com>"
 *   SMTP_HOST   — defaults to smtp.zoho.com
 *   SMTP_PORT   — defaults to 587
 */

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
    console.warn(
      '[mailer] SMTP_USER / SMTP_PASS not set — emails will be logged to stdout instead of sent.',
    );
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

export interface DmcaReport {
  reporterName: string;
  reporterEmail: string;
  reporterCompany?: string;
  packageSlug: string;
  infringingUrl: string;
  originalWorkDescription: string;
  originalWorkUrl?: string;
  infringementDescription: string;
  signature: string;
}

export async function sendDmcaReport(report: DmcaReport): Promise<void> {
  const rows = [
    ['Reporter name',        report.reporterName],
    ['Reporter email',       report.reporterEmail],
    ['Reporter company',     report.reporterCompany ?? '(not provided)'],
    ['Package',              report.packageSlug],
    ['Infringing URL',       report.infringingUrl],
    ['Original work',        report.originalWorkDescription],
    ['Original work URL',    report.originalWorkUrl ?? '(not provided)'],
    ['Infringement details', report.infringementDescription],
    ['Electronic signature', report.signature],
  ];

  const text = [
    'DMCA / IP Takedown Request',
    '===========================',
    '',
    ...rows.map(([k, v]) => `${k}:\n  ${v}`),
    '',
    'Submitted via extensilica.com at ' + new Date().toISOString(),
  ].join('\n');

  const logoAtt = await getEmailLogoAttachments();
  const showLogo = logoAtt.length > 0;

  const html = `
<!DOCTYPE html><html lang="en">
<head><meta charset="utf-8"><title>DMCA Takedown Request</title></head>
<body style="font-family:sans-serif;background:#f9fafb;margin:0;padding:40px 0">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:36px">
        ${emailBrandHeaderCell(
          '<span style="color:#dc2626;font-weight:600">DMCA / IP Takedown Request</span>',
          { showRasterLogo: showLogo },
        )}
        <tr><td style="padding-top:24px">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${rows.map(([k, v]) => `
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;width:180px;
                         font-size:12px;font-weight:600;color:#374151;vertical-align:top">
                ${k}
              </td>
              <td style="padding:8px 0 8px 12px;border-bottom:1px solid #f3f4f6;
                         font-size:13px;color:#6b7280;word-break:break-word">
                ${v}
              </td>
            </tr>`).join('')}
          </table>
          <p style="margin:24px 0 0;font-size:11px;color:#9ca3af">
            Submitted at ${new Date().toISOString()} via extensilica.com
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`.trim();

  if (!transport) {
    console.log(`[mailer] Would send DMCA report to ${LEGAL_EMAIL}`);
    console.log(text);
    return;
  }

  await transport.sendMail({
    from: FROM,
    to: LEGAL_EMAIL,
    replyTo: report.reporterEmail,
    subject: `DMCA Takedown Request — ${report.packageSlug}`,
    text,
    html,
    attachments: logoAtt,
  });
}

export async function sendPasswordResetEmail(
  toEmail: string,
  toUsername: string,
  rawToken: string,
): Promise<void> {
  const resetUrl = `${SITE_URL}/reset-password?token=${rawToken}`;

  const logoAtt = await getEmailLogoAttachments();
  const showLogo = logoAtt.length > 0;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Reset your password</title></head>
<body style="font-family:sans-serif;background:#f9fafb;margin:0;padding:0">
  <table width="100%" cellpadding="0" cellspacing="0"
         style="background:#f9fafb;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:40px">
        ${emailBrandHeaderCell(undefined, { showRasterLogo: showLogo })}
        <tr>
          <td style="padding-top:28px">
            <h1 style="margin:0 0 8px;font-size:22px;color:#111827">
              Reset your password
            </h1>
            <p style="margin:0 0 20px;color:#374151;line-height:1.6">
              Hi <strong>${toUsername}</strong>,
            </p>
            <p style="margin:0 0 20px;color:#374151;line-height:1.6">
              We received a request to reset the password for your ExtenSilica
              account. Click the button below to choose a new password.
              This link expires in <strong>1 hour</strong>.
            </p>
            <p style="margin:0 0 28px">
              <a href="${resetUrl}"
                 style="display:inline-block;background:#111827;color:#fff;
                        padding:12px 24px;border-radius:6px;font-weight:600;
                        font-size:14px;text-decoration:none">
                Reset password
              </a>
            </p>
            <p style="margin:0 0 12px;color:#6b7280;font-size:13px">
              Or copy and paste this URL into your browser:
            </p>
            <p style="margin:0 0 28px;font-size:12px;color:#6b7280;
                      word-break:break-all">
              ${resetUrl}
            </p>
            <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6">
              If you did not request a password reset, you can safely ignore
              this email. Your password will not change.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding-top:28px;border-top:1px solid #f3f4f6;
                     font-size:12px;color:#9ca3af">
            &copy; ${new Date().getFullYear()} ExtenSilica &mdash;
            <a href="${SITE_URL}" style="color:#9ca3af">extensilica.com</a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

  const text = [
    `Hi ${toUsername},`,
    '',
    'We received a request to reset your ExtenSilica password.',
    'Click the link below to set a new password (expires in 1 hour):',
    '',
    resetUrl,
    '',
    'If you did not request this, you can ignore this email.',
    '',
    '— ExtenSilica',
  ].join('\n');

  if (!transport) {
    console.log('[mailer] Would send password-reset email:');
    console.log(`  To:      ${toEmail}`);
    console.log(`  Subject: Reset your ExtenSilica password`);
    console.log(`  Link:    ${resetUrl}`);
    return;
  }

  await transport.sendMail({
    from: FROM,
    to: toEmail,
    subject: 'Reset your ExtenSilica password',
    text,
    html,
    attachments: logoAtt,
  });
}

const VERIFY_TOKEN_TTL_HOURS = 24;

export async function sendVerifyEmailAddress(
  toEmail: string,
  toUsername: string,
  rawToken: string,
): Promise<void> {
  const verifyUrl = `${SITE_URL}/auth/verify-email?token=${encodeURIComponent(rawToken)}`;

  const logoAtt = await getEmailLogoAttachments();
  const showLogo = logoAtt.length > 0;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Verify your email</title></head>
<body style="font-family:sans-serif;background:#f9fafb;margin:0;padding:0">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:40px">
        ${emailBrandHeaderCell(undefined, { showRasterLogo: showLogo })}
        <tr>
          <td style="padding-top:28px">
            <h1 style="margin:0 0 8px;font-size:22px;color:#111827">Verify your email</h1>
            <p style="margin:0 0 20px;color:#374151;line-height:1.6">
              Hi <strong>${toUsername}</strong>,
            </p>
            <p style="margin:0 0 20px;color:#374151;line-height:1.6">
              Confirm this address to activate your ExtenSilica account and sign in.
              This link expires in <strong>${VERIFY_TOKEN_TTL_HOURS} hours</strong>.
            </p>
            <p style="margin:0 0 28px">
              <a href="${verifyUrl}"
                 style="display:inline-block;background:#111827;color:#fff;
                        padding:12px 24px;border-radius:6px;font-weight:600;
                        font-size:14px;text-decoration:none">
                Verify email
              </a>
            </p>
            <p style="margin:0 0 12px;color:#6b7280;font-size:13px">
              Or copy and paste this URL into your browser:
            </p>
            <p style="margin:0 0 28px;font-size:12px;color:#6b7280;word-break:break-all">
              ${verifyUrl}
            </p>
            <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6">
              If you did not create an account, you can ignore this email.
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

  const text = [
    `Hi ${toUsername},`,
    '',
    'Please verify your email for ExtenSilica by opening this link (expires in 24 hours):',
    '',
    verifyUrl,
    '',
    'If you did not register, ignore this email.',
    '',
    '— ExtenSilica',
  ].join('\n');

  if (!transport) {
    console.log('[mailer] Would send verify-email:');
    console.log(`  To:   ${toEmail}`);
    console.log(`  Link: ${verifyUrl}`);
    return;
  }

  await transport.sendMail({
    from: FROM,
    to: toEmail,
    subject: 'Verify your ExtenSilica email',
    text,
    html,
    attachments: logoAtt,
  });
}

export type TokenGrantEmailParams = {
  toEmail: string;
  toUsername: string;
  amount: number;
  reasonLabel: string;
  referenceId: string;
  status: 'APPROVED' | 'PENDING';
};

export async function sendTokenGrantNotificationEmail(
  params: TokenGrantEmailParams,
): Promise<void> {
  const { toEmail, toUsername, amount, reasonLabel, referenceId, status } = params;
  const tokenUrl = `${SITE_URL}/token`;
  const dashboardUrl = `${SITE_URL}/dashboard`;
  const statusLine =
    status === 'APPROVED'
      ? 'Your grant is approved and added to your pending XSIL balance. Connect a wallet on the token page when you are ready to claim on-chain.'
      : 'Your grant is recorded and pending platform review.';

  const disclaimerHtml = XSIL_LEGAL_DISCLAIMER_LINES.map(
    (line) => `<li style="margin:0 0 6px">${line}</li>`,
  ).join('');

  const logoAtt = await getEmailLogoAttachments();
  const showLogo = logoAtt.length > 0;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>XSIL grant notification</title></head>
<body style="font-family:sans-serif;background:#f9fafb;margin:0;padding:0">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:40px">
        ${emailBrandHeaderCell(undefined, { showRasterLogo: showLogo })}
        <tr>
          <td style="padding-top:28px">
            <h1 style="margin:0 0 8px;font-size:22px;color:#111827">XSIL grant recorded</h1>
            <p style="margin:0 0 16px;color:#374151;line-height:1.6">
              Hi <strong>${toUsername}</strong>,
            </p>
            <p style="margin:0 0 16px;color:#374151;line-height:1.6">
              ExtenSilica recorded a contribution grant of <strong>${amount} XSIL</strong>
              for <em>${reasonLabel}</em> (${referenceId}).
            </p>
            <p style="margin:0 0 20px;color:#374151;line-height:1.6">${statusLine}</p>
            <p style="margin:0 0 12px">
              <a href="${dashboardUrl}"
                 style="display:inline-block;background:#111827;color:#fff;
                        padding:10px 18px;border-radius:6px;font-weight:600;
                        font-size:14px;text-decoration:none;margin-right:8px">
                View dashboard
              </a>
              <a href="${tokenUrl}"
                 style="display:inline-block;border:1px solid #d1d5db;color:#111827;
                        padding:10px 18px;border-radius:6px;font-weight:600;
                        font-size:14px;text-decoration:none">
                Token page
              </a>
            </p>
            <div style="margin:24px 0 0;padding:16px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px">
              <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#92400e;text-transform:uppercase;letter-spacing:0.05em">
                Legal notice
              </p>
              <ul style="margin:0;padding-left:18px;font-size:12px;color:#78350f;line-height:1.5">
                ${disclaimerHtml}
              </ul>
            </div>
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

  const text = [
    `Hi ${toUsername},`,
    '',
    `ExtenSilica recorded a contribution grant of ${amount} XSIL for ${reasonLabel} (${referenceId}).`,
    statusLine,
    '',
    `Dashboard: ${dashboardUrl}`,
    `Token: ${tokenUrl}`,
    '',
    'Legal notice:',
    ...XSIL_LEGAL_DISCLAIMER_LINES.map((line) => `- ${line}`),
    '',
    XSIL_LEGAL_DISCLAIMER,
    '',
    '— ExtenSilica',
  ].join('\n');

  if (!transport) {
    console.log('[mailer] Would send XSIL grant notification:');
    console.log(`  To:     ${toEmail}`);
    console.log(`  Amount: ${amount} XSIL — ${reasonLabel}`);
    return;
  }

  await transport.sendMail({
    from: FROM,
    to: toEmail,
    subject: `XSIL grant: +${amount} for ${reasonLabel}`,
    text,
    html,
    attachments: logoAtt,
  });
}
