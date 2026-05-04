"use client";

import { useEffect, useMemo, useState } from "react";
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

const BADGE_TONES = [
  "bg-violet-500/20 text-violet-200 border-violet-400/30",
  "bg-amber-500/15 text-amber-200 border-amber-400/25",
  "bg-mint/15 text-mint border-mint-deep/35",
] as const;

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

function selectBadges(meta: RwaDetailMetadata | null): { text: string; toneIdx: number }[] {
  if (!meta?.attributes?.length) return [];
  const out: { text: string; toneIdx: number }[] = [];
  for (const a of meta.attributes) {
    if (out.length >= 3) break;
    const trait = (a.trait_type ?? "").trim();
    const val = String(a.value ?? "").trim();
    if (!val) continue;
    if (/grading\s*company/i.test(trait)) continue;
    const preferValue =
      /^(set|game|category|year|player)$/i.test(trait) ||
      val.length <= 48;
    const text = preferValue
      ? val.length > 44
        ? `${val.slice(0, 42)}…`
        : val
      : `${trait}: ${val.length > 32 ? `${val.slice(0, 30)}…` : val}`;
    out.push({ text, toneIdx: out.length % BADGE_TONES.length });
  }
  return out;
}

export interface RwaDetailAssetPanelProps {
  metadata: RwaDetailMetadata | null;
  imageUrl: string | null;
  tokenId: number;
  collectionLabel: string;
  metaLoading?: boolean;
}

/**
 * 마켓플레이스 RWA 상세 — 왼쪽: 슬랩 이미지, 제목, 배지, 스탯 그리드 (참고 UI)
 */
export function RwaDetailAssetPanel({
  metadata,
  imageUrl,
  tokenId,
  collectionLabel,
  metaLoading,
}: RwaDetailAssetPanelProps) {
  const title =
    metadata?.name ?? `${collectionLabel} #${tokenId}`;
  const slabAltCaption = typeof metadata?.name === "string" && metadata.name.trim()
    ? metadata.name.trim()
    : `${collectionLabel} #${tokenId}`;
  const statRows = buildRwaDetailStatRows(metadata);
  const badges = selectBadges(metadata);

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

  return (
    <div className="min-w-0 space-y-5">
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
            <div className="mt-0 flex flex-wrap items-end justify-center gap-2 sm:gap-3">
              {hasBackFace && !backHeroLoading && imageUrl && !frontHeroLoading ? (
                <button
                  type="button"
                  aria-pressed={slabAutoRotateOn}
                  className={`group relative aspect-[3/4] w-12 shrink-0 overflow-hidden rounded-lg border-2 bg-black/35 shadow-[0_6px_20px_-10px_rgba(0,0,0,0.75)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint/70 ${
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
                    <span className="flex h-[1.625rem] w-[1.625rem] shrink-0 items-center justify-center rounded-full bg-white/95 shadow-md ring-1 ring-black/45">
                      {slabAutoRotateOn ? (
                        <SlabPauseGlyph className="h-3 w-3 text-[#0a1210]" />
                      ) : (
                        <SlabPlayGlyph className="h-3 w-3 translate-x-[1px] text-[#0a1210]" />
                      )}
                    </span>
                  </span>
                </button>
              ) : null}
              <div className="flex gap-2" role="tablist" aria-label="Slab photo side">
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
                  className={`relative aspect-[3/4] w-12 shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                    showFrontFlipTab
                      ? "border-mint/65 bg-mint/10 ring-2 ring-mint/25"
                      : "border-gray-700/90 bg-black/40 opacity-85 hover:border-gray-500 hover:opacity-100"
                  }`}
                >
                  {frontHeroLoading ? (
                    <span
                      className="block h-full min-h-[4rem] w-full animate-pulse bg-gray-800"
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
                    <span className="flex min-h-[4rem] w-full items-center justify-center bg-[#0a0f16] text-[10px] text-zinc-600">
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
                  className={`relative aspect-[3/4] w-12 shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                    !showFrontFlipTab
                      ? "border-mint/65 bg-mint/10 ring-2 ring-mint/25"
                      : "border-gray-700/90 bg-black/40 opacity-85 hover:border-gray-500 hover:opacity-100"
                  }`}
                >
                  {backHeroLoading ? (
                    <span
                      className="block h-full min-h-[4rem] w-full animate-pulse bg-gray-800"
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
                    <span className="flex min-h-[4rem] w-full flex-col items-center justify-center gap-0.5 bg-[#0a0f16] px-1 text-center">
                      <span className="text-[9px] leading-tight text-zinc-500">No rear</span>
                    </span>
                  )}
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>

      <div className="space-y-3 px-0.5">
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
          {title}
        </h1>

        {badges.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {badges.map((b, idx) => (
              <span
                key={`${b.text}-${idx}`}
                className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${BADGE_TONES[b.toneIdx]}`}
              >
                {b.text}
              </span>
            ))}
          </div>
        )}

        {metadata?.description && (
          <p className="text-sm text-gray-400 leading-relaxed line-clamp-4">
            {metadata.description}
          </p>
        )}

        {statRows.length > 0 && (
          <div className="rounded-2xl border border-gray-800/90 bg-[#0a0d11]/90 p-4">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              {statRows.map((row) => (
                <div key={row.label} className="min-w-0">
                  <dt className="text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1">
                    {row.label}
                  </dt>
                  <dd
                    className={`text-sm font-medium leading-snug break-words ${
                      row.label === "Player"
                        ? "text-mint"
                        : "text-gray-100"
                    }`}
                  >
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {metadata?.external_url && (
          <a
            href={metadata.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-mint/90 hover:text-mint transition-colors"
          >
            View certification link
            <span aria-hidden>↗</span>
          </a>
        )}
      </div>
    </div>
  );
}
