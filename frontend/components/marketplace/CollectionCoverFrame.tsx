"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useResolvedMediaUrl } from "@/hooks/useResolvedMediaUrl";

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
    <div
      role="dialog"
      aria-modal
      aria-label="Collection cover enlarged"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 sm:p-8"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/88 backdrop-blur-[2px]"
        aria-label="Close enlarged image"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[min(92vh,900px)] w-full max-w-[min(96vw,560px)] flex-col gap-3">
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.12] bg-[#0a0d12] shadow-[0_28px_80px_-24px_rgba(0,0,0,0.85)] ring-1 ring-white/[0.06]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolvedUrl}
            alt={alt || "Collection cover"}
            className="max-h-[min(82vh,820px)] w-full object-contain object-center"
            style={{ filter: "saturate(1.04) contrast(1.02)" }}
          />
        </div>
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-600/90 bg-zinc-900/90 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-800 hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export interface CollectionCoverFrameProps {
  /** `ipfs://`, `https://…/ipfs/…`, 또는 일반 https — 브라우저는 API로만 해석 */
  imageUrl: string;
  alt?: string;
  /** 목록 썸네일 · 상단 중간 크기 · 컬렉션 페이지 대형 히어로 */
  variant?: "compact" | "featured" | "hero";
  className?: string;
}

/**
 * 컬렉션 대표 이미지용 프레임 — 그라데이션 베젤, 이너 매트, 은은한 하이라이트.
 * featured: 중간 크기. hero: 컬렉션 상세 좌측 히어로 — 클릭하면 큰 이미지(라이트박스).
 */
export function CollectionCoverFrame({
  imageUrl,
  alt = "",
  variant = "compact",
  className = "",
}: CollectionCoverFrameProps) {
  const { url: resolved } = useResolvedMediaUrl(imageUrl);
  const [lightboxOpen, setLightboxOpen] = useState(false);
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
    "w-full max-w-[min(100%,340px)] sm:max-w-[min(100%,376px)] lg:max-w-[min(400px,36vw)] xl:max-w-[min(420px,32vw)] aspect-[3/4]";

  const heroGlow =
    variant === "hero"
      ? "shadow-[0_20px_56px_-12px_rgba(0,0,0,0.75),0_0_0_1px_rgba(255,255,255,0.06),0_0_40px_-24px_rgba(0,0,0,0.55)]"
      : "shadow-[0_12px_40px_-8px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.06)]";

  const heroInteractive = variant === "hero";

  return (
    <div
      className={`relative ${radiusOuter} ${outerPad} bg-gradient-to-br from-white/[0.08] via-gray-800/40 to-gray-950 ${heroGlow} ${
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
          } ${heroInteractive ? "group/img" : ""}`}
        >
          {resolved ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolved}
                alt={alt}
                className="absolute inset-0 h-full w-full object-contain object-center"
                style={{ filter: "saturate(1.04) contrast(1.02)" }}
              />
              {heroInteractive ? (
                <>
                  <button
                    type="button"
                    onClick={() => setLightboxOpen(true)}
                    className="absolute inset-0 z-[2] cursor-pointer bg-transparent outline-none transition-colors hover:bg-black/[0.12] active:bg-black/[0.18] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500/65"
                    aria-label="Open collection cover in large view"
                    title="Click to view larger"
                  />
                  <span
                    className="pointer-events-none absolute bottom-2 left-1/2 z-[3] hidden max-w-[90%] -translate-x-1/2 truncate rounded-md bg-black/58 px-2.5 py-1 text-center text-[10px] font-medium text-zinc-100 shadow-md ring-1 ring-white/10 transition-opacity duration-150 sm:inline sm:opacity-0 sm:group-hover/img:opacity-100"
                  >
                    Click to enlarge
                  </span>
                  <span
                    className="pointer-events-none absolute bottom-2 left-1/2 z-[3] inline max-w-[90%] -translate-x-1/2 truncate rounded-md bg-black/58 px-2 py-0.5 text-center text-[9px] font-medium text-zinc-100/95 shadow-sm ring-1 ring-white/10 sm:hidden"
                  >
                    Tap to enlarge
                  </span>
                  <div
                    className="pointer-events-none absolute bottom-1.5 right-1.5 z-[6] flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-black/45 text-white/70 shadow-sm backdrop-blur-sm"
                    aria-hidden
                    title="Click or tap for larger view"
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      aria-hidden
                    >
                      <circle cx="11" cy="11" r="6" />
                      <path d="M16 16l5 5" />
                    </svg>
                  </div>
                </>
              ) : null}
            </>
          ) : (
            <div className="absolute inset-0 bg-gray-900/80 animate-pulse" aria-hidden />
          )}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-2/5 bg-gradient-to-b from-white/[0.045] to-transparent"
            aria-hidden
          />
        </div>
      </div>
      <CollectionCoverLightbox
        open={lightboxOpen && heroInteractive && Boolean(resolved)}
        resolvedUrl={resolved}
        alt={alt}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}
