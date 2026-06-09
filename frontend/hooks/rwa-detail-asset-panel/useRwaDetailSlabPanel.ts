"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { postResolveMediaUrls, rq, marketplaceRqPolicy } from "@/lib/core";
import {
  assetDetailHeadlineHasContent,
  buildRwaAssetDetailHeadlineParts,
  formatAssetDetailHeadlineText,
} from "@/lib/marketplace/assetDetailHeadline";
import { displayAssetNameFromMetadata } from "@/lib/marketplace/rwaDisplayTitle";
import {
  extractGradedSlabBackCandidate,
  getRwaDetailHeaderBadgeLabels,
  type RwaDetailMetadata,
} from "@/lib/marketplace/rwa-detail";
import { SLAB_3D_UI_ENABLED } from "@/lib/marketplace/rwa-detail";

export function useRwaDetailSlabPanel(input: {
  metadata: RwaDetailMetadata | null;
  imageUrl: string | null;
  tokenId: number;
  collectionLabel: string;
  metaLoading?: boolean;
  openSeaMobile?: boolean;
}) {
  const { metadata, imageUrl, tokenId, collectionLabel, metaLoading, openSeaMobile = false } =
    input;

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const headlineFallback = `${collectionLabel} #${tokenId}`;
  const headlineParts = useMemo(
    () => buildRwaAssetDetailHeadlineParts(metadata, headlineFallback),
    [metadata, headlineFallback],
  );
  const slabAltCaption =
    typeof metadata?.name === "string" && metadata.name.trim()
      ? displayAssetNameFromMetadata(metadata, `${collectionLabel} #${tokenId}`)
      : `${collectionLabel} #${tokenId}`;
  const slabImageTitle = formatAssetDetailHeadlineText(headlineParts) || slabAltCaption;
  const headerBadgeFields = useMemo(
    () => getRwaDetailHeaderBadgeLabels(metadata),
    [metadata],
  );

  const backCandidate = useMemo(() => extractGradedSlabBackCandidate(metadata), [metadata]);
  const backNeedsGateway = Boolean(
    backCandidate?.startsWith("ipfs://") || backCandidate?.startsWith("ipfs:/"),
  );

  const { data: backResolved, isFetching: backResolving } = useQuery({
    queryKey: rq.rwaSlabBack(backCandidate ?? ""),
    queryFn: () => postResolveMediaUrls([backCandidate!]),
    enabled: Boolean(backCandidate && backNeedsGateway),
    staleTime: marketplaceRqPolicy.mediaStaleMs,
  });

  const effectiveBackUrl = useMemo(() => {
    if (!backCandidate) return null;
    if (/^https?:\/\//i.test(backCandidate)) return backCandidate;
    if (!backNeedsGateway) return null;
    return backResolved?.items?.[0]?.httpsUrl ?? null;
  }, [backCandidate, backNeedsGateway, backResolved?.items]);

  const hasBackFace = Boolean(effectiveBackUrl);
  const [slabSide, setSlabSide] = useState<"front" | "back">("front");
  const [flipAngle, setFlipAngle] = useState(0);
  const [slabAutoRotateOn, setSlabAutoRotateOn] = useState(false);
  const useFlipSlab = SLAB_3D_UI_ENABLED && Boolean(backCandidate);
  const showSlabSidePicker = Boolean(backCandidate) && !openSeaMobile;
  const showSlabFront = slabSide === "front";

  useEffect(() => {
    setSlabSide("front");
    setFlipAngle(0);
    setSlabAutoRotateOn(false);
    setLightboxOpen(false);
  }, [tokenId, backCandidate, imageUrl]);

  useEffect(() => {
    if (slabSide === "back" && !hasBackFace && !backResolving) {
      setSlabSide("front");
      setFlipAngle(0);
    }
  }, [slabSide, hasBackFace, backResolving]);

  const showFrontFlipTab = useFlipSlab ? flipAngle < 90 : showSlabFront;

  const frontHeroLoading = Boolean(metaLoading && !imageUrl);
  const backHeroLoading = Boolean(backNeedsGateway) && backResolving;

  const slabHeroSizing = openSeaMobile
    ? "relative mx-auto w-full max-w-[min(100%,300px)] shrink-0 max-lg:overflow-visible max-lg:rounded-none max-lg:bg-transparent sm:max-w-[min(100%,320px)] lg:aspect-[3/4] lg:max-h-[min(72vh,680px)] lg:max-w-none lg:overflow-visible lg:rounded-2xl lg:bg-[#030508]"

  /** Full slab visible (object-contain) — capped to prior hero footprint without clipping. */
  const openSeaMobileSlabImgCls =
    "mx-auto block h-auto w-full max-h-[min(44vh,300px)] max-w-full object-contain object-center lg:h-full lg:w-full lg:max-h-none lg:min-h-0"
    : "relative mx-auto aspect-[3/4] w-full max-w-[min(100%,340px)] overflow-visible rounded-xl max-h-[min(62vh,560px)] sm:max-w-[min(100%,380px)] sm:rounded-2xl sm:max-h-[min(68vh,620px)] lg:max-w-none lg:max-h-[min(72vh,680px)]";

  const slabThumbSize = openSeaMobile
    ? "relative aspect-[3/4] w-10 shrink-0 overflow-hidden rounded-md border-2 max-xl:rounded-md lg:w-14 lg:rounded-lg"
    : "relative aspect-[3/4] w-14 shrink-0 overflow-hidden rounded-lg border-2";

  const slabThumbMinH = openSeaMobile
    ? "min-h-[2.75rem] max-xl:min-h-[2.75rem] lg:min-h-[4.5rem]"
    : "min-h-[4.5rem]";

  const slabControlsGap = openSeaMobile
    ? "mt-3 flex w-full shrink-0 flex-wrap items-center justify-center gap-2.5 max-lg:min-h-[3rem] max-lg:px-5 max-lg:pb-2 max-lg:pt-2 lg:mt-4 lg:items-end lg:gap-3 lg:px-0 lg:pb-0 lg:pt-0"
    : "mt-4 flex w-full flex-wrap items-end justify-center gap-3 sm:mt-5 sm:gap-4";

  const slabRotateGlyphWrap = openSeaMobile
    ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/95 shadow-md ring-1 ring-black/45 max-xl:h-6 max-xl:w-6 lg:h-8 lg:w-8"
    : "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/95 shadow-md ring-1 ring-black/45";

  const slabRotateGlyph = openSeaMobile
    ? "h-3 w-3 text-[#0a1210] max-xl:h-3 max-xl:w-3 lg:h-3.5 lg:w-3.5"
    : "h-3.5 w-3.5 text-[#0a1210]";

  const headerRowPulse =
    Boolean(metaLoading) && !headerBadgeFields.category && !headerBadgeFields.gradeLine;
  const titlePulse =
    Boolean(metaLoading) &&
    !metadata?.name?.trim() &&
    !assetDetailHeadlineHasContent(headlineParts);

  return {
    lightboxOpen,
    setLightboxOpen,
    headlineParts,
    slabAltCaption,
    slabImageTitle,
    backCandidate,
    effectiveBackUrl,
    hasBackFace,
    slabSide,
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
    openSeaMobileSlabImgCls,
    slabThumbSize,
    slabThumbMinH,
    slabControlsGap,
    slabRotateGlyphWrap,
    slabRotateGlyph,
    headerRowPulse,
    titlePulse,
  };
}
