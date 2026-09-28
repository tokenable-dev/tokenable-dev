import { buildEmailFooterLinks } from '../../email-footer-links.util';
import { buildMultipartRfc822 } from '../../rfc822.util';
import type { EmailInlineImage } from '../../types';

/** Pixel icons from welcome email design (embedded as data URIs for Gmail). */

const ICON_AUTH = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M18.3239 1.8324H3.66479V3.66478H18.3239V1.8324Z" fill="#E9EEFB"/><path d="M3.66478 3.66479H1.8324V12.8267H3.66478V3.66479Z" fill="#E9EEFB"/><path d="M20.1574 3.66498H18.325V12.8269H20.1574V3.66498Z" fill="#E9EEFB"/><path d="M5.49718 12.8275H3.66479V14.6599H5.49718V12.8275Z" fill="#E9EEFB"/><path d="M7.32988 14.66H5.4975V16.4924H7.32988V14.66Z" fill="#E9EEFB"/><path d="M12.8272 18.325H9.16248V20.1574H12.8272V18.325Z" fill="#E9EEFB"/><path d="M16.4921 12.8275H18.3245V14.6599H16.4921V12.8275Z" fill="#E9EEFB"/><path d="M14.6601 14.66H16.4925V16.4924H14.6601V14.66Z" fill="#E9EEFB"/><path d="M12.8272 16.4925H14.6595V18.3249H12.8272V16.4925Z" fill="#E9EEFB"/><path d="M7.33009 16.4925H9.16248V18.3249H7.33009V16.4925Z" fill="#E9EEFB"/></svg>`,
);

const ICON_VAULT = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M19.2411 1.8324H2.7486V3.6649H19.2411V1.8324Z" fill="#E9EEFB"/><path d="M19.2413 6.41376H2.74878V8.24626H19.2413V6.41376Z" fill="#E9EEFB"/><path d="M2.74858 3.66479H0.916199V6.41337H2.74858V3.66479Z" fill="#E9EEFB"/><path d="M21.0737 3.66498H19.2413V6.41355H21.0737V3.66498Z" fill="#E9EEFB"/><path d="M19.2411 8.24628H17.4088V18.3244H19.2411V8.24628Z" fill="#E9EEFB"/><path d="M4.58116 8.24628H2.74878V18.3244H4.58116V8.24628Z" fill="#E9EEFB"/><path d="M17.4079 18.325H4.58124V20.1574H17.4079V18.325Z" fill="#E9EEFB"/><path d="M13.7434 10.0787H8.24628V11.9111H13.7434V10.0787Z" fill="#E9EEFB"/></svg>`,
);

const ICON_SETTLE = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M3.6649 11.9112H10.9949V17.4087H12.8274V19.2412H10.9949V21.0737H9.1624V13.7437H1.8324V10.0787H3.6649V11.9112ZM14.6599 17.4087H12.8274V15.5762H14.6599V17.4087ZM16.4924 15.5762H14.6599V13.7437H16.4924V15.5762ZM18.3249 13.7437H16.4924V11.9112H18.3249V13.7437ZM12.8274 8.2462H20.1574V11.9112H18.3249V10.0787H10.9949V4.5812H9.1624V2.7487H10.9949V0.916199H12.8274V8.2462ZM5.4974 10.0787H3.6649V8.2462H5.4974V10.0787ZM7.3299 8.2462H5.4974V6.4137H7.3299V8.2462ZM9.1624 6.4137H7.3299V4.5812H9.1624V6.4137Z" fill="#E9EEFB"/></svg>`,
);

function externalArrowImg(src: string, inline = false): string {
  const layout = inline
    ? 'display:inline-block;vertical-align:-2px;margin-left:3px;'
    : 'display:block;';
  return `<img src="${src}" width="15" height="15" alt="" border="0" style="${layout}width:15px;height:15px;border:0;outline:none;text-decoration:none;" />`;
}

const HERO_IMG_STYLE =
  'display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;';

/** Mobile: avoid fixed hero height (stretches when width scales down). */
const WELCOME_EMAIL_HEAD_STYLES = `
  <style type="text/css">
    img.tk-welcome-hero { width: 100% !important; max-width: 600px !important; height: auto !important; }
    @media only screen and (max-width: 620px) {
      .tk-welcome-shell-pad { padding: 16px 12px !important; }
      .tk-welcome-card { width: 100% !important; max-width: 100% !important; }
      .tk-welcome-section-pad { padding-left: 20px !important; padding-right: 20px !important; }
      .tk-welcome-h1 { font-size: 32px !important; line-height: 1.08 !important; }
      .tk-welcome-cta a { padding-left: 22px !important; padding-right: 22px !important; }
    }
  </style>
`;

export type WelcomeEmailTemplateInput = {
  frontendUrl: string;
  /** `<img src>` — must be https or cid (Gmail does not paint CSS backgrounds for cid). */
  heroImgSrc: string;
  /** PNG arrow-up-right for CTA (Gmail blocks inline SVG data URIs). */
  arrowWhiteImgSrc: string;
  arrowLinkImgSrc: string;
  /**
   * Hero PNG already includes wordmark + Welcome copy (required for Gmail — no HTML overlay).
   */
  heroComposite?: boolean;
  /** Only used when `heroComposite` is false (dev preview / legacy). */
  logoImageUrl?: string;
};

function featureRow(
  iconDataUri: string,
  title: string,
  body: string,
  bottomPadPx: number,
): string {
  return `
<tr>
  <td style="padding:0 0 ${bottomPadPx}px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;border-spacing:0;">
      <tr>
        <td bgcolor="#12151C" style="background-color:#12151C;border-radius:12px;padding:14px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td width="44" valign="top" style="padding:0;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td width="36" height="36" align="center" valign="middle" style="width:36px;height:36px;background:#1A1E28;border-radius:6px;">
                      <img src="data:image/svg+xml,${iconDataUri}" width="22" height="22" alt="" style="display:block;width:22px;height:22px;margin:0 auto;" />
                    </td>
                  </tr>
                </table>
              </td>
              <td valign="top" style="padding-left:10px;font-family:Inter,Arial,sans-serif;">
                <div style="color:#FFF;font-size:15px;font-weight:800;line-height:1.35;margin:0 0 4px 0;">${title}</div>
                <div style="color:rgba(255,255,255,0.70);font-size:14px;font-weight:400;line-height:1.35;margin:0;">${body}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </td>
</tr>`;
}

function buildHeroBlock(input: WelcomeEmailTemplateInput): string {
  const hero = input.heroImgSrc;
  if (input.heroComposite) {
    return `
          <tr>
            <td align="center" style="padding:0;line-height:0;font-size:0;border-radius:12px 12px 0 0;overflow:hidden;background-color:#0d0f16;">
              <img src="${hero}" width="600" height="330" alt="Welcome to Tokenable" border="0" class="tk-welcome-hero" style="${HERO_IMG_STYLE}" />
            </td>
          </tr>`;
  }

  const logo = input.logoImageUrl ?? '';
  return `
          <tr>
            <td align="center" style="padding:0;border-radius:12px 12px 0 0;overflow:hidden;background-color:#0d0f16;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;">
                <tr>
                  <td align="center" height="330" style="padding:0;height:330px;line-height:330px;font-size:14px;mso-line-height-rule:exactly;">
                    <img src="${hero}" width="600" height="330" alt="" border="0" style="display:block;width:100%;max-width:600px;height:330px;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;" />
                  </td>
                </tr>
                <tr>
                  <td align="left" valign="top" style="padding:0;margin:0;font-size:14px;line-height:normal;mso-line-height-rule:exactly;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" align="center" style="width:100%;max-width:600px;margin-top:-330px;">
                      <tr>
                        <td height="330" valign="top" align="left" style="height:330px;padding:30px;font-family:Inter,Arial,sans-serif;vertical-align:top;">
                          <img src="${logo}" width="171" height="22" alt="Tokenable" border="0" style="display:block;width:171px;max-width:171px;height:22px;border:0;" />
                          <h1 style="margin:120px 0 8px 0;color:#FFFFFF;font-size:40px;font-weight:800;line-height:1.05;">Welcome</h1>
                          <p style="margin:0;color:rgba(255,255,255,0.88);font-size:17px;font-weight:500;line-height:1.35;max-width:420px;">The safest and fastest way to trade collectibles.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

export function buildWelcomeEmailPlainText(input: WelcomeEmailTemplateInput): string {
  const appBase = input.frontendUrl.replace(/\/$/, '');
  const footer = buildEmailFooterLinks(appBase);
  return `Welcome to Tokenable

The safest and fastest way to trade collectibles.

What Tokenable provides everyone

Authentication — Only verified PSA and BGS 10 graded cards.
Vaulting — All graded cards are vaulted with either PSA or Tokenable partner vaults.
Instant settlement — Sellers get paid instantly with on-chain transactions.

Browse markets: ${appBase}/markets
See how it works: ${appBase}/#home-features

The Tokenable team

Manage email preferences: ${footer.managePreferencesUrl}
Unsubscribe: ${footer.unsubscribeUrl}
tokenable.io: ${footer.marketingSiteUrl}
Instagram: ${footer.instagramUrl}
`;
}

export function buildWelcomeEmailHtml(input: WelcomeEmailTemplateInput): string {
  const appBase = input.frontendUrl.replace(/\/$/, '');
  const footer = buildEmailFooterLinks(appBase);
  const browseMarketsUrl = `${appBase}/markets`;
  const seeHowItWorksUrl = `${appBase}/#home-features`;
  const arrowWhite = externalArrowImg(input.arrowWhiteImgSrc);
  const arrowLinkInline = externalArrowImg(input.arrowLinkImgSrc, true);
  const cardBg = '#0D0F16';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>Welcome to Tokenable</title>
  ${WELCOME_EMAIL_HEAD_STYLES}
</head>
<body style="margin:0;padding:0;background:#04060F;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#04060F;">
    <tr>
      <td align="center" class="tk-welcome-shell-pad" style="padding:28px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="602" class="tk-welcome-card" style="max-width:601.82px;width:100%;border:1px solid rgba(255,255,255,0.08);background-color:${cardBg};border-collapse:separate;border-spacing:0;">
          ${buildHeroBlock(input)}
          <tr>
            <td class="tk-welcome-section-pad" style="padding:28px 30px 8px 30px;background:${cardBg};font-family:Inter,Arial,sans-serif;">
              <p style="margin:0 0 16px 0;color:#FFF;font-size:16px;font-weight:800;line-height:1.25;">What Tokenable provides everyone</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                ${featureRow(ICON_AUTH, 'Authentication', 'Only verified PSA and BGS 10 graded cards.', 12)}
                ${featureRow(ICON_VAULT, 'Vaulting', 'All graded cards are vaulted with either PSA or Tokenable partner vaults.', 12)}
                ${featureRow(ICON_SETTLE, 'Instant settlement', 'Sellers get paid instantly with on-chain transactions.', 0)}
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" class="tk-welcome-section-pad tk-welcome-cta" style="padding:24px 30px 0 30px;background:${cardBg};">
              <a href="${browseMarketsUrl}" style="display:inline-block;background:#2175FF;color:#FFF;text-decoration:none;font-family:Inter,Arial,sans-serif;font-size:15px;font-weight:700;line-height:1.2;padding:14px 28px;border-radius:8px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                  <tr>
                    <td style="vertical-align:middle;color:#FFFFFF;font-size:15px;font-weight:700;line-height:1.2;padding:0;">Browse markets</td>
                    <td style="vertical-align:middle;padding-left:6px;line-height:0;font-size:0;">${arrowWhite}</td>
                  </tr>
                </table>
              </a>
            </td>
          </tr>
          <tr>
            <td align="center" class="tk-welcome-section-pad" style="padding:16px 30px 28px 30px;background:${cardBg};font-family:Inter,Arial,sans-serif;">
              <p style="margin:0 0 16px 0;font-size:14px;line-height:1.4;color:rgba(255,255,255,0.75);text-align:center;white-space:nowrap;">
                <span style="color:rgba(255,255,255,0.75);">New to Tokenable? </span><a href="${seeHowItWorksUrl}" style="color:#8BB4FF;text-decoration:none;font-weight:600;white-space:nowrap;">See how it works</a>${arrowLinkInline}
              </p>
              <p style="margin:0;color:rgba(255,255,255,0.75);font-size:14px;font-weight:600;line-height:1.4;">The Tokenable team</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px 0 24px;background:${cardBg};line-height:0;font-size:0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="border-top:1px solid rgba(255,255,255,0.12);font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:16px 24px 28px 24px;background:${cardBg};font-family:Inter,Arial,sans-serif;font-size:12px;line-height:1.6;color:rgba(255,255,255,0.45);">
              <a href="${footer.managePreferencesUrl}" style="color:rgba(255,255,255,0.55);text-decoration:underline;">Manage email preferences</a>
              · <a href="${footer.unsubscribeUrl}" style="color:rgba(255,255,255,0.55);text-decoration:underline;">Unsubscribe</a>
              · <a href="${footer.marketingSiteUrl}" style="color:rgba(255,255,255,0.55);text-decoration:underline;">tokenable.io</a>
              · <a href="${footer.instagramUrl}" style="color:rgba(255,255,255,0.55);text-decoration:underline;">Instagram</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export const WELCOME_EMAIL_SUBJECT = 'Welcome to Tokenable';

export function buildWelcomeEmailMessage(input: WelcomeEmailTemplateInput) {
  return {
    subject: WELCOME_EMAIL_SUBJECT,
    plain: buildWelcomeEmailPlainText(input),
    html: buildWelcomeEmailHtml(input),
  };
}

/** Used by unit tests and any tooling that needs raw RFC822 without sending. */
export function buildWelcomeEmailRfc822(input: {
  to: string;
  from: string;
  template: WelcomeEmailTemplateInput;
  inlineImages?: EmailInlineImage[];
}): string {
  const { subject, plain, html } = buildWelcomeEmailMessage(input.template);
  return buildMultipartRfc822({
    to: input.to,
    from: input.from,
    subject,
    plain,
    html,
    inlineImages: input.inlineImages,
    boundaryPrefix: 'tk_welcome',
  });
}
