import fs from 'fs';
import path from 'path';
import type { Attachment } from 'nodemailer/lib/mailer';

/** Repo `brand/extensilica.svg` — same path works from `src/` (dev) and `dist/` (prod). */
function logoSvgPath(): string {
  return path.join(__dirname, '../../brand/extensilica.svg');
}

/**
 * Embedded PNG referenced from HTML (`<img src="cid:…">`).
 * Outlook and many clients strip SVG data-URIs; CID + PNG is reliable.
 */
export const EMAIL_LOGO_CID = 'extensilica-logo@mail';

let cachedLogoAttachments: Attachment[] | null = null;

export async function getEmailLogoAttachments(): Promise<Attachment[]> {
  if (cachedLogoAttachments !== null) return cachedLogoAttachments;

  try {
    const sharp = (await import('sharp')).default;
    const svg = fs.readFileSync(logoSvgPath());
    const png = await sharp(svg).resize(112, 112).png().toBuffer();
    cachedLogoAttachments = [
      {
        filename: 'extensilica-logo.png',
        content: png,
        cid: EMAIL_LOGO_CID,
      },
    ];
  } catch (e) {
    console.warn('[mailer] Could not build PNG logo for email (emails will use text header only):', e);
    cachedLogoAttachments = [];
  }

  return cachedLogoAttachments;
}

export function emailLogoImgTagCid(width = 52, height = 52): string {
  return `<img src="cid:${EMAIL_LOGO_CID}" width="${width}" height="${height}" alt="ExtenSilica" style="display:block;border:0;margin:0" />`;
}

/** Header row: optional raster logo + wordmark — use inside email `<table>` layouts. */
export function emailBrandHeaderCell(
  subtitleHtml: string | undefined,
  options: { showRasterLogo: boolean },
): string {
  const sub = subtitleHtml
    ? `<p style="margin:8px 0 0;font-size:12px;color:#6b7280">${subtitleHtml}</p>`
    : `<p style="margin:8px 0 0;font-size:12px;color:#6b7280">The public registry for <code style="font-size:11px">.xsil</code> packages</p>`;

  const logoCell = options.showRasterLogo
    ? `<td style="vertical-align:middle;padding-right:14px;width:52px">${emailLogoImgTagCid(52, 52)}</td>`
    : `<td style="vertical-align:middle;padding-right:14px;width:52px;font-size:26px;line-height:1" aria-hidden="true">◉</td>`;

  return `
        <tr>
          <td style="padding-bottom:20px;border-bottom:1px solid #f3f4f6">
            <table cellpadding="0" cellspacing="0"><tr>
              ${logoCell}
              <td style="vertical-align:middle">
                <p style="margin:0;font-size:18px;font-weight:700;color:#111827;line-height:1.2">ExtenSilica</p>
                ${sub}
              </td>
            </tr></table>
          </td>
        </tr>`.trim();
}
