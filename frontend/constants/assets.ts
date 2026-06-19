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
  },

  /** 아이콘 (favicon, 앱 아이콘 등) */
  icons: {
    tokenable: `${ASSETS_BASE}/icons/tokenable_icon.png`,
    /** PSA wordmark PNG (landing / docs). */
    psaMark: `${ASSETS_BASE}/icons/psa-logo.png`,
    /** Vault safe icon — shown before PSA wordmark on card detail. */
    psaVaultLeading: `${ASSETS_BASE}/icons/psa-vault-leading.png`,
    /** Landing offers — Authenticity seal. */
    landingOffersAuthenticity: `${ASSETS_BASE}/icons/landing-offers-authenticity.png`,
    /** Landing offers — PSA vault safe. */
    landingOffersPsaVaults: `${ASSETS_BASE}/icons/landing-offers-psa-vaults.png`,
    /** Landing offers — liquidity / exchange. */
    landingOffersLiquidity: `${ASSETS_BASE}/icons/landing-offers-liquidity.png`,
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
    /** Landing hero carousel — double-chevron nav control. */
    landingCarouselChevron: `${ASSETS_BASE}/icons/landing-carousel-chevron.png`,
  },

  /** 기타 이미지 */
  images: {} as Record<string, string>,
} as const;
