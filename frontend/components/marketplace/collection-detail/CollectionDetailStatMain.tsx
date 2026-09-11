"use client";

import { useState } from "react";
import { TkTag } from "@/components/ds";
import {
  computeGemRatePct,
  formatGemRatePercent,
  formatReferencePercentChange,
  formatUsdCompact,
  formatPsaPopulationCount,
  formatVelocityPercent,
  NO_EXTERNAL_PRICE,
  REFERENCE_CHANGE_UNAVAILABLE_LABEL,
  referenceChangeTone,
} from "@/lib/market";
import type { PsaPopulationMetrics } from "@/lib/market/gradedCardMarketCap";
import type { ReferencePercentChangeResult } from "@/lib/market/priceChangePeriod";
import { formatReferenceChangePeriodShort } from "@/lib/market/priceChangePeriod";
import { RwaImageLightbox } from "@/components/common";
import type { AssetDetailHeadlineParts } from "@/lib/marketplace/assetDetailHeadline";
import {
  formatAssetDetailLine1,
  formatCardDisplayHoverTitle,
  formatCardDisplayMeta,
  resolveCardDisplayGrade,
} from "@/lib/marketplace/assetDetailHeadline";
import { formatHeadlineCardNumber } from "@/lib/marketplace/collectionFullDetailsTitle";

function formatChangeTag(pct: number): { arrow: string; label: string } {
  const tone = referenceChangeTone(pct);
  return {
    arrow: tone === "down" ? "▼" : "▲",
    label: formatReferencePercentChange(pct),
  };
}

function periodChipLabel(
  period: ReferencePercentChangeResult | null | undefined,
): string {
  if (!period) return "1Y";
  return formatReferenceChangePeriodShort(period);
}

/** Strip segments already shown in `#hero-title` (name / number / grade). */
function stripHeroTitleDupesFromMeta(
  meta: string,
  gradeLabel: string,
  cardNumber?: string | null,
  cardName?: string | null,
): string {
  const segments = meta
    .split(/\s*·\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length === 0) return "";

  const skip = new Set(
    [gradeLabel, cardNumber, cardName]
      .map((s) => (s ?? "").trim().toLowerCase())
      .filter(Boolean),
  );
  const num = (cardNumber ?? "").trim();
  if (num) {
    skip.add(num.replace(/^0+/, "") || num);
    const padded = /^\d+$/.test(num.replace(/^#/, ""))
      ? String(parseInt(num.replace(/^#/, ""), 10)).padStart(3, "0")
      : "";
    if (padded) skip.add(padded.toLowerCase());
  }

  const kept: string[] = [];
  for (const seg of segments) {
    const key = seg.toLowerCase();
    if (skip.has(key)) continue;
    if (kept.length > 0 && kept[kept.length - 1].toLowerCase() === key) continue;
    kept.push(seg);
  }
  return kept.join(" · ");
}

function heroTitleName(nameRaw: string, cardNumber: string): string {
  if (!nameRaw || !cardNumber) return nameRaw;
  const escaped = cardNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const stripped = nameRaw
    .replace(new RegExp(`(?:\\s*[·•#]\\s*|\\s+)${escaped}\\s*$`, "i"), "")
    .trim();
  return stripped || nameRaw;
}

/** SSOT Line 1 — `{Name} · {Number} · {Grade}` (`formatAssetDetailLine1`). */
function CollectionHeroTitle({
  parts,
  grade,
  className,
  id,
}: {
  parts: AssetDetailHeadlineParts;
  grade?: string | null;
  className?: string;
  id?: string;
}) {
  const cardNumber =
    formatHeadlineCardNumber(parts.cardNumber)?.trim() ||
    parts.cardNumber?.trim() ||
    "";
  const cleaned: AssetDetailHeadlineParts = {
    ...parts,
    cardName: heroTitleName(parts.cardName?.trim() || "", cardNumber),
  };
  const line1 = formatAssetDetailLine1(cleaned, { grade });
  const hover = formatCardDisplayHoverTitle(cleaned, { grade });
  const segments = line1
    .split(/\s*·\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  const gradeText = resolveCardDisplayGrade(grade);

  return (
    <h1 className={className} id={id} title={hover || line1}>
      {segments.map((seg, i) => {
        const isGrade =
          Boolean(gradeText) &&
          i === segments.length - 1 &&
          seg.toLowerCase() === gradeText.toLowerCase();
        return (
          <span key={`${i}-${seg}`}>
            {i > 0 ? (
              <span className="cd-hero-bar__title-sep" aria-hidden>
                {" · "}
              </span>
            ) : null}
            {isGrade ? (
              <strong className="cd-hero-bar__title-grade">{seg}</strong>
            ) : (
              <span
                className={
                  i === 0
                    ? "cd-hero-bar__title-name"
                    : "cd-hero-bar__title-num"
                }
              >
                {seg}
              </span>
            )}
          </span>
        );
      })}
    </h1>
  );
}

function HeroMeta({
  parts,
  meta,
  gradeLabel,
  cardNumber,
  cardName,
}: {
  parts?: AssetDetailHeadlineParts | null;
  meta: string | null;
  gradeLabel: string;
  cardNumber?: string | null;
  cardName?: string | null;
}) {
  /* SSOT Line 2 — `{Year} · {Set} {Language} · {Variant}` */
  const ssot = parts ? formatCardDisplayMeta(parts).trim() : "";
  const raw = ssot || meta?.trim() || "";
  if (!raw) return null;
  const text = stripHeroTitleDupesFromMeta(
    raw,
    gradeLabel,
    cardNumber,
    cardName,
  );
  if (!text) return null;

  const segments = text
    .split(/\s*·\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  const variant = parts?.variety?.trim() || "";
  if (segments.length <= 1) {
    return (
      <div className="cd-hero-bar__meta" id="hero-meta">
        {text}
      </div>
    );
  }

  const last = segments[segments.length - 1]!;
  const muteLast =
    Boolean(variant) && last.toLowerCase() === variant.toLowerCase();
  const lead = muteLast
    ? segments.slice(0, -1).join(" · ")
    : segments.join(" · ");
  const tail = muteLast ? last : null;

  return (
    <div className="cd-hero-bar__meta" id="hero-meta">
      {lead}
      {tail ? (
        <>
          {" · "}
          <span className="cd-hero-bar__meta-variant">{tail}</span>
        </>
      ) : null}
    </div>
  );
}

type HeroStatCell = { label: string; value: string };

function HeroStatsCells({
  cells,
  labelClass,
  valueClass,
}: {
  cells: HeroStatCell[];
  labelClass: string;
  valueClass: string;
}) {
  return (
    <>
      {cells.map((cell) => (
        <div key={cell.label} className="cd-hero-stats__cell">
          <div className={labelClass}>{cell.label}</div>
          <div className={valueClass}>{cell.value}</div>
        </div>
      ))}
    </>
  );
}

function buildHeroStatCells(input: {
  formatMarketCap: (n: number | null | undefined) => string;
  marketCapUsd: number | null;
  volumeDisplay: string;
  velocityDisplay: string;
  popValue: string;
  gemRateLabel: string;
}): HeroStatCell[] {
  return [
    { label: "Mkt cap", value: input.formatMarketCap(input.marketCapUsd) },
    { label: "Vol 1Yr", value: input.volumeDisplay },
    { label: "Velocity", value: input.velocityDisplay },
    { label: "Pop", value: input.popValue },
    { label: "Gem rate", value: input.gemRateLabel },
  ];
}

function resolveHeroStatCells(input: {
  formatMarketCap: (n: number | null | undefined) => string;
  marketCapUsd: number | null;
  tradeVolumeUsdc: number | null;
  tradeVolumeLoading: boolean;
  velocityPct?: number | null;
  psaPopulationMetrics?: PsaPopulationMetrics | null;
  totalPopulation?: number | null;
}): HeroStatCell[] {
  const popMetrics = input.psaPopulationMetrics ?? {
    gradeLabel: "PSA 10",
    gradePop: null,
    totalPsaPop: input.totalPopulation ?? null,
    psa10Pop: null,
  };
  const popValue =
    popMetrics.gradePop != null
      ? formatPsaPopulationCount(popMetrics.gradePop)
      : input.totalPopulation != null
        ? formatPsaPopulationCount(input.totalPopulation)
        : "—";
  const gemRateLabel = formatGemRatePercent(
    computeGemRatePct(
      popMetrics.psa10Pop,
      popMetrics.totalPsaPop ?? input.totalPopulation,
    ),
  );
  const volumeDisplay =
    input.tradeVolumeLoading && input.tradeVolumeUsdc == null
      ? "—"
      : input.tradeVolumeUsdc == null
        ? "—"
        : formatUsdCompact(input.tradeVolumeUsdc);
  const velocityDisplay =
    input.tradeVolumeLoading &&
    input.velocityPct == null &&
    input.marketCapUsd == null
      ? "—"
      : formatVelocityPercent(input.velocityPct);
  return buildHeroStatCells({
    formatMarketCap: input.formatMarketCap,
    marketCapUsd: input.marketCapUsd,
    volumeDisplay,
    velocityDisplay,
    popValue,
    gemRateLabel,
  });
}

/** Card.html `#md-panel` — 5 stats under the chart on ≤1140px. */
export function CollectionHeroMdPanel({
  tradeVolumeUsdc,
  tradeVolumeLoading,
  marketCapUsd,
  formatMarketCap,
  psaPopulationMetrics,
  totalPopulation,
  velocityPct,
}: {
  tradeVolumeUsdc: number | null;
  tradeVolumeLoading: boolean;
  marketCapUsd: number | null;
  formatMarketCap: (n: number | null | undefined) => string;
  psaPopulationMetrics?: PsaPopulationMetrics | null;
  totalPopulation?: number | null;
  velocityPct?: number | null;
}) {
  const cells = resolveHeroStatCells({
    formatMarketCap,
    marketCapUsd,
    tradeVolumeUsdc,
    tradeVolumeLoading,
    velocityPct,
    psaPopulationMetrics,
    totalPopulation,
  });
  return (
    <div className="cd-hero-md-panel" id="md-panel">
      <div className="cd-hero-md-panel__row">
        <HeroStatsCells
          cells={cells}
          labelClass="cd-hero-md-panel__lbl"
          valueClass="cd-hero-md-panel__val mono"
        />
      </div>
    </div>
  );
}

/**
 * Card.html `#hero-bar` then sibling `#hero-stats` (inside `#chart-card`).
 * Buy / Bid / Sell live in the right rail (`#tk-trade`), not in the hero.
 */
export function CollectionDetailStatMain({
  headlineTitle,
  headlineParts,
  headlineMeta,
  imageUrl,
  priceUsd,
  priceLoading,
  changePct,
  changeLoading,
  changePeriod,
  gradeLabel = "PSA 10",
  tradeVolumeUsdc,
  tradeVolumeLoading,
  marketCapUsd,
  formatMarketCap,
  psaPopulationMetrics,
  totalPopulation,
  velocityPct,
  /** When true, hero sits inside `#chart-card` (no own notch chrome). */
  embedInChart = false,
}: {
  headlineTitle?: string | null;
  headlineParts?: AssetDetailHeadlineParts | null;
  headlineMeta?: string | null;
  imageUrl?: string | null;
  priceUsd: number | null;
  priceLoading: boolean;
  changePct: number | null;
  changeLoading: boolean;
  changePeriod?: ReferencePercentChangeResult | null;
  gradeLabel?: string;
  tradeVolumeUsdc: number | null;
  tradeVolumeLoading: boolean;
  marketCapUsd: number | null;
  formatMarketCap: (n: number | null | undefined) => string;
  psaPopulationMetrics?: PsaPopulationMetrics | null;
  totalPopulation?: number | null;
  velocityPct?: number | null;
  embedInChart?: boolean;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const coverSrc = imageUrl?.trim() || null;
  const title = headlineTitle?.trim() || null;
  const meta = headlineMeta?.trim() || null;

  const changeTone =
    changePct != null && Number.isFinite(changePct)
      ? referenceChangeTone(changePct)
      : null;
  const changeTag =
    changePct != null && Number.isFinite(changePct)
      ? formatChangeTag(changePct)
      : null;

  const statCells = resolveHeroStatCells({
    formatMarketCap,
    marketCapUsd,
    tradeVolumeUsdc,
    tradeVolumeLoading,
    velocityPct,
    psaPopulationMetrics,
    totalPopulation,
  });

  return (
    <div
      className={`cd-stat-main${embedInChart ? " cd-stat-main--embedded" : ""}`}
    >
      <div
        className={`cd-hero-bar${embedInChart ? " cd-hero-bar--embed" : ""}`}
        id="hero-bar"
        data-testid="collection-detail-hero-bar"
      >
        {coverSrc ? (
          <button
            type="button"
            className="cd-hero-bar__thumb-btn"
            onClick={() => setLightboxOpen(true)}
            aria-label="View card image"
          >
            <img
              src={coverSrc}
              alt=""
              className="cd-hero-bar__thumb"
              id="hero-img"
            />
          </button>
        ) : (
          <div
            className="cd-hero-bar__thumb--empty"
            id="hero-img"
            aria-hidden
          />
        )}

        <div className="cd-hero-bar__mid" id="hero-mid">
          {title ? (
            <div className="cd-hero-bar__head" id="hero-head">
              {headlineParts ? (
                <CollectionHeroTitle
                  parts={headlineParts}
                  grade={gradeLabel}
                  className="cd-hero-bar__title"
                  id="hero-title"
                />
              ) : (
                <h1
                  className="cd-hero-bar__title"
                  id="hero-title"
                  title={title}
                >
                  {title}
                </h1>
              )}
              <HeroMeta
                parts={headlineParts}
                meta={meta}
                gradeLabel={gradeLabel}
                cardNumber={headlineParts?.cardNumber}
                cardName={headlineParts?.cardName}
              />
            </div>
          ) : null}

          <div className="cd-hero-bar__actions">
            <div className="cd-hero-bar__metrics hero-actionsrow">
              <div className="cd-hero-bar__priceblock" id="hero-priceblock">
                <div className="cd-hero-bar__lastlbl mono" id="hero-lastlbl">
                  Last price
                </div>
                <div className="cd-hero-bar__price-row">
                  {priceLoading && priceUsd == null ? (
                    <div
                      className="cd-hero-bar__price cd-hero-bar__skeleton"
                      aria-hidden
                    />
                  ) : priceUsd != null && Number.isFinite(priceUsd) ? (
                    <div className="cd-hero-bar__price">
                      {formatUsdCompact(priceUsd)}
                    </div>
                  ) : (
                    <div className="cd-hero-bar__price cd-hero-bar__price--muted">
                      {NO_EXTERNAL_PRICE}
                    </div>
                  )}
                  <div className="cd-hero-bar__chg" id="hero-chg">
                    {changeLoading && changePct == null ? (
                      <span
                        className="cd-hero-bar__skeleton cd-hero-bar__skeleton--tag"
                        aria-hidden
                      />
                    ) : changeTag ? (
                      <span
                        className={`cd-hero-bar__chg-val mono${
                          changeTone === "down"
                            ? " cd-hero-bar__chg-val--down"
                            : changeTone === "up"
                              ? " cd-hero-bar__chg-val--up"
                              : ""
                        }`}
                      >
                        <span className="cd-chg-glyph" aria-hidden>
                          {changeTag.arrow}
                        </span>{" "}
                        {changeTag.label}{" "}
                        <span className="cd-hero-bar__period">
                          {periodChipLabel(changePeriod)}
                        </span>
                      </span>
                    ) : (
                      <TkTag tone="neutral" className="cd-hero-bar__change-tag">
                        {REFERENCE_CHANGE_UNAVAILABLE_LABEL}
                      </TkTag>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="cd-hero-stats" id="hero-stats">
            <div className="cd-hero-stats__grid" id="hero-stats-grid">
              <HeroStatsCells
                cells={statCells}
                labelClass="cd-hero-stats__lbl"
                valueClass="cd-hero-stats__val mono"
              />
            </div>
          </div>
        </div>
      </div>

      <RwaImageLightbox
        open={lightboxOpen}
        src={coverSrc}
        alt="Collection cover"
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}
