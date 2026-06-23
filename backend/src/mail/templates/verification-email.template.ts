export type VerificationEmailContent = {
  subject: string;
  text: string;
  html: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildVerificationEmailContent(input: {
  verifyLink: string;
  siteName?: string;
  logoCid?: string | null;
}): VerificationEmailContent {
  const siteName = input.siteName?.trim() || 'Tokenable';
  const safeLink = escapeHtml(input.verifyLink);
  const safeSiteName = escapeHtml(siteName);
  const logoCid = input.logoCid?.trim() || null;
  const year = new Date().getFullYear();

  const brandMarkCell = logoCid
    ? `<td align="center" style="padding-right:12px;vertical-align:middle;">
                    <img
                      src="cid:${escapeHtml(logoCid)}"
                      width="44"
                      height="44"
                      alt=""
                      style="display:block;width:44px;height:44px;border-radius:11px;border:1px solid #1f2937;background-color:#0b1220;"
                    />
                  </td>`
    : '';

  const brandTextCell = `<td style="vertical-align:middle;">
                    <span style="font-size:22px;font-weight:700;color:#ffffff !important;-webkit-text-fill-color:#ffffff;line-height:1;letter-spacing:-0.03em;">
                      ${safeSiteName}
                    </span>
                  </td>`;

  const brandHeader = logoCid
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  ${brandMarkCell}
                  ${brandTextCell}
                </tr>
              </table>`
    : `<span style="font-size:22px;font-weight:700;color:#ffffff !important;-webkit-text-fill-color:#ffffff;line-height:1;letter-spacing:-0.03em;">
                ${safeSiteName}
              </span>`;

  const subject = `Verify your ${siteName} email address`;

  const text = [
    `Thanks for signing up for ${siteName}.`,
    '',
    'Open this email in your mail app and tap the "Verify email address" button to confirm your account.',
    '',
    'This link expires in 48 hours.',
    'If you did not create an account, you can ignore this email.',
    '',
    `— ${siteName}`,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#030712;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    Confirm your email to finish setting up your ${safeSiteName} account.
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#030712;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:480px;">
          <tr>
            <td align="center" style="padding-bottom:28px;">
              ${brandHeader}
            </td>
          </tr>
          <tr>
            <td style="background-color:#0b1220;border:1px solid #1f2937;border-radius:16px;overflow:hidden;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td height="3" style="background-color:#10d333;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="padding:32px 28px 28px;">
                    <h1 style="margin:0 0 10px;font-size:24px;line-height:1.25;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">
                      Verify your email
                    </h1>
                    <p style="margin:0 0 28px;font-size:15px;line-height:1.65;color:#9ca3af;">
                      Thanks for joining ${safeSiteName}. Confirm your email address to activate your account and start trading.
                    </p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 28px;">
                      <tr>
                        <td align="center">
                          <a
                            href="${safeLink}"
                            target="_blank"
                            rel="noopener noreferrer"
                            style="display:inline-block;min-width:200px;padding:15px 32px;font-size:15px;font-weight:700;line-height:1;color:#041208;text-decoration:none;text-align:center;background-color:#10d333;border-radius:12px;box-shadow:0 1px 0 rgba(255,255,255,0.08) inset;"
                          >
                            Verify email address
                          </a>
                        </td>
                      </tr>
                    </table>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #1f2937;">
                      <tr>
                        <td style="padding-top:20px;">
                          <p style="margin:0;font-size:12px;line-height:1.65;color:#6b7280;">
                            This link expires in <span style="color:#9ca3af;font-weight:600;">48 hours</span>.
                            If you did not create a ${safeSiteName} account, you can safely ignore this message.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:24px;font-size:11px;line-height:1.5;color:#4b5563;">
              © ${year} ${safeSiteName}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}
