/**
 * Brand assets — SVG, icons, images
 *
 * 디렉터리 구조:
 *   public/assets/
 *   ├── logo/       # 로고 (풀 버전)
 *   ├── icons/      # 아이콘 (favicon, 앱 아이콘 등)
 *   └── images/     # 기타 이미지
 *
 * 새 SVG 추가 시 이 파일에 경로를 등록하세요.
 */

const ASSETS_BASE = "/assets";

export const ASSETS = {
  /** 메인 로고 (Tokenable / Tokenable_RWA) */
  logo: {
    tokenable: `${ASSETS_BASE}/logo/tokenable.png`,
    /** DS GNB — full wordmark */
    tokenableDs: `${ASSETS_BASE}/ds/logo-tokenable.svg`,
    /** DS GNB — symbol (mobile) */
    tokenableSymbol: `${ASSETS_BASE}/ds/symbol-white.svg`,
  },

  /** Design system marketing assets (home, prototypes) */
  ds: {
    partners: {
      psa: `${ASSETS_BASE}/ds/logo-psa.png`,
      beckett: `${ASSETS_BASE}/ds/logo-beckett.png`,
      cgc: `${ASSETS_BASE}/ds/logo-cgc.png`,
      sgc: `${ASSETS_BASE}/ds/logo-sgc.png`,
      tag: `${ASSETS_BASE}/ds/logo-tag.png`,
    },
    cards: {
      charizard: `${ASSETS_BASE}/ds/card-charizard.png`,
      lebron: `${ASSETS_BASE}/ds/card-lebron.png`,
      pikachu: `${ASSETS_BASE}/ds/card-pikachu.png`,
      luka: `${ASSETS_BASE}/ds/card-luka.png`,
      nidoking: `${ASSETS_BASE}/ds/card-nidoking.jpg`,
      pikachuEx: `${ASSETS_BASE}/ds/card-pikachu-ex.png`,
    },
  },

  /** 아이콘 (favicon, 앱 아이콘 등) */
  icons: {
    /** 32×32 favicon (from `tokenable_favicon.png`, dark background) */
    tokenable: `${ASSETS_BASE}/icons/tokenable_icon.png`,
    /** 360×360 favicon source — dark background */
    tokenableFavicon: `${ASSETS_BASE}/icons/tokenable_favicon.png`,
    /** 360×360 square brand mark (light-background master) */
    tokenableLogo: `${ASSETS_BASE}/icons/tokenable_logo.png`,
    /** 180×180 iOS home screen (from `tokenable_favicon.png`) */
    tokenableApple: `${ASSETS_BASE}/icons/apple-touch-icon.png`,
    /** PSA wordmark PNG (card detail / docs). */
    psaMark: `${ASSETS_BASE}/icons/psa-logo.png`,
    /** Vault submit cert label — square canvas, matches Vault-Submit.html `images/psa-logo.png`. */
    psaMarkSubmit: `${ASSETS_BASE}/icons/psa-logo-submit.png`,
    /** Vault safe icon — shown before PSA wordmark on card detail. */
    psaVaultLeading: `${ASSETS_BASE}/icons/psa-vault-leading.png`,
    /** Market Indexes cards — Pokemon slot. */
    marketIndexPokemon: `${ASSETS_BASE}/icons/market-index-pokemon.png`,
    /** Market Indexes cards — MLB slot. */
    marketIndexMlb: `${ASSETS_BASE}/icons/market-index-mlb.png`,
    /** Market Indexes cards — NFL slot. */
    marketIndexNfl: `${ASSETS_BASE}/icons/market-index-nfl.png`,
    /** Market Indexes cards — NBA slot. */
    marketIndexNba: `${ASSETS_BASE}/icons/market-index-nba.png`,
    /** Exchange category filter — Soccer. */
    marketIndexSoccer: `${ASSETS_BASE}/icons/market-index-soccer.png`,
  },

  /** Home hero carousel faces (`public/assets/home/`) */
  home: {
    landing1: `${ASSETS_BASE}/home/landing_1.jpg`,
    landing2: `${ASSETS_BASE}/home/landing_2.jpg`,
    landing3: `${ASSETS_BASE}/home/landing_3.jpg`,
    landing4: `${ASSETS_BASE}/home/landing_4.jpg`,
    landing5: `${ASSETS_BASE}/home/landing_5.jpg`,
    landing6: `${ASSETS_BASE}/home/landing_6.jpg`,
  },

  /** 기타 이미지 */
  images: {} as Record<string, string>,
} as const;
