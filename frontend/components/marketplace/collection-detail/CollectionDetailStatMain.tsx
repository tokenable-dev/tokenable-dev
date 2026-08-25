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

/** Strip grade/number already shown in `#hero-title` (Card.html: meta is Year · Set · … only). */
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
    <div className="cd-hero-bar__meta mono" id="hero-meta">
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
    const sentinel = sentinelRef.current;
    if (!bar || !spacer || !sentinel) return;

    const STUCK_BAR_H = 68;
    /** Small edge band only — a large slack trapped condensed state at page top. */
    const UNPIN_SLACK_PX = 12;

    let raf = 0;
    let lastBarH = -1;
    let stuckSpacerH = 0;

    const publishBarH = () => {
      const next = Math.round(bar.getBoundingClientRect().height);
      if (next <= 0 || next === lastBarH) return;
      lastBarH = next;
      document.documentElement.style.setProperty("--bar-h", `${next}px`);
    };

    const marginBottom = () =>
      parseFloat(getComputedStyle(bar).marginBottom) || 0;

    const clearMobilePin = () => {
      spacer.style.height = "";
      stuckSpacerH = 0;
      bar.classList.remove("is-stuck");
    };

    const pinMobile = () => {
      bar.classList.add("is-stuck");
      stuckSpacerH = STUCK_BAR_H + marginBottom();
      spacer.style.height = `${stuckSpacerH}px`;
    };

    const onScroll = () => {
      raf = 0;
      const mobile = window.innerWidth <= 1023;
      const stuckTop = mobile ? 64 : 70;
      const wasStuck = bar.classList.contains("is-stuck");

      if (mobile) {
        /*
         * Pin from a zero-height sentinel that never changes size — not from the
         * bar/spacer. Near page top always expand so scrolling back restores hero.
         */
        const scrollY =
          window.scrollY || document.documentElement.scrollTop || 0;
        const sentinelTop = sentinel.getBoundingClientRect().top;
        const shouldStuck = wasStuck
          ? scrollY > 2 && sentinelTop <= stuckTop + UNPIN_SLACK_PX
          : sentinelTop <= stuckTop;

        if (shouldStuck) {
          if (!wasStuck) pinMobile();
        } else if (wasStuck) {
          clearMobilePin();
        }
      } else {
        if (wasStuck && spacer.style.height) clearMobilePin();
        bar.classList.toggle(
          "is-stuck",
          bar.getBoundingClientRect().top <= stuckTop,
        );
      }
      publishBarH();
    };

    const onScrollOrResize = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(onScroll);
    };

    onScroll();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
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
      {/* Stable pin probe — height never changes, so shrink/expand can't thrash. */}
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
