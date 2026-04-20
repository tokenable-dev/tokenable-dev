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
    /** PSA wordmark PNG (landing hero). */
    psaMark: `${ASSETS_BASE}/icons/psa-logo.png`,
    /** Lowest transaction fee — landing feature stat. */
    lowestTransactionFee: `${ASSETS_BASE}/icons/lowest-transaction-fee.png`,
    /** Instant settlement — landing feature stat. */
    instantSettlement: `${ASSETS_BASE}/icons/instant-settlement.png`,
  },

  /** 기타 이미지 */
  images: {} as Record<string, string>,
} as const;
