"use client";

import type { ReactNode } from "react";
import { RwaImageLightbox } from "@/components/common";
import { SlabCardFlip } from "@/components/marketplace/marketplace-shared";
import { SlabPauseGlyph, SlabPlayGlyph } from "../ui/SlabControlGlyphs";
import { SlabBackPlaceholder } from "./slabBackPlaceholder";
import type { useRwaDetailSlabPanel } from "@/hooks/rwa-detail-asset-panel";

type SlabPanel = ReturnType<typeof useRwaDetailSlabPanel>;

export function RwaDetailSlabSection({
  imageUrl,
  openSeaMobile,
  mobileHeroTradingSlot,
  slab,
}: {
  imageUrl: string | null;
  openSeaMobile?: boolean;
  mobileHeroTradingSlot?: ReactNode;
  slab: SlabPanel;
}) {
  const {
    lightboxOpen,
    setLightboxOpen,
    slabAltCaption,
    slabImageTitle,
    effectiveBackUrl,
    hasBackFace,
    setSlabSide,
    flipAngle,
    setFlipAngle,
    slabAutoRotateOn,
    setSlabAutoRotateOn,
    useFlipSlab,
    showSlabSidePicker,
    showSlabFront,
    showFrontFlipTab,
    frontHeroLoading,
    backHeroLoading,
    slabHeroSizing,
    slabThumbSize,
    slabThumbMinH,
    slabControlsGap,
    slabRotateGlyphWrap,
    slabRotateGlyph,
  } = slab;

  return (
    <div
      className={`min-w-0 ${
        openSeaMobile
          ? "max-lg:order-none max-lg:w-full max-lg:items-center max-lg:space-y-0 lg:order-none lg:space-y-3"
          : "space-y-3 max-xl:order-1 lg:order-none"
      }`}
    >
      <div
        className={
          openSeaMobile
            ? "flex w-full min-w-0 flex-col items-center gap-3 max-lg:shrink-0 lg:contents"
            : mobileHeroTradingSlot
              ? "max-xl:grid max-xl:grid-cols-[minmax(0,1fr)_minmax(112px,34%)] max-xl:items-start max-xl:gap-3 sm:max-xl:gap-3.5"
              : ""
        }
      >
        <div
          className={`${slabHeroSizing} bg-transparent ${openSeaMobile ? "max-lg:shrink-0" : ""}`}
        >
          {useFlipSlab ? (
            <>
              <div
                className={`${slabHeroSizing} ${
                  openSeaMobile ? "max-lg:bg-transparent" : "bg-[#030508]"
                }`}
              >
                {frontHeroLoading ? (
                  <div className="absolute inset-0 animate-pulse rounded-2xl bg-gray-800/80" />
                ) : imageUrl ? (
                  <SlabCardFlip
                    frontSrc={imageUrl}
                    backSrc={effectiveBackUrl}
                    backLoading={backHeroLoading}
                    altFront={`${slabAltCaption} — slab front`}
                    altBack={`${slabAltCaption} — slab back`}
                    backPlaceholder={<SlabBackPlaceholder />}
                    angleDeg={flipAngle}
                    onAngleChange={setFlipAngle}
                    autoSweepEnabled={Boolean(
                      hasBackFace && !backHeroLoading && slabAutoRotateOn,
                    )}
                    onAutoSweepUserGesture={() => setSlabAutoRotateOn(false)}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-[#030508] text-sm text-gray-600">
                    No image
                  </div>
                )}
              </div>
              {!openSeaMobile ? (
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-2/5 rounded-t-2xl bg-gradient-to-b from-white/[0.04] to-transparent"
                  aria-hidden
                />
              ) : null}
            </>
          ) : frontHeroLoading ? (
            <div className="absolute inset-0 rounded-2xl bg-gray-800/80 animate-pulse" />
          ) : imageUrl ? (
            <>
              <div
                className={`group/img relative h-full min-h-0 w-full overflow-hidden ${
                  openSeaMobile
                    ? "max-lg:rounded-none max-lg:bg-transparent lg:aspect-[3/4] lg:rounded-2xl lg:bg-[#030508]"
                    : `${slabHeroSizing} bg-[#030508]`
                }`}
              >
                {showSlabFront ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt={`${slabImageTitle} — slab front`}
                      className="h-full w-full min-h-0 object-contain object-center"
                      draggable={false}
                      referrerPolicy="no-referrer"
                    />
                    <button
                      type="button"
                      onClick={() => setLightboxOpen(true)}
                      className="absolute inset-0 z-[2] cursor-pointer bg-transparent outline-none transition-colors hover:bg-black/[0.12] active:bg-black/[0.18]"
                      aria-label="View enlarged slab front"
                      title="Tap to enlarge"
                    />
                    <span className="pointer-events-none absolute bottom-2 left-1/2 z-[3] max-w-[90%] -translate-x-1/2 truncate rounded-md bg-black/58 px-2 py-0.5 text-center text-[9px] font-medium text-zinc-100/95 sm:text-[10px]">
                      Tap to enlarge
                    </span>
                  </>
                ) : backHeroLoading ? (
                  <div className="absolute inset-0 animate-pulse rounded-2xl bg-gray-800/80" />
                ) : effectiveBackUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={effectiveBackUrl}
                      alt={`${slabImageTitle} — slab back`}
                      className="h-full w-full min-h-0 object-contain object-center"
                      draggable={false}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    <button
                      type="button"
                      onClick={() => setLightboxOpen(true)}
                      className="absolute inset-0 z-[2] cursor-pointer bg-transparent outline-none transition-colors hover:bg-black/[0.12] active:bg-black/[0.18]"
                      aria-label="View enlarged slab back"
                      title="Tap to enlarge"
                    />
                    <span className="pointer-events-none absolute bottom-2 left-1/2 z-[3] max-w-[90%] -translate-x-1/2 truncate rounded-md bg-black/58 px-2 py-0.5 text-center text-[9px] font-medium text-zinc-100/95 sm:text-[10px]">
                      Tap to enlarge
                    </span>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center text-sm text-gray-500">
                    <SlabBackPlaceholder />
                  </div>
                )}
              </div>
              {!openSeaMobile ? (
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-2/5 rounded-t-2xl bg-gradient-to-b from-white/[0.04] to-transparent"
                  aria-hidden
                />
              ) : null}
              <RwaImageLightbox
                open={lightboxOpen}
                src={showSlabFront ? imageUrl : effectiveBackUrl ?? imageUrl}
                alt={
                  showSlabFront
                    ? `${slabImageTitle} — slab front`
                    : `${slabImageTitle} — slab back`
                }
                onClose={() => setLightboxOpen(false)}
              />
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-[#030508] text-sm text-gray-600">
              No image
            </div>
          )}
        </div>

        {mobileHeroTradingSlot && !openSeaMobile ? (
          <div className="flex min-w-0 flex-col justify-end gap-3 max-xl:pt-1 lg:hidden">
            {mobileHeroTradingSlot}
          </div>
        ) : null}

        {showSlabSidePicker ? (
          <div
            className={`${slabControlsGap} ${
              openSeaMobile
                ? "relative z-[1] max-lg:w-full max-lg:border-t max-lg:border-zinc-800/50"
                : ""
            }`}
            role="group"
            aria-label="Slab front and back"
          >
            <div
              className={`flex ${openSeaMobile ? "gap-2 max-xl:gap-2 lg:gap-2.5" : "gap-2.5"}`}
              role="tablist"
              aria-label="Slab photo side"
            >
              <button
                type="button"
                role="tab"
                aria-selected={showFrontFlipTab}
                aria-label={`${slabAltCaption} — show slab front`}
                title="Slab front"
                onClick={() => {
                  setSlabAutoRotateOn(false);
                  setSlabSide("front");
                  setFlipAngle(0);
                }}
                className={`${slabThumbSize} transition-colors ${
                  showFrontFlipTab
                    ? "border-mint/65 bg-mint/10 ring-1 ring-mint/25 max-xl:ring-1 lg:ring-2"
                    : "border-gray-700/90 bg-black/40 opacity-85 hover:border-gray-500 hover:opacity-100"
                }`}
              >
                {frontHeroLoading ? (
                  <span
                    className={`block h-full ${slabThumbMinH} w-full animate-pulse bg-gray-800`}
                    aria-hidden
                  />
                ) : imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element -- tab preview */
                  <img
                    src={imageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    draggable={false}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span
                    className={`flex ${slabThumbMinH} w-full items-center justify-center bg-[#0a0f16] text-[9px] text-zinc-600 max-xl:text-[9px]`}
                  >
                    —
                  </span>
                )}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={!showFrontFlipTab}
                aria-label={`${slabAltCaption} — show slab back`}
                title="Slab back"
                onClick={() => {
                  setSlabAutoRotateOn(false);
                  setSlabSide("back");
                  setFlipAngle(180);
                }}
                className={`${slabThumbSize} transition-colors ${
                  !showFrontFlipTab
                    ? "border-mint/65 bg-mint/10 ring-1 ring-mint/25 max-xl:ring-1 lg:ring-2"
                    : "border-gray-700/90 bg-black/40 opacity-85 hover:border-gray-500 hover:opacity-100"
                }`}
              >
                {backHeroLoading ? (
                  <span
                    className={`block h-full ${slabThumbMinH} w-full animate-pulse bg-gray-800`}
                    aria-hidden
                  />
                ) : effectiveBackUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element -- tab preview */
                  <img
                    src={effectiveBackUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    draggable={false}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span
                    className={`flex ${slabThumbMinH} w-full flex-col items-center justify-center gap-0.5 bg-[#0a0f16] px-0.5 text-center`}
                  >
                    <span className="text-[8px] leading-tight text-zinc-500 max-xl:text-[8px] lg:text-[9px]">
                      No rear
                    </span>
                  </span>
                )}
              </button>
            </div>
            {useFlipSlab && hasBackFace && !backHeroLoading && imageUrl && !frontHeroLoading ? (
              <button
                type="button"
                aria-pressed={slabAutoRotateOn}
                className={`group ${slabThumbSize} bg-black/35 shadow-[0_4px_14px_-8px_rgba(0,0,0,0.75)] transition max-xl:shadow-[0_4px_12px_-8px_rgba(0,0,0,0.7)] lg:shadow-[0_6px_20px_-10px_rgba(0,0,0,0.75)] ${
                  slabAutoRotateOn
                    ? "border-mint/40 ring-1 ring-mint/15 hover:border-mint/55 hover:ring-mint/25"
                    : "border-mint/55 ring-1 ring-mint/20 hover:border-mint/80 hover:ring-mint/35"
                }`}
                onClick={() => setSlabAutoRotateOn((on) => !on)}
                aria-label={
                  slabAutoRotateOn
                    ? `${slabAltCaption} — pause auto slab rotation`
                    : `${slabAltCaption} — resume auto slab rotation`
                }
                title={slabAutoRotateOn ? "Pause auto rotate" : "Resume auto rotate"}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- rotate control preview */}
                <img
                  src={imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  draggable={false}
                  referrerPolicy="no-referrer"
                />
                <span
                  className={`absolute inset-0 flex items-center justify-center transition ${
                    slabAutoRotateOn
                      ? "bg-black/26 group-hover:bg-black/18"
                      : "bg-black/40 group-hover:bg-black/32"
                  }`}
                >
                  <span className={slabRotateGlyphWrap}>
                    {slabAutoRotateOn ? (
                      <SlabPauseGlyph className={slabRotateGlyph} />
                    ) : (
                      <SlabPlayGlyph className={`${slabRotateGlyph} translate-x-[1px]`} />
                    )}
                  </span>
                </span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
