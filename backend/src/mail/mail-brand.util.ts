import { existsSync } from 'fs';
import { join } from 'path';

/** Content-ID for inline logo attachment (no external image URL). */
export const MAIL_LOGO_CID = 'tokenable-logo@mail';

export function resolveMailLogoPath(): string | null {
  const candidates = [
    join(__dirname, '..', 'assets', 'mail', 'tokenable_icon.png'),
    join(process.cwd(), 'dist', 'assets', 'mail', 'tokenable_icon.png'),
    join(process.cwd(), 'src', 'assets', 'mail', 'tokenable_icon.png'),
    join(
      process.cwd(),
      '..',
      'frontend',
      'public',
      'assets',
      'icons',
      'tokenable_icon.png',
    ),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Left-aligned T icon + wordmark for transactional emails. */
export function buildEmailBrandHeaderHtml(input: {
  siteName: string;
  logoCid?: string | null;
  theme?: 'light' | 'dark';
}): string {
  const safeSiteName = escapeHtml(input.siteName.trim() || 'Tokenable');
  const logoCid = input.logoCid?.trim() || null;
  const onLight = input.theme !== 'dark';
  const wordmarkColor = onLight ? '#111827' : '#ffffff';
  const iconBorder = onLight ? '#d1d5db' : '#1f2937';
  const iconBg = onLight ? '#ffffff' : '#0b1220';

  const wordmark = `<span style="font-size:20px;font-weight:700;color:${wordmarkColor} !important;-webkit-text-fill-color:${wordmarkColor};line-height:1;letter-spacing:-0.03em;">
      ${safeSiteName}
    </span>`;

  if (!logoCid) {
    return wordmark;
  }

  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td align="left" style="padding-right:10px;vertical-align:middle;">
        <img
          src="cid:${escapeHtml(logoCid)}"
          width="40"
          height="40"
          alt=""
          style="display:block;width:40px;height:40px;border-radius:10px;border:1px solid ${iconBorder};background-color:${iconBg};"
        />
      </td>
      <td align="left" style="vertical-align:middle;">
        ${wordmark}
      </td>
    </tr>
  </table>`;
}
