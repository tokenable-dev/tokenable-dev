"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { RwaImageZoom } from "@/components/common";
import { postResolveMediaUrls } from "@/lib/core";
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
 * `properties.graded` + attributes에서 카드 상세 그리드용 필드 추출
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
  if (set) rows.push({ label: "Set", value: set });
  if (num) rows.push({
    label: "Card Number",
    value: String(num).startsWith("#") ? String(num) : `#${num}`,
  });
  if (variant && variant !== gradeLabel) rows.push({ label: "Variant", value: variant });
  if (gradeLabel) rows.push({ label: "Grade", value: gradeLabel });
  if (year) rows.push({ label: "Year", value: year });
  if (category) rows.push({ label: "Category", value: category });
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
    category: catOut?.length ? catOut : null,
    gradeLine: gradeOut?.length ? gradeOut : null,
  };
}

function sanitizedDescription(metadata: RwaDetailMetadata | null): string | null {
  const t = metadata?.description?.trim();
  if (!t) return null;
  if (/^no\s+description\.?$/i.test(t)) return null;
  return t;
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
  /** Below title · above slab · pass `xl:hidden` from parent when only for narrow viewports */
  priceMetricsSlot?: ReactNode;
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
}: RwaDetailAssetPanelProps) {
  const title =
    metadata?.name ?? `${collectionLabel} #${tokenId}`;
  const slabAltCaption = typeof metadata?.name === "string" && metadata.name.trim()
    ? metadata.name.trim()
    : `${collectionLabel} #${tokenId}`;
  const setHeadline = useMemo(() => formatRwaSetHeadline(metadata), [metadata]);
  const { category: headerCategory, gradeLine: headerGradeLine } = useMemo(
    () => pickHeaderCategoryGrade(metadata),
    [metadata],
  );
  const readableDescription = useMemo(
    () => sanitizedDescription(metadata),
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
  const [slabAutoRotateOn, setSlabAutoRotateOn] = useState(true);
  /** Slab flip when PSA back URL exists as candidate (tabs resolve / gateway). */
  const useFlipSlab = Boolean(backCandidate);

  useEffect(() => {
    setFlipAngle(0);
    setSlabAutoRotateOn(true);
  }, [tokenId, backCandidate]);

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

  const slabHeroSizing =
    "relative mx-auto aspect-[3/4] w-full overflow-visible rounded-2xl max-h-[min(84vh,800px)] sm:max-h-[min(86vh,880px)]";

  const headerRowPulse =
    Boolean(metaLoading) && !headerCategory && !headerGradeLine && !setHeadline;
  const titlePulse = Boolean(metaLoading) && !metadata?.name?.trim();

  return (
    <div className="flex min-w-0 flex-col gap-5 lg:gap-6">
      <div className="space-y-2.5 px-0.5 lg:space-y-3 lg:px-0">
        <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
          {headerRowPulse ? (
            <>
              <span className="h-6 w-[4.75rem] shrink-0 animate-pulse rounded-md bg-gray-800/90" aria-hidden />
              <span className="h-6 w-14 shrink-0 animate-pulse rounded-md bg-gray-800/90" aria-hidden />
              <span className="block h-4 min-w-[8rem] flex-1 animate-pulse rounded-md bg-gray-800/70" aria-hidden />
            </>
          ) : (
            <>
              {headerCategory ? (
                <span className="inline-flex shrink-0 items-center rounded-md border border-amber-400/40 bg-amber-500/[0.22] px-2.5 py-1 text-[11px] font-semibold capitalize tracking-wide text-amber-50">
                  {headerCategory}
                </span>
              ) : null}
              {headerGradeLine ? (
                <span className="inline-flex shrink-0 items-center rounded-md border border-mint-deep/45 bg-mint/15 px-2.5 py-1 text-[11px] font-semibold text-mint ring-1 ring-mint-deep/25">
                  {headerGradeLine}
                </span>
              ) : null}
              {metaLoading && !setHeadline ? (
                <span className="h-4 min-w-[10rem] flex-1 animate-pulse rounded-md bg-gray-800/70" aria-hidden />
              ) : setHeadline ? (
                  <p className="min-w-[min(100%,14rem)] flex-1 basis-[65%] text-left text-[13px] font-medium leading-snug text-gray-100 sm:basis-auto sm:text-sm">
                    {setHeadline}
                  </p>
              ) : null}
            </>
          )}
        </div>

        {titlePulse ? (
          <div className="h-8 w-[min(100%,20rem)] max-w-full animate-pulse rounded-lg bg-gray-800/85" aria-hidden />
        ) : (
          <h1 className="text-2xl font-bold leading-snug tracking-tight text-white sm:text-[1.65rem]">
            {title}
          </h1>
        )}
      </div>

      {priceMetricsSlot ?? null}

      <div className="min-w-0 space-y-3">
        {/* overflow-visible preserves 3D flip (rotateY edges) */}
        <div className={`${slabHeroSizing} bg-transparent`}>
          {useFlipSlab ? (
            <>
              <div className={`${slabHeroSizing} bg-[#030508]`}>
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
              <div
                className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-2/5 rounded-t-2xl bg-gradient-to-b from-white/[0.04] to-transparent"
                aria-hidden
              />
            </>
          ) : frontHeroLoading ? (
            <div className="absolute inset-0 rounded-2xl bg-gray-800/80 animate-pulse" />
          ) : imageUrl ? (
            <>
              <div className={`${slabHeroSizing} min-h-0 overflow-hidden bg-[#030508]`}>
                <RwaImageZoom
                  key={`${tokenId}-${imageUrl.slice(0, 48)}`}
                  src={imageUrl}
                  alt={`${title} — slab front`}
                  className="w-full h-full min-h-0"
                  zoomFactor={3}
                  lensSize={230}
                />
              </div>
              <div
                className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-2/5 rounded-t-2xl bg-gradient-to-b from-white/[0.04] to-transparent"
                aria-hidden
              />
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-[#030508] text-sm text-gray-600">
              No image
            </div>
          )}
        </div>

        {useFlipSlab ? (
          <>
            <div className="mt-0 flex flex-wrap items-end justify-center gap-3 sm:gap-4">
              {hasBackFace && !backHeroLoading && imageUrl && !frontHeroLoading ? (
                <button
                  type="button"
                  aria-pressed={slabAutoRotateOn}
                  className={`group relative aspect-[3/4] w-14 shrink-0 overflow-hidden rounded-lg border-2 bg-black/35 shadow-[0_6px_20px_-10px_rgba(0,0,0,0.75)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint/70 ${
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
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/95 shadow-md ring-1 ring-black/45">
                      {slabAutoRotateOn ? (
                        <SlabPauseGlyph className="h-3.5 w-3.5 text-[#0a1210]" />
                      ) : (
                        <SlabPlayGlyph className="h-3.5 w-3.5 translate-x-[1px] text-[#0a1210]" />
                      )}
                    </span>
                  </span>
                </button>
              ) : null}
              <div className="flex gap-2.5" role="tablist" aria-label="Slab photo side">
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
                  className={`relative aspect-[3/4] w-14 shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                    showFrontFlipTab
                      ? "border-mint/65 bg-mint/10 ring-2 ring-mint/25"
                      : "border-gray-700/90 bg-black/40 opacity-85 hover:border-gray-500 hover:opacity-100"
                  }`}
                >
                  {frontHeroLoading ? (
                    <span
                      className="block h-full min-h-[4.5rem] w-full animate-pulse bg-gray-800"
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
                    <span className="flex min-h-[4.5rem] w-full items-center justify-center bg-[#0a0f16] text-[10px] text-zinc-600">
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
                  className={`relative aspect-[3/4] w-14 shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                    !showFrontFlipTab
                      ? "border-mint/65 bg-mint/10 ring-2 ring-mint/25"
                      : "border-gray-700/90 bg-black/40 opacity-85 hover:border-gray-500 hover:opacity-100"
                  }`}
                >
                  {backHeroLoading ? (
                    <span
                      className="block h-full min-h-[4.5rem] w-full animate-pulse bg-gray-800"
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
                    <span className="flex min-h-[4.5rem] w-full flex-col items-center justify-center gap-0.5 bg-[#0a0f16] px-1 text-center">
                      <span className="text-[9px] leading-tight text-zinc-500">No rear</span>
                    </span>
                  )}
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>

      <div className="space-y-3 px-0.5 lg:px-0">
        {readableDescription ? (
          <p className="text-sm text-gray-400 leading-relaxed line-clamp-4">
            {readableDescription}
          </p>
        ) : null}
      </div>
    </div>
  );
}
