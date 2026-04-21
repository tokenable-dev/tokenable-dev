"use client";

import { CollectionImageLoupe } from "@/components/marketplace/CollectionImageLoupe";
import { useResolvedMediaUrl } from "@/hooks/useResolvedMediaUrl";

export interface CollectionCoverFrameProps {
  /** `ipfs://`, `https://…/ipfs/…`, 또는 일반 https — 브라우저는 API로만 해석 */
  imageUrl: string;
  alt?: string;
  /** 목록 썸네일 · 상단 중간 크기 · 컬렉션 페이지 대형 히어로 */
  variant?: "compact" | "featured" | "hero";
  className?: string;
  /** hero 전용: 호버 시 돋보기 렌즈 */
  heroLoupe?: boolean;
}

/**
 * 컬렉션 대표 이미지용 프레임 — 그라데이션 베젤, 이너 매트, 은은한 하이라이트.
 * featured: 중간 크기. hero: 컬렉션 상세 좌측 히어로(더 큼, 3:4 고정).
 */
export function CollectionCoverFrame({
  imageUrl,
  alt = "",
  variant = "compact",
  className = "",
  heroLoupe = false,
}: CollectionCoverFrameProps) {
  const { url: resolved } = useResolvedMediaUrl(imageUrl);
  const isLarge =
    variant === "featured" || variant === "hero";
  const outerPad =
    variant === "hero"
      ? "p-[4px] sm:p-[5px]"
      : variant === "featured"
        ? "p-[3px] sm:p-[4px]"
        : "p-[2px]";
  const innerPad =
    variant === "hero"
      ? "p-2.5 sm:p-3"
      : variant === "featured"
        ? "p-2 sm:p-2.5"
        : "p-1";
  const radiusOuter =
    variant === "hero"
      ? "rounded-[1.35rem]"
      : variant === "featured"
        ? "rounded-[1.15rem]"
        : "rounded-xl";
  const radiusInner =
    variant === "hero"
      ? "rounded-[1.1rem]"
      : variant === "featured"
        ? "rounded-[0.95rem]"
        : "rounded-[0.65rem]";
  const radiusImg =
    variant === "hero" ? "rounded-xl" : variant === "featured" ? "rounded-lg" : "rounded-md";

  /** featured: 목록→상세 중간 / hero: 컬렉션 페이지 중앙 대형 */
  const featuredOuter = "w-full max-w-[165px] sm:max-w-[180px] aspect-[3/4]";
  const heroOuter =
    "w-full max-w-[min(100%,260px)] sm:max-w-[280px] lg:max-w-[300px] aspect-[3/4]";

  const heroGlow =
    variant === "hero"
      ? "shadow-[0_20px_56px_-12px_rgba(0,0,0,0.75),0_0_0_1px_rgba(167,243,208,0.14),0_0_48px_-20px_rgba(52,211,153,0.12)]"
      : "shadow-[0_12px_40px_-8px_rgba(0,0,0,0.65),0_0_0_1px_rgba(167,243,208,0.12)]";

  return (
    <div
      className={`relative ${radiusOuter} ${outerPad} bg-gradient-to-br from-mint/45 via-mint-deep/30 to-gray-950 ${heroGlow} ${
        variant === "hero" ? heroOuter : variant === "featured" ? featuredOuter : ""
      } ${className}`}
    >
      <div
        className={`${radiusInner} bg-gradient-to-b from-gray-800/90 via-[#0c1018] to-[#06080d] ${innerPad} shadow-[inset_0_1px_0_rgba(255,255,255,0.07),inset_0_-1px_0_rgba(0,0,0,0.4)] flex flex-col ${
          isLarge ? "h-full min-h-0" : ""
        }`}
      >
        <div
          className={`relative overflow-hidden bg-[#030508] ring-1 ring-white/[0.07] ${radiusImg} ${
            variant === "compact"
              ? "aspect-[3/4] w-full"
              : "min-h-0 w-full flex-1"
          }`}
        >
          {variant === "hero" && heroLoupe ? (
            <CollectionImageLoupe
              imageUrl={imageUrl}
              alt={alt}
              radiusClass="rounded-none"
              embedInFrame
              className="absolute inset-0 h-full w-full min-h-0"
            />
          ) : (
            <>
              {resolved ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resolved}
                    alt={alt}
                    className="absolute inset-0 h-full w-full object-contain object-center"
                    style={{ filter: "saturate(1.04) contrast(1.02)" }}
                  />
                </>
              ) : (
                <div className="absolute inset-0 bg-gray-900/80 animate-pulse" aria-hidden />
              )}
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-2/5 bg-gradient-to-b from-white/[0.045] to-transparent"
                aria-hidden
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
