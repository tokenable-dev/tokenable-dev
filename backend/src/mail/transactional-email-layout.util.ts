import { buildEmailBrandHeaderHtml } from './mail-brand.util';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type TransactionalEmailLayoutInput = {
  siteName: string;
  logoCid?: string | null;
  pageTitle: string;
  cardBodyHtml: string;
  year?: number;
  preheader?: string;
};

/**
 * Light outer canvas + centered card. Brand row sits above the card, left-aligned.
 */
export function buildTransactionalEmailLayout(
  input: TransactionalEmailLayoutInput,
): string {
  const siteName = input.siteName.trim() || 'Tokenable';
  const safeSiteName = escapeHtml(siteName);
  const year = input.year ?? new Date().getFullYear();
  const brandHeader = buildEmailBrandHeaderHtml({
    siteName,
    logoCid: input.logoCid,
    theme: 'light',
  });
  const preheader = input.preheader?.trim()
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(input.preheader)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${escapeHtml(input.pageTitle)}</title>
</head>
<body style="margin:0;padding:0;background-color:#e8ecf1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  ${preheader}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#e8ecf1;">
    <tr>
      <td align="center" style="padding:28px 16px 32px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:420px;margin:0 auto;">
          <tr>
            <td align="left" style="padding:0 4px 14px;">
              ${brandHeader}
            </td>
          </tr>
          <tr>
            <td style="background-color:#111827;border:1px solid #d1d5db;border-radius:18px;overflow:hidden;box-shadow:0 10px 28px rgba(15,23,42,0.14);">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td height="3" style="background-color:#10d333;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="padding:28px 24px 26px;">
                    ${input.cardBodyHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:16px;font-size:11px;line-height:1.5;color:#6b7280;">
              © ${year} ${safeSiteName}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Centered title + CTA button + optional footnote inside the card. */
export function buildCenteredCardBlock(input: {
  title: string;
  buttonHref: string;
  buttonLabel: string;
  footnoteHtml: string;
}): string {
  const safeTitle = escapeHtml(input.title);
  const safeHref = escapeHtml(input.buttonHref);
  const safeLabel = escapeHtml(input.buttonLabel);

  return `<h1 style="margin:0 0 22px;font-size:22px;line-height:1.3;font-weight:700;color:#f9fafb;text-align:center;letter-spacing:-0.02em;">
      ${safeTitle}
    </h1>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px;">
      <tr>
        <td align="center">
          <a
            href="${safeHref}"
            target="_blank"
            rel="noopener noreferrer"
            style="display:inline-block;min-width:200px;padding:14px 28px;font-size:15px;font-weight:700;line-height:1;color:#041208;text-decoration:none;text-align:center;background-color:#10d333;border-radius:12px;"
          >
            ${safeLabel}
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:12px;line-height:1.65;color:#9ca3af;text-align:center;">
      ${input.footnoteHtml}
    </p>`;
}
