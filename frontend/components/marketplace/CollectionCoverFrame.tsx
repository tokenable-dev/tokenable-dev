"use client";

import { resolveIpfsImage } from "@/lib/api";

export interface CollectionCoverFrameProps {
  /** `ipfs://` 또는 https — 내부에서 게이트웨이 변환 */
  imageUrl: string;
  alt?: string;
  /** 목록 썸네일 vs 컬렉션 상단 히어로 */
  variant?: "compact" | "featured";
  className?: string;
}

/**
 * 컬렉션 대표 이미지용 프레임 — 그라데이션 베젤, 이너 매트, 은은한 하이라이트.
 * featured는 `aspect-[3/4]` + `max-w`로 크기 고정 (flex-1/absolute 조합으로 높이 0 되는 문제 방지).
 */
export function CollectionCoverFrame({
  imageUrl,
  alt = "",
  variant = "compact",
  className = "",
}: CollectionCoverFrameProps) {
  const resolved = resolveIpfsImage(imageUrl);
  const outerPad = variant === "featured" ? "p-[3px] sm:p-[4px]" : "p-[2px]";
  const innerPad = variant === "featured" ? "p-2 sm:p-2.5" : "p-1";
  const radiusOuter = variant === "featured" ? "rounded-[1.15rem]" : "rounded-xl";
  const radiusInner = variant === "featured" ? "rounded-[0.95rem]" : "rounded-[0.65rem]";
  const radiusImg = variant === "featured" ? "rounded-lg" : "rounded-md";

  /** 상세 헤더: 너비 기준으로 비율 고정 (165×220 근처 @ 3:4 세로) */
  const featuredOuter = "w-full max-w-[165px] sm:max-w-[180px] aspect-[3/4]";

  return (
    <div
      className={`relative ${radiusOuter} ${outerPad} bg-gradient-to-br from-mint/45 via-mint-deep/30 to-gray-950 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.65),0_0_0_1px_rgba(167,243,208,0.12)] ${
        variant === "featured" ? featuredOuter : ""
      } ${className}`}
    >
      <div
        className={`${radiusInner} bg-gradient-to-b from-gray-800/90 via-[#0c1018] to-[#06080d] ${innerPad} shadow-[inset_0_1px_0_rgba(255,255,255,0.07),inset_0_-1px_0_rgba(0,0,0,0.4)] flex flex-col ${
          variant === "featured" ? "h-full min-h-0" : ""
        }`}
      >
        <div
          className={`relative overflow-hidden bg-[#030508] ring-1 ring-white/[0.07] ${radiusImg} ${
            variant === "compact"
              ? "aspect-[3/4] w-full"
              : "min-h-0 w-full flex-1"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolved}
            alt={alt}
            className="absolute inset-0 h-full w-full object-contain object-center"
            style={{ filter: "saturate(1.04) contrast(1.02)" }}
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-2/5 bg-gradient-to-b from-white/[0.045] to-transparent"
            aria-hidden
          />
        </div>
      </div>
    </div>
  );
}
