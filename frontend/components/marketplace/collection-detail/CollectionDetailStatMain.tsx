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
  formatCardDisplayHoverTitle,
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

/** Card.html `#hero-title` — name + number (white) + grade; separators muted. */
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
  const nameRaw = parts.cardName?.trim() || "";
  const cardNumber =
    formatHeadlineCardNumber(parts.cardNumber)?.trim() ||
    parts.cardNumber?.trim() ||
    "";
  const name = heroTitleName(nameRaw, cardNumber);
  const gradeText = resolveCardDisplayGrade(grade);
  const hover = formatCardDisplayHoverTitle(parts, { grade });

  return (
    <h1 className={className} id={id} title={hover}>
      {name ? <span className="cd-hero-bar__title-name">{name}</span> : null}
      {cardNumber ? (
        <>
          <span className="cd-hero-bar__title-sep" aria-hidden>
            {" · "}
          </span>
          <span className="cd-hero-bar__title-num">{cardNumber}</span>
        </>
      ) : null}
      {gradeText ? (
        <>
          <span className="cd-hero-bar__title-sep" aria-hidden>
            {" · "}
          </span>
          <strong className="cd-hero-bar__title-grade">{gradeText}</strong>
        </>
      ) : null}
    </h1>
  );
}

function HeroMeta({
  meta,
  gradeLabel,
  cardNumber,
  cardName,
}: {
  meta: string | null;
  gradeLabel: string;
  cardNumber?: string | null;
  cardName?: string | null;
}) {
  if (!meta) return null;
  const text = stripHeroTitleDupesFromMeta(
    meta,
    gradeLabel,
    cardNumber,
    cardName,
  );
  if (!text) return null;

  const segments = text
    .split(/\s*·\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length <= 1) {
    return (
      <div className="cd-hero-bar__meta" id="hero-meta">
        {text}
      </div>
    );
  }

  const lead = segments.slice(0, -1).join(" · ");
  const tail = segments[segments.length - 1]!;

  return (
    <div className="cd-hero-bar__meta" id="hero-meta">
      {lead}
      {" · "}
      <span className="cd-hero-bar__meta-variant">{tail}</span>
    </div>
  );
}

/**
 * Card.html `#hero-bar` + `#hero-stats` (design-30):
 * image | mid(title+meta · last price) then 5-col stats.
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

  const popMetrics = psaPopulationMetrics ?? {
    gradeLabel: "PSA 10",
    gradePop: null,
    totalPsaPop: totalPopulation ?? null,
    psa10Pop: null,
  };
  const popValue =
    popMetrics.gradePop != null
      ? formatPsaPopulationCount(popMetrics.gradePop)
      : totalPopulation != null
        ? formatPsaPopulationCount(totalPopulation)
        : "—";
  /** Gem rate = PSA Pop (PSA 10) ÷ Total Pop. */
  const gemRateLabel = formatGemRatePercent(
    computeGemRatePct(
      popMetrics.psa10Pop,
      popMetrics.totalPsaPop ?? totalPopulation,
    ),
  );

  const changeTone =
    changePct != null && Number.isFinite(changePct)
      ? referenceChangeTone(changePct)
      : null;
  const changeTag =
    changePct != null && Number.isFinite(changePct)
      ? formatChangeTag(changePct)
      : null;

  const volumeDisplay =
    tradeVolumeLoading && tradeVolumeUsdc == null
      ? "—"
      : tradeVolumeUsdc == null
        ? "—"
        : formatUsdCompact(tradeVolumeUsdc);
  const velocityDisplay =
    tradeVolumeLoading && velocityPct == null && marketCapUsd == null
      ? "—"
      : formatVelocityPercent(velocityPct);

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
        </div>

        {/* Card.html: `#hero-stats` is a child of `#hero-bar` (full-width wrap row). */}
        <div className="cd-hero-stats" id="hero-stats">
          <div className="cd-hero-stats__grid" id="hero-stats-grid">
            <div className="cd-hero-stats__cell">
              <div className="cd-hero-stats__lbl">Mkt cap</div>
              <div className="cd-hero-stats__val mono">
                {formatMarketCap(marketCapUsd)}
              </div>
            </div>
            <div className="cd-hero-stats__cell">
              <div className="cd-hero-stats__lbl">Vol 1Yr</div>
              <div className="cd-hero-stats__val mono">{volumeDisplay}</div>
            </div>
            <div className="cd-hero-stats__cell">
              <div className="cd-hero-stats__lbl">Velocity</div>
              <div className="cd-hero-stats__val mono">{velocityDisplay}</div>
            </div>
            <div className="cd-hero-stats__cell">
              <div className="cd-hero-stats__lbl">Pop</div>
              <div className="cd-hero-stats__val mono">{popValue}</div>
            </div>
            <div className="cd-hero-stats__cell">
              <div className="cd-hero-stats__lbl">Gem rate</div>
              <div className="cd-hero-stats__val mono">{gemRateLabel}</div>
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
