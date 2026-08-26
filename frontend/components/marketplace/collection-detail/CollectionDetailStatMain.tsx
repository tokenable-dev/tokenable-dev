"use client";

import { useEffect, useRef, useState } from "react";
import { TkButton, TkTag } from "@/components/ds";
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
import { AssetDetailHeadlineTitle } from "@/components/marketplace/marketplace-shared";

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

function formatBookUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return "—";
  return formatUsdCompact(n);
}

/** Strip grade/number already shown in `#hero-title` (meta is Year · Set · Variant). */
function stripHeroTitleDupesFromMeta(
  meta: string,
  gradeLabel: string,
  cardNumber?: string | null,
): string {
  let text = meta.trim();
  const stripTrailingSegment = (segment: string) => {
    const s = segment.trim();
    if (!s) return;
    const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text
      .replace(new RegExp(`(?:\\s*·\\s*|\\s+)${escaped}\\s*$`, "i"), "")
      .trim();
  };
  stripTrailingSegment(gradeLabel);
  stripTrailingSegment(cardNumber ?? "");
  return text;
}

function HeroMeta({
  meta,
  gradeLabel,
  cardNumber,
}: {
  meta: string | null;
  gradeLabel: string;
  cardNumber?: string | null;
}) {
  if (!meta) return null;
  const text = stripHeroTitleDupesFromMeta(meta, gradeLabel, cardNumber);
  if (!text) return null;
  return (
    <div className="cd-hero-bar__meta" id="hero-meta">
      {text}
    </div>
  );
}

/**
 * Card.html `#hero-bar` (2026 redesign):
 * image | mid(title+meta · last price + stats + Buy/Bid buttons).
 * Mobile: book hidden → `#ob-bottom-bar`; sticky condense on scroll.
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
    /**
     * After the expanded hero has fully cleared the GNB, require this much
     * additional scroll before condensing. Enough to avoid flick collapse,
     * but not so high that the full hero stays on screen too long.
     */
    const condenseExtraPx = () =>
      Math.max(240, Math.round(window.innerHeight * 0.3));
    /** Extra scroll (px) required to unpin after a pin — avoids thrash. */
    const UNPIN_HYSTERESIS_PX = 80;

    let raf = 0;
    let lastBarH = -1;
    /** Last measured expanded (non-stuck) bar height. */
    let expandedH = 0;
    /** scrollY at which we last pinned — unpin only after scrolling back past this. */
    let pinnedAtScrollY: number | null = null;

    const publishBarH = () => {
      const next = Math.round(bar.getBoundingClientRect().height);
      if (next <= 0 || next === lastBarH) return;
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

    const clearMobilePin = () => {
      spacer.style.height = "";
      bar.classList.remove("is-stuck");
      pinnedAtScrollY = null;
    };

    const pinMobile = (scrollY: number) => {
      // Capture margin before `.is-stuck` zeros it.
      const mb = marginBottom();
      measureExpandedH();
      const flowH = expandedH > STUCK_BAR_H ? expandedH : STUCK_BAR_H;
      bar.classList.add("is-stuck");
      // Keep in-flow height ≈ expanded hero so pin/unpin does not jump the page.
      spacer.style.height = `${flowH + mb}px`;
      pinnedAtScrollY = scrollY;
    };

    const onScroll = () => {
      raf = 0;
      const mobile = window.innerWidth <= 1023;
      const stuckTop = mobile ? 64 : 70;
      const wasStuck = bar.classList.contains("is-stuck");

      // Hidden twin (desktop cluster on mobile / mobile panel on desktop).
      if (!wasStuck && !barIsVisible()) {
        publishBarH();
        return;
      }

      if (mobile) {
        measureExpandedH();
        const scrollY =
          window.scrollY || document.documentElement.scrollTop || 0;

        let shouldStuck: boolean;
        if (scrollY <= 8) {
          shouldStuck = false;
        } else if (wasStuck && pinnedAtScrollY != null) {
          shouldStuck = scrollY >= pinnedAtScrollY - UNPIN_HYSTERESIS_PX;
        } else if (wasStuck) {
          shouldStuck = true;
        } else {
          const rect = bar.getBoundingClientRect();
          const extra = condenseExtraPx();
          // Hero must fully clear the GNB, then scroll ~0.3 viewport more.
          shouldStuck = rect.bottom <= stuckTop - extra;
        }

        if (shouldStuck) {
          if (!wasStuck) pinMobile(scrollY);
        } else if (wasStuck) {
          clearMobilePin();
        }
      } else {
        if (wasStuck && spacer.style.height) clearMobilePin();
        // Desktop sticky: only condense after a meaningful scroll.
        const rect = bar.getBoundingClientRect();
        const scrollY =
          window.scrollY || document.documentElement.scrollTop || 0;
        const nearTop = rect.top <= stuckTop + 1;
        const scrolledEnough =
          scrollY >= Math.max(160, Math.round(window.innerHeight * 0.2));
        bar.classList.toggle("is-stuck", nearTop && scrolledEnough);
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
      clearMobilePin();
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
  const changeTagTone =
    changeTone === "down"
      ? "danger"
      : changeTone === "up"
        ? "positive"
        : "neutral";

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
                <AssetDetailHeadlineTitle
                  as="h1"
                  parts={headlineParts}
                  className="cd-hero-bar__title"
                  id="hero-title"
                  grade={gradeLabel}
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
              />
            </div>
          ) : null}

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
                  <TkTag
                    tone={changeTagTone}
                    className="cd-hero-bar__change-tag"
                  >
                    <span aria-hidden>{changeTag.arrow}</span>{" "}
                    {changeTag.label}
                  </TkTag>
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
                <span className="cd-hero-bar__sec-lbl mono">Ask / Bid</span>
                <span className="cd-hero-bar__sec-val mono cd-hero-bar__askbid">
                  <span id="ob-ask">{formatBookUsd(lowestAskUsd)}</span>
                  {" / "}
                  <span
                    id="ob-bid"
                    className={hasBid ? "cd-hero-bar__sec-val--bid" : undefined}
                  >
                    {formatBookUsd(highestBidUsd)}
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
                    Buy now
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
