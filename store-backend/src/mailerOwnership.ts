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

export type OwnershipDecisionEmailInput = {
  toEmail: string;
  toUsername: string;
  packageSlug: string;
  packageName: string;
  approved: boolean;
  decisionNote?: string | null;
  claimantOrg?: { slug: string; displayName: string } | null;
};

export async function sendOwnershipDecisionEmail(
  input: OwnershipDecisionEmailInput,
): Promise<void> {
  const {
    toEmail,
    toUsername,
    packageSlug,
    packageName,
    approved,
    decisionNote,
    claimantOrg,
  } = input;

  const packageUrl = `${SITE_URL}/package/${encodeURIComponent(packageSlug)}`;
  const dashboardUrl = `${SITE_URL}/dashboard?tab=requests`;
  const statusLabel = approved ? 'approved' : 'not approved';
  const subject = approved
    ? `Ownership approved — ${packageSlug}`
    : `Ownership request update — ${packageSlug}`;

  const orgLine = claimantOrg
    ? `Organization: @${claimantOrg.slug} (${claimantOrg.displayName})`
    : null;

  const noteBlock = decisionNote?.trim()
    ? `\n\nNote from the reviewer:\n${decisionNote.trim()}`
    : '';

  const text = [
    `Hi ${toUsername},`,
    '',
    approved
      ? `Your ownership request for "${packageName}" (${packageSlug}) was approved.`
      : `Your ownership request for "${packageName}" (${packageSlug}) was not approved.`,
    orgLine ?? '',
    noteBlock,
    '',
    `Package: ${packageUrl}`,
    `Track requests: ${dashboardUrl}`,
    '',
    '— ExtenSilica',
  ]
    .filter((line) => line !== '')
    .join('\n');

  const logoAtt = await getEmailLogoAttachments();
  const showLogo = logoAtt.length > 0;

  const headline = approved ? 'Ownership request approved' : 'Ownership request declined';
  const lead = approved
    ? `Your request to own <strong>${escapeHtml(packageName)}</strong> (<code>${escapeHtml(packageSlug)}</code>) was <strong>approved</strong>. You are now listed as the package owner.`
    : `Your request to own <strong>${escapeHtml(packageName)}</strong> (<code>${escapeHtml(packageSlug)}</code>) was <strong>not approved</strong> at this time. You may submit a new request with additional evidence.`;

  const noteHtml = decisionNote?.trim()
    ? `<p style="margin:20px 0;padding:12px 16px;background:#f9fafb;border-radius:6px;
         font-size:14px;color:#374151;line-height:1.6">
         <strong>Reviewer note:</strong><br>${escapeHtml(decisionNote.trim()).replace(/\n/g, '<br>')}
       </p>`
    : '';

  const orgHtml = claimantOrg
    ? `<p style="margin:0 0 16px;font-size:14px;color:#374151">
         Claimed on behalf of <strong>@${escapeHtml(claimantOrg.slug)}</strong>
         (${escapeHtml(claimantOrg.displayName)}).
       </p>`
    : '';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>${escapeHtml(headline)}</title></head>
<body style="font-family:sans-serif;background:#f9fafb;margin:0;padding:0">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:40px">
        ${emailBrandHeaderCell(undefined, { showRasterLogo: showLogo })}
        <tr>
          <td style="padding-top:28px">
            <h1 style="margin:0 0 8px;font-size:22px;color:#111827">${escapeHtml(headline)}</h1>
            <p style="margin:0 0 20px;color:#374151;line-height:1.6">
              Hi <strong>${escapeHtml(toUsername)}</strong>,
            </p>
            <p style="margin:0 0 20px;color:#374151;line-height:1.6">${lead}</p>
            ${orgHtml}
            ${noteHtml}
            <p style="margin:0 0 12px">
              <a href="${packageUrl}"
                 style="display:inline-block;background:#111827;color:#fff;
                        padding:12px 24px;border-radius:6px;font-weight:600;
                        font-size:14px;text-decoration:none;margin-right:8px">
                View package
              </a>
              <a href="${dashboardUrl}"
                 style="display:inline-block;border:1px solid #d1d5db;color:#111827;
                        padding:12px 24px;border-radius:6px;font-weight:600;
                        font-size:14px;text-decoration:none">
                Your requests
              </a>
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

  if (!transport) {
    console.log('[mailer/ownership] Would send ownership decision email:');
    console.log(`  To:      ${toEmail}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Status:  ${statusLabel}`);
    console.log(text);
    return;
  }

  await transport.sendMail({
    from: FROM,
    to: toEmail,
    subject,
    text,
    html,
    attachments: logoAtt,
  });
}
