import type { EmailInlineImage } from '../../types';
import {
  buildWelcomeArrowLinkPng,
  buildWelcomeArrowWhitePng,
  tryReadWelcomeArrowLinkPng,
  tryReadWelcomeArrowWhitePng,
} from './welcome-arrow.util';
import {
  buildWelcomeHeroCompositePng,
  tryReadWelcomeHeroCompositeFile,
} from './welcome-hero-composite.util';

export const WELCOME_HERO_CID = 'welcome-hero@tokenable';
export const WELCOME_ARROW_WHITE_CID = 'welcome-arrow-white@tokenable';
export const WELCOME_ARROW_LINK_CID = 'welcome-arrow-link@tokenable';

export async function tryLoadWelcomeCompositeInlineImages(): Promise<
  EmailInlineImage[] | null
> {
  try {
    return await loadWelcomeCompositeInlineImages();
  } catch {
    return null;
  }
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
  ];
}
