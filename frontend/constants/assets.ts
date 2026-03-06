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
  /** 메인 로고 (SKYAND 풀 로고) */
  logo: {
    skyand: `${ASSETS_BASE}/logo/skyand.svg`,
  },

  /** 아이콘 (favicon, 앱 아이콘 등) */
  icons: {
    skyand: `${ASSETS_BASE}/icons/skyand-icon.svg`,
  },

  /** 기타 이미지 */
  images: {} as Record<string, string>,
} as const;

/** favicon 경로 (layout metadata용) */
export const FAVICON = ASSETS.icons.skyand;
