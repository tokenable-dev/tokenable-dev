"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { RwaImageLightbox } from "@/components/common";
import { postResolveMediaUrls } from "@/lib/core";
import { formatSportCategoryDisplayLabel } from "@/lib/market";
import { displayAssetNameFromMetadata } from "@/lib/marketplace/rwaDisplayTitle";
import { SlabCardFlip } from "./SlabCardFlip";

function extractGradedSlabBackCandidate(meta: RwaDetailMetadata | null): string | null {
  if (!meta?.properties?.graded || typeof meta.properties.graded !== "object") return null;
  const graded = meta.properties.graded as Record<string, unknown>;
  const psa =
    graded.psa && typeof graded.psa === "object"
      ? (graded.psa as Record<string, unknown>)
      : null;
  const fromPsa = typeof psa?.certImageBackUrl === "string" ? psa.certImageBackUrl.trim() : "";
  if (fromPsa) return fromPsa;
  const verification =
    graded.verification && typeof graded.verification === "object"
      ? (graded.verification as Record<string, unknown>)
      : null;
  const slabBack =
    typeof verification?.slabBack === "string" ? verification.slabBack.trim() : "";
  return slabBack || null;
}

function pickString(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (v == null || v === "") continue;
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
    if (typeof v === "string") {
      const t = v.trim();
      if (t) return t;
    }
  }
  return undefined;
}

export type RwaDetailMetadata = {
  name?: string;
  description?: string;
  external_url?: string;
  image?: string;
  attributes?: Array<{ trait_type: string; value: string }>;
  properties?: Record<string, unknown>;
};

/**
 * `properties.graded` + attributes에서 카드 상세 그리드용 필드 추출 (desktop Details).
 */
export function buildRwaDetailStatRows(meta: RwaDetailMetadata | null): {
  label: string;
  value: string;
}[] {
  if (!meta) return [];
  const graded = meta.properties?.graded as Record<string, unknown> | undefined;
  const psa = graded?.psa as Record<string, unknown> | undefined;
  const card = graded?.card as Record<string, unknown> | undefined;
  const grade = graded?.grade as Record<string, unknown> | undefined;

  const rows: { label: string; value: string }[] = [];

  const player = pickString(card?.player, card?.name, psa?.cardNameHint);
  const set = pickString(card?.set, psa?.setHint);
  const num = pickString(card?.number, psa?.cardNumberHint);
  const variant = pickString(psa?.gradeDescription, psa?.labelType);
  const gradeLabel = pickString(
    psa?.gradeLabel,
    typeof grade?.label === "string" ? grade.label : undefined,
  );
  const cert = pickString(psa?.certNumber, grade?.certNumber);
  const year = pickString(psa?.year, card?.year);
  const category = pickString(psa?.category);

  if (player) rows.push({ label: "Player", value: player });
  if (num) {
    rows.push({
      label: "Card Number",
      value: String(num).startsWith("#") ? String(num) : `#${num}`,
    });
  }
  if (set) rows.push({ label: "Set", value: set });
  if (variant && variant !== gradeLabel) rows.push({ label: "Variant", value: variant });
  if (gradeLabel) rows.push({ label: "Grade", value: gradeLabel });
  if (year) rows.push({ label: "Year", value: year });
  if (category) {
    rows.push({
      label: "Category",
      value: formatSportCategoryDisplayLabel(category),
    });
  }
  if (cert) rows.push({ label: "Cert #", value: cert });

  if (rows.length >= 2) return rows.slice(0, 8);

  const attrs = meta.attributes ?? [];
  for (const a of attrs) {
    if (rows.length >= 8) break;
    if (!a?.trait_type) continue;
    const skip = new Set([
      "Grading Company",
      "Grade",
      "Cert Number",
      "Certification",
    ]);
    if (skip.has(a.trait_type)) continue;
    const v = String(a.value ?? "").trim();
    if (!v) continue;
    if (rows.some((r) => r.label === a.trait_type && r.value === v)) continue;
    rows.push({ label: a.trait_type, value: v });
  }

  return rows;
}

export type RwaDetailMobileTrustView = {
  gradeLine: string | null;
  population: number | null;
  populationHigher: number | null;
  certNumber: string | null;
  certVerifyUrl: string | null;
};

/** Mobile card detail — Grade / Pop / Cert trust strip fields. */
export function buildRwaDetailMobileTrustView(
  meta: RwaDetailMetadata | null,
): RwaDetailMobileTrustView {
  const empty: RwaDetailMobileTrustView = {
    gradeLine: null,
    population: null,
    populationHigher: null,
    certNumber: null,
    certVerifyUrl: null,
  };
  if (!meta) return empty;

  const graded = meta.properties?.graded as Record<string, unknown> | undefined;
  const psa = graded?.psa as Record<string, unknown> | undefined;
  const grade = graded?.grade as Record<string, unknown> | undefined;
  const verification =
    graded?.verification && typeof graded.verification === "object"
      ? (graded.verification as Record<string, unknown>)
      : undefined;

  const { gradeLine } = pickHeaderCategoryGrade(meta);

  const popRaw = psa?.totalPopulation;
  const population =
    typeof popRaw === "number" && Number.isFinite(popRaw) && popRaw > 0
      ? popRaw
      : null;

  const higherRaw = psa?.populationHigher;
  const populationHigher =
    typeof higherRaw === "number" && Number.isFinite(higherRaw) && higherRaw >= 0
      ? higherRaw
      : null;

  const certNumber = pickString(psa?.certNumber, grade?.certNumber);
  const certVerifyUrl = pickString(psa?.certVerifyUrl, verification?.certUrl);

  return {
    gradeLine: gradeLine?.trim() ? gradeLine : null,
    population,
    populationHigher,
    certNumber: certNumber ?? null,
    certVerifyUrl: certVerifyUrl ?? null,
  };
}

/** 카드 헤더용: 연도 · 세트 · | · 카드번호 (참조 UI 형태). */
export function formatRwaSetHeadline(meta: RwaDetailMetadata | null): string | null {
  if (!meta) return null;
  const graded = meta.properties?.graded as Record<string, unknown> | undefined;
  const psa = graded?.psa as Record<string, unknown> | undefined;
  const card = graded?.card as Record<string, unknown> | undefined;
  const numRaw = pickString(card?.number, psa?.cardNumberHint);
  const set = pickString(card?.set, psa?.setHint);
  const year = pickString(psa?.year, card?.year);
  let left = "";
  if (year && set) left = `${year} ${set}`;
  else left = pickString(year, set) ?? "";
  left = left.trim();

  let numFormatted: string | null = null;
  if (numRaw) {
    const s = String(numRaw).trim();
    numFormatted = s.startsWith("#") ? s : `#${s}`;
  }

  if (left && numFormatted) return `${left} | ${numFormatted}`;
  if (left) return left;
  if (numFormatted) return numFormatted;

  if (meta.attributes?.length) {
    let setAttr: string | undefined;
    let numAttr: string | undefined;
    for (const a of meta.attributes) {
      const tt = (a.trait_type ?? "").trim().toLowerCase();
      const v = String(a.value ?? "").trim();
      if (!v) continue;
      if (tt === "set") setAttr = v;
      const numish =
        tt === "card number" ||
        tt === "card #" ||
        tt === "card no" ||
        tt === "#" ||
        tt === "number";
      if (numish)
        numAttr = v.startsWith("#") ? v : `#${v}`;
    }
    if (setAttr && numAttr) return `${setAttr} | ${numAttr}`;
    return pickString(setAttr, numAttr) ?? null;
  }
  return null;
}

/** Mobile card header — full set line (year + set), without card number. */
export function formatRwaDetailSetDescription(
  meta: RwaDetailMetadata | null,
): string | null {
  if (!meta) return null;
  const graded = meta.properties?.graded as Record<string, unknown> | undefined;
  const psa = graded?.psa as Record<string, unknown> | undefined;
  const card = graded?.card as Record<string, unknown> | undefined;
  const year = pickString(psa?.year, card?.year);
  const set = pickString(card?.set, psa?.setHint);
  if (year && set) return `${year} ${set}`;
  const one = pickString(set, year);
  if (one) return one;
  const desc = typeof meta.description === "string" ? meta.description.trim() : "";
  return desc.length > 0 ? desc : null;
}

/** Mobile card header — catalog id line (e.g. #SV P85). */
export function formatRwaDetailCardIdLine(
  meta: RwaDetailMetadata | null,
): string | null {
  if (!meta) return null;
  const graded = meta.properties?.graded as Record<string, unknown> | undefined;
  const psa = graded?.psa as Record<string, unknown> | undefined;
  const card = graded?.card as Record<string, unknown> | undefined;
  const numRaw = pickString(card?.number, psa?.cardNumberHint);
  if (!numRaw) return null;
  const raw = numRaw;
  const s = String(raw).trim();
  return s.startsWith("#") ? s : `#${s}`;
}

/** 카테고리(예: Pokemon) · 등급(예: PSA 10) 우선 헤더 배지. */
function pickHeaderCategoryGrade(
  meta: RwaDetailMetadata | null,
): {
  category: string | null;
  gradeLine: string | null;
} {
  if (!meta) return { category: null, gradeLine: null };
  const graded = meta.properties?.graded as Record<string, unknown> | undefined;
  const psa = graded?.psa as Record<string, unknown> | undefined;
  const grade = graded?.grade as Record<string, unknown> | undefined;

  let category =
    pickString(psa?.category) ??
    (typeof graded?.sport === "string" ? graded.sport.trim() : undefined);

  const company = pickString(
    typeof psa?.company === "string" ? psa.company.trim() : undefined,
  );
  let gradeLabel = pickString(
    psa?.gradeLabel,
    typeof grade?.label === "string" ? String(grade.label).trim() : undefined,
  );

  let gradeLine: string | null = null;
  if (gradeLabel) {
    const g = gradeLabel.trim();
    if (/^psa\s/i.test(g)) gradeLine = g.toUpperCase();
    else if (company) gradeLine = `${company} ${g}`.trim();
    else gradeLine = g;
  }

  let catOut = category?.trim() ?? null;
  let gradeOut = gradeLine?.trim() ?? null;

  for (const a of meta.attributes ?? []) {
    const trait = (a.trait_type ?? "").trim();
    const tl = trait.toLowerCase();
    const v = String(a.value ?? "").trim();
    if (!v) continue;
    if (!catOut && /^(category|game|type)$/i.test(tl)) catOut = v;
    if (
      !gradeOut &&
      (/^grade$/i.test(tl) || /^psa(\s|$)/i.test(trait))
    )
      gradeOut = v;
  }

  return {
    category: catOut?.length
      ? formatSportCategoryDisplayLabel(catOut)
      : null,
    gradeLine: gradeOut?.length ? gradeOut : null,
  };
}

/** Filled triangle — resume auto slab rotation. */
function SlabPlayGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7-11-7z" />
    </svg>
  );
}

/** Pause bars — pause auto slab rotation while running. */
function SlabPauseGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

export interface RwaDetailAssetPanelProps {
  metadata: RwaDetailMetadata | null;
  imageUrl: string | null;
  tokenId: number;
  collectionLabel: string;
  metaLoading?: boolean;
  /** Below slab on mobile; above slab on lg+ when set. */
  priceMetricsSlot?: ReactNode;
  /** Price + buy CTA beside slab on mobile (`max-xl` only). */
  mobileHeroTradingSlot?: ReactNode;
  /** When true, title + badge row are hidden from `lg` up (show in sticky column beside slab). */
  hideHeaderOnXl?: boolean;
  /** Mobile: full-bleed hero + identity/purchase rendered by parent (OpenSea-style). */
  openSeaMobile?: boolean;
}

/**
 * 마켓플레이스 RWA 상세 — 카드 메타·슬랩·스탯
 */
export function RwaDetailAssetPanel({
  metadata,
  imageUrl,
  tokenId,
  collectionLabel,
  metaLoading,
  priceMetricsSlot,
  mobileHeroTradingSlot,
  hideHeaderOnXl = false,
  openSeaMobile = false,
}: RwaDetailAssetPanelProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const title =
    displayAssetNameFromMetadata(
      metadata,
      `${collectionLabel} #${tokenId}`,
    );
  const slabAltCaption =
    typeof metadata?.name === "string" && metadata.name.trim()
      ? displayAssetNameFromMetadata(
          metadata,
          `${collectionLabel} #${tokenId}`,
        )
      : `${collectionLabel} #${tokenId}`;
  const setHeadline = useMemo(() => formatRwaSetHeadline(metadata), [metadata]);
  const { category: headerCategory, gradeLine: headerGradeLine } = useMemo(
    () => pickHeaderCategoryGrade(metadata),
    [metadata],
  );

  const backCandidate = useMemo(() => extractGradedSlabBackCandidate(metadata), [metadata]);

  const backNeedsGateway = Boolean(
    backCandidate?.startsWith("ipfs://") || backCandidate?.startsWith("ipfs:/"),
  );

  const { data: backResolved, isFetching: backResolving } = useQuery({
    queryKey: ["rwa-detail-slab-back", backCandidate],
    queryFn: () => postResolveMediaUrls([backCandidate!]),
    enabled: Boolean(backCandidate && backNeedsGateway),
    staleTime: 86400_000,
  });

  const effectiveBackUrl = useMemo(() => {
    if (!backCandidate) return null;
    if (/^https?:\/\//i.test(backCandidate)) return backCandidate;
    if (!backNeedsGateway) return null;
    return backResolved?.items?.[0]?.httpsUrl ?? null;
  }, [backCandidate, backNeedsGateway, backResolved?.items]);

  const hasBackFace = Boolean(effectiveBackUrl);
  const [flipAngle, setFlipAngle] = useState(0);
  const [slabAutoRotateOn, setSlabAutoRotateOn] = useState(false);
  /** Slab flip when PSA back URL exists as candidate (tabs resolve / gateway). */
  const useFlipSlab = Boolean(backCandidate);

  useEffect(() => {
    setFlipAngle(0);
    setSlabAutoRotateOn(false);
    setLightboxOpen(false);
  }, [tokenId, backCandidate, imageUrl]);

  useEffect(() => {
    if (flipAngle >= 90 && !hasBackFace && !backResolving) {
      setFlipAngle(0);
    }
  }, [flipAngle, hasBackFace, backResolving]);

  const showFrontFlipTab = flipAngle < 90;
  const flipBackPlaceholder = (
    <>
      <span>No slab back image available for this listing.</span>
      <span className="mt-2 block max-w-[18rem] text-xs leading-relaxed text-gray-500">
        Tokens minted after this update include a PSA rear photo URL when PSA provides one (stored in
        graded metadata).
      </span>
    </>
  );

  const frontHeroLoading = Boolean(metaLoading && !imageUrl);
  const backHeroLoading = Boolean(backNeedsGateway) && backResolving;

  const slabHeroSizing = openSeaMobile
    ? "relative mx-auto aspect-square w-full max-w-none shrink-0 overflow-visible rounded-none bg-transparent max-lg:max-h-[min(72vw,340px)] lg:aspect-[3/4] lg:max-h-[min(72vh,680px)] lg:max-w-none lg:rounded-2xl lg:bg-[#030508]"
    : "relative mx-auto aspect-[3/4] w-full max-w-[min(100%,340px)] overflow-visible rounded-xl max-h-[min(62vh,560px)] sm:max-w-[min(100%,380px)] sm:rounded-2xl sm:max-h-[min(68vh,620px)] lg:max-w-none lg:max-h-[min(72vh,680px)]";

  const slabThumbSize = openSeaMobile
    ? "relative aspect-[3/4] w-10 shrink-0 overflow-hidden rounded-md border-2 max-xl:rounded-md lg:w-14 lg:rounded-lg"
    : "relative aspect-[3/4] w-14 shrink-0 overflow-hidden rounded-lg border-2";

  const slabThumbMinH = openSeaMobile
    ? "min-h-[2.75rem] max-xl:min-h-[2.75rem] lg:min-h-[4.5rem]"
    : "min-h-[4.5rem]";

  const slabControlsGap = openSeaMobile
    ? "mt-0 flex w-full flex-wrap items-end justify-center gap-2.5 max-lg:mt-5 max-lg:px-5 max-lg:pb-2 max-xl:gap-2 max-xl:pb-1.5 sm:max-xl:px-5 lg:gap-3 lg:mt-0 lg:px-0 lg:pb-0"
    : "mt-0 flex w-full flex-wrap items-end justify-center gap-3 sm:gap-4";

  const slabRotateGlyphWrap = openSeaMobile
    ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/95 shadow-md ring-1 ring-black/45 max-xl:h-6 max-xl:w-6 lg:h-8 lg:w-8"
    : "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/95 shadow-md ring-1 ring-black/45";

  const slabRotateGlyph = openSeaMobile
    ? "h-3 w-3 text-[#0a1210] max-xl:h-3 max-xl:w-3 lg:h-3.5 lg:w-3.5"
    : "h-3.5 w-3.5 text-[#0a1210]";

  const headerRowPulse =
    Boolean(metaLoading) && !headerCategory && !headerGradeLine && !setHeadline;
  const titlePulse = Boolean(metaLoading) && !metadata?.name?.trim();

  const headerBlock = (
    <div
      className={
        openSeaMobile
          ? "hidden space-y-2 px-0.5 lg:block lg:px-0"
          : hideHeaderOnXl
            ? "space-y-2 px-0.5 max-xl:order-3 lg:order-none lg:px-0 lg:hidden"
            : "space-y-2 px-0.5 max-xl:order-3 lg:order-none lg:px-0"
      }
    >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          {headerRowPulse ? (
            <>
              <span className="h-6 w-[4.75rem] shrink-0 animate-pulse rounded-md bg-gray-800/90" aria-hidden />
              <span className="h-6 w-14 shrink-0 animate-pulse rounded-md bg-gray-800/90" aria-hidden />
              <span className="block h-4 min-w-[8rem] flex-1 animate-pulse rounded-md bg-gray-800/70" aria-hidden />
            </>
          ) : (
            <>
              {headerCategory ? (
                <span
                  className={`inline-flex shrink-0 items-center rounded-md border border-amber-400/35 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-50 sm:text-[11px] ${
                    headerCategory === "NBA" ? "uppercase" : "capitalize"
                  }`}
                >
                  {headerCategory}
                </span>
              ) : null}
              {headerGradeLine ? (
                <span className="inline-flex shrink-0 items-center rounded-md border border-mint/40 bg-mint/10 px-2 py-0.5 text-[10px] font-semibold text-mint sm:text-[11px]">
                  {headerGradeLine}
                </span>
              ) : null}
              {metaLoading && !setHeadline ? (
                <span className="h-3.5 min-w-[8rem] flex-1 animate-pulse rounded bg-gray-800/70" aria-hidden />
              ) : setHeadline ? (
                  <p className="min-w-0 flex-1 text-[12px] font-medium leading-snug text-zinc-400 sm:text-[13px]">
                    {setHeadline}
                  </p>
              ) : null}
            </>
          )}
        </div>

        {titlePulse ? (
          <div className="h-7 w-[min(100%,18rem)] max-w-full animate-pulse rounded-lg bg-gray-800/85" aria-hidden />
        ) : (
          <h1 className="text-xl font-bold leading-snug tracking-tight text-white sm:text-[1.375rem]">
            {title}
          </h1>
        )}
    </div>
  );

  return (
    <div
      className={`flex min-w-0 flex-col gap-4 max-xl:gap-3 lg:gap-5 ${
        openSeaMobile
          ? "max-lg:items-center max-lg:gap-0 max-lg:px-0 max-lg:pt-3 max-lg:text-center"
          : ""
      }`}
    >
      {headerBlock}

      {priceMetricsSlot && !openSeaMobile ? (
        <div className="max-xl:order-2 lg:order-none">{priceMetricsSlot}</div>
      ) : null}

      <div
        className={`min-w-0 space-y-3 ${
          openSeaMobile
            ? "max-lg:order-none max-lg:w-full max-lg:items-center max-lg:space-y-0 lg:order-none"
            : "max-xl:order-1 lg:order-none"
        }`}
      >
        <div
          className={
            mobileHeroTradingSlot && !openSeaMobile
              ? "max-xl:grid max-xl:grid-cols-[minmax(0,1fr)_minmax(112px,34%)] max-xl:items-start max-xl:gap-3 sm:max-xl:gap-3.5"
              : ""
          }
        >
        {/* overflow-visible preserves 3D flip (rotateY edges) */}
        <div className={`${slabHeroSizing} bg-transparent`}>
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
                    backPlaceholder={flipBackPlaceholder}
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
                className={`${slabHeroSizing} group/img relative min-h-0 overflow-hidden ${
                  openSeaMobile ? "max-lg:bg-transparent" : "bg-[#030508]"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt={`${title} — slab front`}
                  className="h-full w-full min-h-0 object-contain object-center"
                  draggable={false}
                  referrerPolicy="no-referrer"
                />
                <button
                  type="button"
                  onClick={() => setLightboxOpen(true)}
                  className="absolute inset-0 z-[2] cursor-pointer bg-transparent outline-none transition-colors hover:bg-black/[0.12] active:bg-black/[0.18] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-mint/55"
                  aria-label="View enlarged card image"
                  title="Tap to enlarge"
                />
                <span className="pointer-events-none absolute bottom-2 left-1/2 z-[3] max-w-[90%] -translate-x-1/2 truncate rounded-md bg-black/58 px-2 py-0.5 text-center text-[9px] font-medium text-zinc-100/95 sm:text-[10px]">
                  Tap to enlarge
                </span>
              </div>
              {!openSeaMobile ? (
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-2/5 rounded-t-2xl bg-gradient-to-b from-white/[0.04] to-transparent"
                  aria-hidden
                />
              ) : null}
              <RwaImageLightbox
                open={lightboxOpen}
                src={imageUrl}
                alt={`${title} — slab front`}
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
        </div>

        {useFlipSlab ? (
          <>
            <div
              className={`${slabControlsGap} ${
                openSeaMobile ? "max-xl:px-3 max-xl:pb-1.5 sm:max-xl:px-5" : ""
              }`}
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
              {hasBackFace && !backHeroLoading && imageUrl && !frontHeroLoading ? (
                <button
                  type="button"
                  aria-pressed={slabAutoRotateOn}
                  className={`group ${slabThumbSize} bg-black/35 shadow-[0_4px_14px_-8px_rgba(0,0,0,0.75)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint/70 max-xl:shadow-[0_4px_12px_-8px_rgba(0,0,0,0.7)] lg:shadow-[0_6px_20px_-10px_rgba(0,0,0,0.75)] ${
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
          </>
        ) : null}
      </div>
    </div>
  );
}
