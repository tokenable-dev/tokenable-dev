"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  COLLECTION_DETAILS_BG_CLASS,
  COLLECTION_DETAILS_BORDER_ALL,
  COLLECTION_HERO_DESKTOP_HEIGHT_CLASS,
} from "@/components/marketplace/collectionOverviewChrome";
import { useResolvedMediaUrl } from "@/hooks/media";
import { collectionCoverImageStyle } from "@/lib/marketplace/cardhedgerBubbleCoverImage";
import type { CollectionBrowseEntry } from "@/lib/marketplace/collectionBrowseContext";
import { CollectionCoverSwipeLightbox } from "./CollectionCoverSwipeLightbox";

export type CollectionCoverGalleryProps = {
  entries: CollectionBrowseEntry[];
  viewingKey: string;
  currentIndex: number;
  canSwipe: boolean;
  onNext: () => void;
  onPrev: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
};

function CollectionCoverLightbox({
  open,
  resolvedUrl,
  alt,
  onClose,
}: {
  open: boolean;
  resolvedUrl: string | null;
  alt: string;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!mounted || !open || !resolvedUrl) return null;

  return createPortal(
    <button
      type="button"
      role="dialog"
      aria-modal
      aria-label="Collection cover enlarged — tap anywhere to close"
      onClick={onClose}
      className="fixed inset-0 z-[100] flex cursor-default items-center justify-center bg-black/88 p-4 backdrop-blur-[2px] sm:p-8"
    >
      <div
        className={`max-h-[min(92vh,900px)] w-full max-w-[min(96vw,560px)] overflow-hidden rounded-2xl ${COLLECTION_DETAILS_BORDER_ALL} bg-black shadow-[0_28px_80px_-24px_rgba(0,0,0,0.85)] ring-1 ring-black`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolvedUrl}
          alt={alt || "Collection cover"}
          className="max-h-[min(82vh,820px)] w-full object-contain object-center"
          style={collectionCoverImageStyle(resolvedUrl)}
        />
      </div>
    </button>,
    document.body,
  );
}

export interface CollectionCoverFrameProps {
  /** `ipfs://`, `https://…/ipfs/…`, 또는 일반 https — 브라우저는 API로만 해석 */
  imageUrl: string;
  alt?: string;
  /** 목록 썸네일 · 상단 중간 크기 · 컬렉션 페이지 대형 히어로 · flat은 베젤/링 없이 이미지만 */
  variant?: "compact" | "featured" | "hero" | "flat";
  /** Carousel slides: static placeholder while resolving (no pulse — avoids vertical “shake”). */
  quietLoading?: boolean;
  className?: string;
  /** When set (e.g. from Markets browse context), fullscreen cover supports swipe between cards. */
  coverGallery?: CollectionCoverGalleryProps;
}

/**
 * 컬렉션 대표 이미지용 프레임 — 그라데이션 베젤, 이너 매트, 은은한 하이라이트.
 * featured: 중간 크기. hero: 컬렉션 상세 좌측 히어로 — 클릭하면 큰 이미지(라이트박스).
 * flat: 베젤·링 없이 이미지 영역만 (Trending 캐러셀 등).
 */
export function CollectionCoverFrame({
  imageUrl,
  alt = "",
  variant = "compact",
  quietLoading = false,
  className = "",
  coverGallery,
}: CollectionCoverFrameProps) {
  const [activeImageUrl, setActiveImageUrl] = useState(imageUrl);
  const { url: resolved, isLoading } = useResolvedMediaUrl(activeImageUrl);
  const [imgFailed, setImgFailed] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    setActiveImageUrl(imageUrl);
    setImgFailed(false);
    setLightboxOpen(false);
  }, [imageUrl]);

  useEffect(() => {
    setImgFailed(false);
  }, [resolved, activeImageUrl]);

  const handleImageError = () => {
    setImgFailed(true);
  };

  /** Carousel 등 — 그라데이션 베젤·ring 없이 카드 안에 이미지만 채움 */
  if (variant === "flat") {
    return (
      <div className={`relative h-full min-h-0 w-full bg-[#0a0e14] ${className}`}>
        <div className="relative h-full min-h-0 w-full overflow-hidden bg-black">
          {resolved && !imgFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolved}
              alt={alt}
              className="absolute inset-0 h-full w-full object-contain object-center"
              style={collectionCoverImageStyle(resolved)}
              onError={handleImageError}
            />
          ) : imgFailed ? (
            <div
              className="absolute inset-0 flex items-center justify-center px-3 text-center text-[11px] leading-snug text-zinc-500"
              role="img"
              aria-label={alt ? `${alt} (failed to load)` : "Cover image failed to load"}
            >
              Couldn&apos;t load image
            </div>
          ) : isLoading ? (
            <div
              className={`absolute inset-0 bg-gray-900/80 ${quietLoading ? "" : "animate-pulse"}`}
              aria-hidden
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center px-3 text-center text-[11px] text-zinc-600">
              No preview
            </div>
          )}
        </div>
      </div>
    );
  }

  const isLarge =
    variant === "featured" || variant === "hero";
  const outerPad =
    variant === "hero"
      ? "p-0"
      : variant === "featured"
        ? "p-[3px] sm:p-[4px]"
        : "p-[2px]";
  const innerPad =
    variant === "hero"
      ? "p-0"
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
    variant === "hero"
      ? "rounded-none"
      : variant === "featured"
        ? "rounded-lg"
        : "rounded-md";

  /** featured: 목록→상세 중간 / hero: 컬렉션 페이지 중앙 대형 */
  const featuredOuter = "w-full max-w-[165px] sm:max-w-[180px] aspect-[3/4]";
  /**
   * Collection detail hero — thumbnail on mobile (beside title), full column from lg.
   */
  const heroOuter =
    variant === "hero"
      ? `mx-auto w-full max-w-[min(100%,360px)] max-lg:h-[clamp(112px,30vw,128px)] max-lg:max-h-[132px] max-lg:w-[clamp(84px,22.5vw,96px)] max-lg:max-w-[96px] max-lg:shrink-0 lg:mx-0 lg:w-[307px] lg:max-w-full ${COLLECTION_HERO_DESKTOP_HEIGHT_CLASS}`
      : `mx-auto w-full max-w-[min(100%,360px)] h-[min(460px,82vw)] max-h-[min(480px,88svh)] lg:mx-0 lg:w-[307px] lg:max-w-full ${COLLECTION_HERO_DESKTOP_HEIGHT_CLASS}`;

  const heroGlow =
    variant === "hero"
      ? "max-lg:shadow-none lg:shadow-[0_20px_56px_-12px_rgba(0,0,0,0.75),0_0_0_1px_rgba(255,255,255,0.06),0_0_40px_-24px_rgba(0,0,0,0.55)]"
      : "shadow-[0_12px_40px_-8px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.06)]";

  const heroInteractive = variant === "hero";

  const heroFlat =
    variant === "hero"
      ? {
          outer: `${radiusOuter} ${COLLECTION_DETAILS_BG_CLASS} max-lg:shadow-none lg:shadow-[0_0_0_1px_rgba(0,0,0,1)]`,
          inner: `${radiusInner} ${COLLECTION_DETAILS_BG_CLASS} flex min-h-0 flex-1 flex-col`,
        }
      : null;

  const outerClass =
    variant === "hero" && heroFlat
      ? `relative ${heroFlat.outer} ${heroOuter} ${className}`
      : `relative ${radiusOuter} ${outerPad} bg-gradient-to-br from-white/[0.08] via-gray-800/40 to-gray-950 ${heroGlow} ${
          variant === "hero" ? heroOuter : variant === "featured" ? featuredOuter : ""
        } ${className}`;

  const innerClass =
    variant === "hero" && heroFlat
      ? `${heroFlat.inner} ${isLarge ? "h-full min-h-0" : ""}`
      : `${radiusInner} bg-gradient-to-b from-gray-800/90 via-[#0c1018] to-[#06080d] ${innerPad} shadow-[inset_0_1px_0_rgba(255,255,255,0.07),inset_0_-1px_0_rgba(0,0,0,0.4)] flex flex-col ${
          isLarge ? "h-full min-h-0" : ""
        }`;

  const imgShellBg =
    variant === "hero" ? COLLECTION_DETAILS_BG_CLASS : "bg-black";

  return (
    <div className={outerClass}>
      <div className={innerClass}>
        <div
          className={`relative min-h-0 w-full flex-1 overflow-hidden ${imgShellBg} ${
            variant === "hero" ? "" : "ring-1 ring-black"
          } ${radiusImg} ${
            variant === "compact" ? "aspect-[3/4]" : ""
          } ${heroInteractive ? "group/img" : ""}`}
        >
          {resolved && !imgFailed ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolved}
                alt={alt}
                className="absolute inset-0 h-full w-full object-contain object-center"
                style={collectionCoverImageStyle(resolved)}
                onError={handleImageError}
              />
              {heroInteractive ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (coverGallery) coverGallery.onOpenChange(true);
                      else setLightboxOpen(true);
                    }}
                    className="absolute inset-0 z-[2] cursor-pointer bg-transparent outline-none transition-colors hover:bg-black/[0.12] active:bg-black/[0.18]"
                    aria-label="Open collection cover in large view"
                    title="Click to view larger"
                  />
                  <span
                    className="pointer-events-none absolute bottom-2 left-1/2 z-[3] hidden max-w-[90%] -translate-x-1/2 truncate rounded-md bg-black/58 px-2.5 py-1 text-center text-[10px] font-medium text-zinc-100 shadow-md ring-1 ring-black transition-opacity duration-150 max-lg:hidden sm:inline sm:opacity-0 sm:group-hover/img:opacity-100"
                  >
                    Click to enlarge
                  </span>
                </>
              ) : null}
            </>
          ) : imgFailed ? (
            <div
              className="absolute inset-0 flex items-center justify-center px-3 text-center text-[11px] leading-snug text-zinc-500"
              role="img"
              aria-label={alt ? `${alt} (failed to load)` : "Cover image failed to load"}
            >
              Couldn&apos;t load image
            </div>
          ) : isLoading ? (
            <div className="absolute inset-0 bg-gray-900/80 animate-pulse" aria-hidden />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center px-3 text-center text-[11px] text-zinc-600">
              No preview
            </div>
          )}
          {variant !== "hero" ? (
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-2/5 bg-gradient-to-b from-white/[0.045] to-transparent"
              aria-hidden
            />
          ) : null}
        </div>
      </div>
      {coverGallery?.canSwipe ? (
        <CollectionCoverSwipeLightbox
          open={coverGallery.open}
          entries={coverGallery.entries}
          viewingKey={coverGallery.viewingKey}
          currentIndex={coverGallery.currentIndex}
          canSwipe={coverGallery.canSwipe}
          onClose={coverGallery.onClose}
          onNext={coverGallery.onNext}
          onPrev={coverGallery.onPrev}
        />
      ) : (
        <CollectionCoverLightbox
          open={lightboxOpen && heroInteractive && Boolean(resolved) && !imgFailed}
          resolvedUrl={resolved}
          alt={alt}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}
