import { DEFAULT_TRANSACTIONAL_EMAIL_FRONTEND_URL } from '../../resolve-email-frontend-url';
import type { TransactionalEmailService } from '../../transactional-email.service';
import type { EmailInlineImage } from '../../types';
import {
  buildWelcomeArrowLinkPng,
  buildWelcomeArrowWhitePng,
  tryReadWelcomeArrowLinkPng,
  tryReadWelcomeArrowWhitePng,
} from './welcome-arrow.util';
import {
  buildWelcomeFeatureAuthPng,
  buildWelcomeFeatureSettlePng,
  buildWelcomeFeatureVaultPng,
  welcomeFeatureIconDataUriSrcs,
} from './welcome-feature-icons.util';
import {
  buildWelcomeHeroCompositePng,
  tryReadWelcomeHeroCompositeFile,
} from './welcome-hero-composite.util';
import type { WelcomeEmailTemplateInput } from './welcome.template';

export const WELCOME_HERO_CID = 'welcome-hero@tokenable';
export const WELCOME_ARROW_WHITE_CID = 'welcome-arrow-white@tokenable';
export const WELCOME_ARROW_LINK_CID = 'welcome-arrow-link@tokenable';
export const WELCOME_FEATURE_AUTH_CID = 'welcome-feature-auth@tokenable';
export const WELCOME_FEATURE_VAULT_CID = 'welcome-feature-vault@tokenable';
export const WELCOME_FEATURE_SETTLE_CID = 'welcome-feature-settle@tokenable';

export type WelcomeEmailImageTemplateFields = Pick<
  WelcomeEmailTemplateInput,
  | 'heroImgSrc'
  | 'heroComposite'
  | 'arrowWhiteImgSrc'
  | 'arrowLinkImgSrc'
  | 'featureAuthIconSrc'
  | 'featureVaultIconSrc'
  | 'featureSettleIconSrc'
>;

export function welcomeEmailImageFieldsCid(): WelcomeEmailImageTemplateFields {
  return {
    heroImgSrc: `cid:${WELCOME_HERO_CID}`,
    heroComposite: true,
    arrowWhiteImgSrc: `cid:${WELCOME_ARROW_WHITE_CID}`,
    arrowLinkImgSrc: `cid:${WELCOME_ARROW_LINK_CID}`,
    featureAuthIconSrc: `cid:${WELCOME_FEATURE_AUTH_CID}`,
    featureVaultIconSrc: `cid:${WELCOME_FEATURE_VAULT_CID}`,
    featureSettleIconSrc: `cid:${WELCOME_FEATURE_SETTLE_CID}`,
  };
}

const WELCOME_PUBLIC_ASSET_ENV = 'WELCOME_EMAIL_PUBLIC_ASSET_BASE_URL';
/** QA only: multipart/related CID PNGs (shows as attachments in some clients). */
const WELCOME_INLINE_IMAGES_ENV = 'WELCOME_EMAIL_INLINE_IMAGES';
/** When set, feature badges use HTTPS URLs (requires `welcome-feature-*.png` on asset host). */
const WELCOME_FEATURE_ICONS_HTTPS_ENV = 'WELCOME_EMAIL_FEATURE_ICONS_HTTPS';

/** HTTPS origin for `/assets/email/*` when not using CID inline parts. */
export function resolveWelcomeHttpsAssetBase(
  mail: TransactionalEmailService,
): string {
  const fromWelcome = mail.httpsPublicAssetBase(WELCOME_PUBLIC_ASSET_ENV);
  if (fromWelcome) return fromWelcome;
  const fromTx = mail.httpsPublicAssetBase();
  if (fromTx) return fromTx;
  const front = mail.frontendUrl();
  if (/^https:\/\//i.test(front)) return front.replace(/\/$/, '');
  return DEFAULT_TRANSACTIONAL_EMAIL_FRONTEND_URL;
}

export type WelcomeImageDelivery = 'inline' | 'https';

export async function resolveWelcomeEmailContent(
  mail: TransactionalEmailService,
  opts?: { imageDelivery?: WelcomeImageDelivery },
): Promise<{
  template: { frontendUrl: string } & WelcomeEmailImageTemplateFields;
  inlineImages?: EmailInlineImage[];
}> {
  const front = mail.frontendUrl();
  const delivery =
    opts?.imageDelivery ??
    (mail.isEnvFlagEnabled(WELCOME_INLINE_IMAGES_ENV) ? 'inline' : 'https');

  if (delivery === 'https') {
    return resolveWelcomeHttpsNoAttachments(mail, front);
  }

  const inlineImages = await tryLoadWelcomeCompositeInlineImages();
  if (inlineImages) {
    return {
      template: {
        frontendUrl: front,
        ...welcomeEmailImageFieldsCid(),
      },
      inlineImages,
    };
  }

  return resolveWelcomeHttpsNoAttachments(mail, front);
}

/**
 * Hero + arrows from HTTPS; feature badges embedded as PNG data URIs (no MIME parts).
 * Set `WELCOME_EMAIL_FEATURE_ICONS_HTTPS=1` after `welcome-feature-*.png` are on the asset host.
 */
async function resolveWelcomeHttpsNoAttachments(
  mail: TransactionalEmailService,
  front: string,
): Promise<{
  template: { frontendUrl: string } & WelcomeEmailImageTemplateFields;
}> {
  const assetBase = resolveWelcomeHttpsAssetBase(mail);
  const remote = welcomeEmailImageFieldsHttps(assetBase);
  const features = mail.isEnvFlagEnabled(WELCOME_FEATURE_ICONS_HTTPS_ENV)
    ? {
        featureAuthIconSrc: remote.featureAuthIconSrc,
        featureVaultIconSrc: remote.featureVaultIconSrc,
        featureSettleIconSrc: remote.featureSettleIconSrc,
      }
    : await welcomeFeatureIconDataUriSrcs();
  return {
    template: {
      frontendUrl: front,
      heroImgSrc: remote.heroImgSrc,
      heroComposite: true,
      arrowWhiteImgSrc: remote.arrowWhiteImgSrc,
      arrowLinkImgSrc: remote.arrowLinkImgSrc,
      ...features,
    },
  };
}

export function welcomeEmailImageFieldsHttps(
  assetBase: string,
): WelcomeEmailImageTemplateFields {
  const base = assetBase.replace(/\/$/, '');
  return {
    heroImgSrc: `${base}/assets/email/welcome-hero-composite.png`,
    heroComposite: true,
    arrowWhiteImgSrc: `${base}/assets/email/welcome-arrow-white.png`,
    arrowLinkImgSrc: `${base}/assets/email/welcome-arrow-link.png`,
    featureAuthIconSrc: `${base}/assets/email/welcome-feature-auth.png`,
    featureVaultIconSrc: `${base}/assets/email/welcome-feature-vault.png`,
    featureSettleIconSrc: `${base}/assets/email/welcome-feature-settle.png`,
  };
}

export async function tryLoadWelcomeCompositeInlineImages(): Promise<
  EmailInlineImage[] | null
> {
  try {
    return await loadWelcomeCompositeInlineImages();
  } catch {
    return null;
  }
}

export async function loadWelcomeFeatureInlineImages(): Promise<
  EmailInlineImage[]
> {
  const featureAuth = await buildWelcomeFeatureAuthPng();
  const featureVault = await buildWelcomeFeatureVaultPng();
  const featureSettle = await buildWelcomeFeatureSettlePng();
  return [
    {
      cid: WELCOME_FEATURE_AUTH_CID,
      filename: 'welcome-feature-auth.png',
      mimeType: 'image/png',
      data: featureAuth,
    },
    {
      cid: WELCOME_FEATURE_VAULT_CID,
      filename: 'welcome-feature-vault.png',
      mimeType: 'image/png',
      data: featureVault,
    },
    {
      cid: WELCOME_FEATURE_SETTLE_CID,
      filename: 'welcome-feature-settle.png',
      mimeType: 'image/png',
      data: featureSettle,
    },
  ];
}

export async function loadWelcomeCompositeInlineImages(): Promise<
  EmailInlineImage[]
> {
  const hero =
    tryReadWelcomeHeroCompositeFile() ?? (await buildWelcomeHeroCompositePng());
  const arrowWhite =
    tryReadWelcomeArrowWhitePng() ?? (await buildWelcomeArrowWhitePng());
  const arrowLink =
    tryReadWelcomeArrowLinkPng() ?? (await buildWelcomeArrowLinkPng());
  const features = await loadWelcomeFeatureInlineImages();
  return [
    {
      cid: WELCOME_HERO_CID,
      filename: 'welcome-hero.png',
      mimeType: 'image/png',
      data: hero,
    },
    {
      cid: WELCOME_ARROW_WHITE_CID,
      filename: 'welcome-arrow-white.png',
      mimeType: 'image/png',
      data: arrowWhite,
    },
    {
      cid: WELCOME_ARROW_LINK_CID,
      filename: 'welcome-arrow-link.png',
      mimeType: 'image/png',
      data: arrowLink,
    },
    ...features,
  ];
}
