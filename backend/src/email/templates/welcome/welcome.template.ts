import { buildEmailFooterLinks } from '../../email-footer-links.util';
import { buildMultipartRfc822 } from '../../rfc822.util';
import type { EmailInlineImage } from '../../types';

/** Visual spec: design handoff `Welcome Email.dc.html` (email-safe table layout). */

/** Light card below hero — Gmail dark UI won't invert when color-scheme is light-only. */
const TK_CARD_BG = '#FFFFFF';
const TK_FEATURE_BG = '#F3F4F6';
const TK_TITLE = '#0D0F16';
const TK_BODY_MUTED = '#5C6578';
const TK_LINK_ACCENT = '#1A6FFF';
const TK_CTA_BG = '#1A6FFF';
const TK_FOOTER_TEXT = '#6B7280';
const TK_FOOTER_LINK = '#4B5563';
const TK_DIVIDER = 'rgba(0,0,0,0.08)';
const TK_TEAM = '#4B5563';

function externalArrowImg(src: string, inline = false): string {
  const layout = inline
    ? 'display:inline-block;vertical-align:-2px;margin-left:3px;'
    : 'display:block;';
  return `<img src="${src}" width="15" height="15" alt="" border="0" style="${layout}width:15px;height:15px;border:0;outline:none;text-decoration:none;" />`;
}

const HERO_IMG_STYLE =
  'display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;';

/**
 * DC `Welcome Email.dc.html` is 600px-wide artboard (14.5/13.5px body).
 * Naver 등은 `<style>` @media를 거의 안 씀 — 읽기 크기는 인라인 font-size가 기준.
 */
const WELCOME_EMAIL_HEAD_STYLES = `
  <style type="text/css">
    :root { color-scheme: light only; supported-color-schemes: light; }
    html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; -webkit-text-size-adjust: 100%; background-color: #F3F4F6 !important; background: #F3F4F6 !important; }
    table.tk-welcome-outer { width: 100% !important; min-width: 100% !important; margin: 0 !important; padding: 0 !important; background-color: #F3F4F6 !important; }
    img.tk-welcome-hero { display: block !important; width: 100% !important; max-width: 600px !important; height: auto !important; }
    .tk-welcome-card { width: 100% !important; max-width: 600px !important; margin: 0 auto !important; background-color: ${TK_CARD_BG} !important; }
    .tk-welcome-shell-pad { padding: 32px 24px !important; margin: 0 auto !important; background-color: #F3F4F6 !important; }
    @media only screen and (min-width: 621px) {
      .tk-welcome-section-pad { padding-left: 32px !important; padding-right: 32px !important; }
      .tk-welcome-section-title { font-size: 16px !important; }
      .tk-welcome-feature-title { font-size: 14.5px !important; }
      .tk-welcome-feature-body { font-size: 13.5px !important; line-height: 1.45 !important; }
      .tk-welcome-cta-text { font-size: 15px !important; }
      .tk-welcome-cta a { padding: 12px 24px !important; font-size: 15px !important; }
      .tk-welcome-secondary { font-size: 13.5px !important; }
      .tk-welcome-team { font-size: 14px !important; }
      .tk-welcome-footer { font-size: 12px !important; line-height: 1.65 !important; }
    }
    @media only screen and (max-width: 620px) {
      html, body { background-color: ${TK_CARD_BG} !important; background: ${TK_CARD_BG} !important; }
      table.tk-welcome-outer { background-color: ${TK_CARD_BG} !important; }
      .tk-welcome-shell-pad { padding: 0 !important; background-color: ${TK_CARD_BG} !important; }
      .tk-welcome-card { max-width: 100% !important; margin: 0 !important; }
      img.tk-welcome-hero { max-width: 100% !important; }
      .tk-welcome-section-pad { padding-left: 20px !important; padding-right: 20px !important; }
      .tk-welcome-h1 { font-size: 30px !important; line-height: 1.08 !important; }
      .tk-welcome-section-title { font-size: 18px !important; }
      .tk-welcome-feature-title { font-size: 17px !important; }
      .tk-welcome-feature-body { font-size: 16px !important; line-height: 1.55 !important; }
      .tk-welcome-cta-text { font-size: 17px !important; }
      .tk-welcome-cta a { padding: 14px 28px !important; font-size: 17px !important; }
      .tk-welcome-secondary { font-size: 15px !important; }
      .tk-welcome-team { font-size: 16px !important; }
      .tk-welcome-footer { font-size: 14px !important; }
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
  /** Feature row icons — PNG via cid or https (same constraint as arrows). */
  featureAuthIconSrc: string;
  featureVaultIconSrc: string;
  featureSettleIconSrc: string;
  /**
   * Hero PNG already includes wordmark + Welcome copy (required for Gmail — no HTML overlay).
   */
  heroComposite?: boolean;
  /** Only used when `heroComposite` is false (dev preview / legacy). */
  logoImageUrl?: string;
};

function featureRow(
  iconSrc: string,
  title: string,
  body: string,
  bottomPadPx: number,
): string {
  return `
<tr>
  <td style="padding:0 0 ${bottomPadPx}px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;border-spacing:0;">
      <tr>
        <td bgcolor="${TK_FEATURE_BG}" style="background-color:${TK_FEATURE_BG};border-radius:12px;padding:16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td width="40" valign="top" style="width:40px;padding:0 14px 0 0;line-height:0;font-size:0;">
                <img src="${iconSrc}" width="40" height="40" alt="" border="0" style="display:block;width:40px;height:40px;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;" />
              </td>
              <td valign="top" style="padding:0;font-family:Inter,Helvetica,Arial,sans-serif;">
                <div class="tk-welcome-feature-title" style="color:${TK_TITLE};font-size:17px;font-weight:700;line-height:1.35;margin:0 0 4px 0;">${title}</div>
                <div class="tk-welcome-feature-body" style="color:${TK_BODY_MUTED};font-size:16px;font-weight:400;line-height:1.5;margin:0;">${body}</div>
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
            <td align="center" style="padding:0;line-height:0;font-size:0;overflow:hidden;background-color:#0d0f16;">
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
                          <h1 class="tk-welcome-h1" style="margin:120px 0 12px 0;color:#FFFFFF;font-size:34px;font-weight:800;line-height:1.1;letter-spacing:-1px;">Welcome</h1>
                          <p style="margin:0;color:rgba(255,255,255,0.80);font-size:14px;font-weight:400;line-height:1.5;max-width:420px;">The safest and fastest way to trade collectibles.</p>
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
  const cardBg = TK_CARD_BG;
  return `<!DOCTYPE html>
<html lang="en" style="margin:0;padding:0;width:100%;background:${cardBg};" bgcolor="${cardBg}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>Welcome to Tokenable</title>
  ${WELCOME_EMAIL_HEAD_STYLES}
</head>
<body style="margin:0 !important;padding:0 !important;width:100% !important;min-width:100%;background:#F3F4F6;" bgcolor="#F3F4F6">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#F3F4F6" class="tk-welcome-outer" style="width:100%;min-width:100%;margin:0;padding:0;background:#F3F4F6;border-collapse:collapse;border-spacing:0;table-layout:fixed;">
    <tr>
      <td align="center" valign="top" width="100%" class="tk-welcome-shell-pad" style="width:100%;padding:32px 24px;margin:0;background:#F3F4F6;" bgcolor="#F3F4F6">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="tk-welcome-card" style="width:100%;max-width:600px;margin:0 auto;background-color:${cardBg};border-collapse:collapse;border-spacing:0;" bgcolor="${cardBg}">
          ${buildHeroBlock(input)}
          <tr>
            <td class="tk-welcome-section-pad" style="padding:28px 30px 4px 30px;background:${cardBg};font-family:Inter,Helvetica,Arial,sans-serif;">
              <p class="tk-welcome-section-title" style="margin:0 0 14px 0;color:${TK_TITLE};font-size:18px;font-weight:800;line-height:1.25;">What Tokenable provides everyone</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                ${featureRow(input.featureAuthIconSrc, 'Authentication', 'Only verified PSA and BGS 10 graded cards.', 12)}
                ${featureRow(input.featureVaultIconSrc, 'Vaulting', 'All graded cards are vaulted with either PSA or Tokenable partner vaults.', 12)}
                ${featureRow(input.featureSettleIconSrc, 'Instant settlement', 'Sellers get paid instantly with on-chain transactions.', 0)}
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" class="tk-welcome-section-pad tk-welcome-cta" style="padding:26px 30px 8px 30px;background:${cardBg};">
              <a href="${browseMarketsUrl}" style="display:inline-block;background:${TK_CTA_BG};color:#FFF;text-decoration:none;font-family:Inter,Helvetica,Arial,sans-serif;font-size:17px;font-weight:700;line-height:1.2;padding:14px 28px;border-radius:8px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                  <tr>
                    <td class="tk-welcome-cta-text" style="vertical-align:middle;color:#FFFFFF;font-size:17px;font-weight:700;line-height:1.2;padding:0;">Browse markets</td>
                    <td style="vertical-align:middle;padding-left:6px;line-height:0;font-size:0;">${arrowWhite}</td>
                  </tr>
                </table>
              </a>
            </td>
          </tr>
          <tr>
            <td align="center" class="tk-welcome-section-pad" style="padding:20px 30px 24px 30px;background:${cardBg};font-family:Inter,Helvetica,Arial,sans-serif;">
              <p class="tk-welcome-secondary" style="margin:0;font-size:15px;line-height:1.6;color:${TK_FOOTER_TEXT};text-align:center;white-space:nowrap;">
                <span style="color:${TK_FOOTER_TEXT};">New to Tokenable? </span><a href="${seeHowItWorksUrl}" style="color:${TK_LINK_ACCENT};text-decoration:none;font-weight:600;white-space:nowrap;">See how it works</a>${arrowLinkInline}
              </p>
              <p class="tk-welcome-team" style="margin:16px 0 0;color:${TK_TEAM};font-size:16px;font-weight:400;line-height:1.4;">The Tokenable team</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 30px;background:${cardBg};line-height:0;font-size:0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="border-top:1px solid ${TK_DIVIDER};font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" class="tk-welcome-footer" style="padding:22px 30px 26px 30px;background:${cardBg};font-family:Inter,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.8;color:${TK_FOOTER_TEXT};">
              <a href="${footer.managePreferencesUrl}" style="color:${TK_FOOTER_LINK};text-decoration:underline;">Manage email preferences</a>
              · <a href="${footer.unsubscribeUrl}" style="color:${TK_FOOTER_LINK};text-decoration:underline;">Unsubscribe</a>
              · <a href="${footer.marketingSiteUrl}" style="color:${TK_FOOTER_LINK};text-decoration:underline;">tokenable.io</a>
              · <a href="${footer.instagramUrl}" style="color:${TK_FOOTER_LINK};text-decoration:underline;">Instagram</a>
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
