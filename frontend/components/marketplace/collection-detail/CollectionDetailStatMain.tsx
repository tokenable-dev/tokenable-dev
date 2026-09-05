"use client";

import { useEffect, useRef, useState } from "react";
import { TkButton, TkTag } from "@/components/ds";
import {
  computeGemRatePct,
  formatGemRatePercent,
  formatReferencePercentChange,
  formatUsdCompact,
  formatUsdListing,
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
  if (!period) return "1 YR Chg.";
  return `${formatReferenceChangePeriodShort(period)} Chg.`;
}

function formatAskBidUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return "—";
  return formatUsdListing(n);
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
 * Card.html `#hero-bar` (2026 redesign):
 * image | mid(title+meta · last price + stats + Buy/Bid buttons).
 * Expanded bar stays in flow. Condensed bar pins after the hero scrolls away.
 * Buy/Bid stay on the right of the stats row (`.cd-hero-bar__actions`); they do not wrap.
 */
export function CollectionDetailStatMain({
  stuckTitle,
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
  median30dUsd,
  lowestAskUsd,
  highestBidUsd,
  velocityPct,
  onBuyLowestAsk,
  onPlaceBid,
  buyDisabled,
  bidDisabled,
}: {
  stuckTitle?: string | null;
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
  median30dUsd?: number | null;
  tradeVolumeUsdc: number | null;
  tradeVolumeLoading: boolean;
  marketCapUsd: number | null;
  formatMarketCap: (n: number | null | undefined) => string;
  psaPopulationMetrics?: PsaPopulationMetrics | null;
  totalPopulation?: number | null;
  lowestAskUsd?: number | null;
  highestBidUsd?: number | null;
  velocityPct?: number | null;
  onBuyLowestAsk?: () => void;
  onPlaceBid?: () => void;
  buyDisabled?: boolean;
  bidDisabled?: boolean;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const midRef = useRef<HTMLDivElement>(null);
  const coverSrc = imageUrl?.trim() || null;
  const stuckLabel = stuckTitle?.trim() || null;
  const title = headlineTitle?.trim() || null;
  const meta = headlineMeta?.trim() || null;

  useEffect(() => {
    const bar = barRef.current;
    const spacer = spacerRef.current;
    if (!bar || !spacer) return;

    const STUCK_BAR_H = 68;
    const GNB_H = 64;
    /** Pin only after the expanded hero has fully scrolled under the GNB. */
    const PIN_SLOP_PX = 8;
    /** Extra px before unpinning — avoids flicker at the threshold. */
    const UNPIN_SLOP_PX = 28;

    let raf = 0;
    let lastBarH = -1;
    /** Last measured expanded (non-stuck) bar height. */
    let expandedH = 0;

    const publishBarH = () => {
      const stuck = bar.classList.contains("is-stuck");
      const next = stuck ? Math.round(bar.getBoundingClientRect().height) : 0;
      if (next === lastBarH) return;
      lastBarH = next;
      document.documentElement.style.setProperty("--bar-h", `${next}px`);
    };

    const marginBottom = () =>
      parseFloat(getComputedStyle(bar).marginBottom) || 0;

    const measureExpandedH = () => {
      if (bar.classList.contains("is-stuck")) return;
      const h = Math.round(bar.getBoundingClientRect().height);
      if (h > STUCK_BAR_H) expandedH = h;
    };

    /** Skip the twin instance that is `display:none` (desktop vs mobile mount). */
    const barIsVisible = () => {
      const r = bar.getBoundingClientRect();
      return r.width >= 8 && r.height >= 8;
    };

    const clearPin = () => {
      spacer.style.height = "";
      bar.classList.remove("is-stuck");
      bar.style.left = "";
      bar.style.width = "";
    };

    /**
     * Pin condensed hero as `position:fixed` and reserve the *expanded*
     * in-flow height on the spacer (off-screen once we pin after scroll-past).
     */
    const pinBar = () => {
      const mb = marginBottom();
      measureExpandedH();
      const flowH = expandedH > STUCK_BAR_H ? expandedH : STUCK_BAR_H;
      if (window.innerWidth > 1023) {
        const sr = spacer.getBoundingClientRect();
        const box = sr.width >= 8 ? sr : bar.getBoundingClientRect();
        bar.style.left = `${Math.round(box.left)}px`;
        bar.style.width = `${Math.round(box.width)}px`;
      } else {
        bar.style.left = "";
        bar.style.width = "";
      }
      bar.classList.add("is-stuck");
      spacer.style.height = `${flowH + mb}px`;
    };

    const syncFixedGeometry = () => {
      if (!bar.classList.contains("is-stuck")) return;
      if (window.innerWidth <= 1023) {
        bar.style.left = "";
        bar.style.width = "";
        return;
      }
      const sr = spacer.getBoundingClientRect();
      if (sr.width < 8) return;
      bar.style.left = `${Math.round(sr.left)}px`;
      bar.style.width = `${Math.round(sr.width)}px`;
    };

    const slotBottom = (wasStuck: boolean) =>
      wasStuck
        ? spacer.getBoundingClientRect().bottom
        : bar.getBoundingClientRect().bottom;

    const onScroll = () => {
      raf = 0;
      const wasStuck = bar.classList.contains("is-stuck");

      if (!wasStuck && !barIsVisible()) {
        publishBarH();
        return;
      }

      measureExpandedH();
      const scrollY =
        window.scrollY || document.documentElement.scrollTop || 0;
      const bottom = slotBottom(wasStuck);

      let shouldStuck: boolean;
      if (scrollY <= 8) {
        shouldStuck = false;
      } else if (wasStuck) {
        shouldStuck = bottom <= GNB_H + UNPIN_SLOP_PX;
      } else {
        shouldStuck = bottom <= GNB_H - PIN_SLOP_PX;
      }

      if (shouldStuck) {
        if (!wasStuck) pinBar();
        else syncFixedGeometry();
      } else if (wasStuck) {
        clearPin();
      }
      publishBarH();
    };

    const onScrollOrResize = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(onScroll);
    };

    measureExpandedH();
    onScroll();
    const settle = window.requestAnimationFrame(() => {
      measureExpandedH();
      onScroll();
    });

    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.cancelAnimationFrame(settle);
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      clearPin();
      document.documentElement.style.removeProperty("--bar-h");
    };
  }, []);

  const popMetrics = psaPopulationMetrics ?? {
    gradeLabel: "PSA 10",
    gradePop: null,
    totalPsaPop: totalPopulation ?? null,
    psa10Pop: null,
  };
  const popLabel = `${(popMetrics.gradeLabel || gradeLabel).replace(/\s+/g, " ")} Pop.`;
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

  const hasAsk =
    lowestAskUsd != null && Number.isFinite(lowestAskUsd) && lowestAskUsd > 0;
  const hasBid =
    highestBidUsd != null &&
    Number.isFinite(highestBidUsd) &&
    highestBidUsd > 0;
  const showTradeBook = Boolean(onBuyLowestAsk || onPlaceBid);
  const volumeLabel = "Volume 1Y";
  const velocityLabel = "Velocity 1Y";

  return (
    <div className="cd-stat-main">
      {/* Pin probe kept for layout; condense uses live bar geometry. */}
      <div className="cd-hero-sentinel" ref={sentinelRef} aria-hidden />
      {/* Condensed in-flow slot while the bar is position:fixed. */}
      <div className="cd-hero-bar-spacer" ref={spacerRef} aria-hidden />
      <div
        className="cd-hero-bar"
        id="hero-bar"
        ref={barRef}
        data-testid="collection-detail-hero-bar"
      >
        {stuckLabel ? (
          <div className="cd-hero-bar__stuck-title" id="hero-title-stuck">
            {stuckLabel}
          </div>
        ) : null}

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

        <div className="cd-hero-bar__mid" id="hero-mid" ref={midRef}>
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
                    className={`cd-chart-panel__chg tkl-mono${
                      changeTone === "down"
                        ? " cd-chart-panel__chg--down"
                        : changeTone === "up"
                          ? " cd-chart-panel__chg--up"
                          : ""
                    }`}
                  >
                    <span className="cd-chg-glyph" aria-hidden>
                      {changeTag.arrow}
                    </span>{" "}
                    {changeTag.label}
                  </span>
                ) : (
                  <TkTag tone="neutral" className="cd-hero-bar__change-tag">
                    {REFERENCE_CHANGE_UNAVAILABLE_LABEL}
                  </TkTag>
                )}
                <span className="cd-hero-bar__period mono">
                  {periodChipLabel(changePeriod)}
                </span>
              </div>
            </div>

      {/* Card.html: two `.hero-secondary` columns (Ask/Bid + market · Pop + gem) */}
            <div className="cd-hero-bar__secondary hero-secondary cd-hero-bar__secondary--wide">
              <div className="cd-hero-bar__sec-row">
                <span className="cd-hero-bar__sec-lbl mono">Ask | Bid</span>
                <span className="cd-hero-bar__sec-val mono cd-hero-bar__askbid">
                  <span id="ob-ask">{formatAskBidUsd(lowestAskUsd)}</span>
                  {" | "}
                  <span
                    id="ob-bid"
                    className={hasBid ? "cd-hero-bar__sec-val--bid" : undefined}
                  >
                    {formatAskBidUsd(highestBidUsd)}
                  </span>
                </span>
              </div>
              <div className="cd-hero-bar__sec-row">
                <span className="cd-hero-bar__sec-lbl mono">30D Median</span>
                <span className="cd-hero-bar__sec-val mono">
                  {tradeVolumeLoading && median30dUsd == null
                    ? "—"
                    : formatUsdCompact(median30dUsd)}
                </span>
              </div>
              <div className="cd-hero-bar__sec-row">
                <span className="cd-hero-bar__sec-lbl mono">Market cap</span>
                <span className="cd-hero-bar__sec-val mono">
                  {formatMarketCap(marketCapUsd)}
                </span>
              </div>
              <div className="cd-hero-bar__sec-row">
                <span className="cd-hero-bar__sec-lbl mono">{volumeLabel}</span>
                <span className="cd-hero-bar__sec-val mono">
                  {tradeVolumeLoading && tradeVolumeUsdc == null
                    ? "—"
                    : tradeVolumeUsdc == null
                      ? "—"
                      : formatUsdCompact(tradeVolumeUsdc)}
                </span>
              </div>
            </div>

            <div className="cd-hero-bar__secondary hero-secondary">
              <div className="cd-hero-bar__sec-row">
                <span className="cd-hero-bar__sec-lbl mono">{popLabel}</span>
                <span className="cd-hero-bar__sec-val mono">{popValue}</span>
              </div>
              <div className="cd-hero-bar__sec-row">
                <span className="cd-hero-bar__sec-lbl mono">Gem rate</span>
                <span className="cd-hero-bar__sec-val mono">
                  {gemRateLabel}
                </span>
              </div>
              <div className="cd-hero-bar__sec-row">
                <span className="cd-hero-bar__sec-lbl mono">{velocityLabel}</span>
                <span className="cd-hero-bar__sec-val mono">
                  {tradeVolumeLoading &&
                  velocityPct == null &&
                  marketCapUsd == null
                    ? "—"
                    : formatVelocityPercent(velocityPct)}
                </span>
              </div>
            </div>
          </div>

            {showTradeBook ? (
              <div className="cd-hero-bar__book" id="hero-book">
                {onBuyLowestAsk ? (
                  <TkButton
                    type="button"
                    variant="primary"
                    className="cd-hero-bar__buy-btn"
                    disabled={buyDisabled || !hasAsk}
                    onClick={onBuyLowestAsk}
                  >
                    Buy
                  </TkButton>
                ) : null}
                {onPlaceBid ? (
                  <TkButton
                    type="button"
                    variant="subtle"
                    className="cd-hero-bar__bid-btn bid-btn"
                    disabled={bidDisabled}
                    onClick={onPlaceBid}
                  >
                    Bid
                  </TkButton>
                ) : null}
              </div>
            ) : null}
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
