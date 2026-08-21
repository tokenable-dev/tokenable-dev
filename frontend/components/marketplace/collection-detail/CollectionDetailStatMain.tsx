"use client";

import { useEffect, useRef, useState } from "react";
import { TkButton, TkTag } from "@/components/ds";
import {
  formatReferencePercentChange,
  formatUsdCompact,
  formatPsaPopulationCount,
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

function HeroMeta({
  meta,
  gradeLabel,
}: {
  meta: string | null;
  gradeLabel: string;
}) {
  if (!meta) return null;
  const grade = gradeLabel.trim();
  if (grade && meta.toLowerCase().endsWith(grade.toLowerCase())) {
    const prefix = meta
      .slice(0, meta.length - grade.length)
      .replace(/\s*·\s*$/, "")
      .trim();
    return (
      <div className="cd-hero-bar__meta mono" id="hero-meta">
        {prefix ? (
          <>
            {prefix} ·{" "}
          </>
        ) : null}
        <strong className="cd-hero-bar__meta-grade">{grade}</strong>
      </div>
    );
  }
  return (
    <div className="cd-hero-bar__meta mono" id="hero-meta">
      {meta}
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
  lowestAskUsd,
  highestBidUsd,
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
  tradeVolumeUsdc: number | null;
  tradeVolumeLoading: boolean;
  marketCapUsd: number | null;
  formatMarketCap: (n: number | null | undefined) => string;
  psaPopulationMetrics?: PsaPopulationMetrics | null;
  totalPopulation?: number | null;
  lowestAskUsd?: number | null;
  highestBidUsd?: number | null;
  onBuyLowestAsk?: () => void;
  onPlaceBid?: () => void;
  buyDisabled?: boolean;
  bidDisabled?: boolean;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const midRef = useRef<HTMLDivElement>(null);
  const coverSrc = imageUrl?.trim() || null;
  const stuckLabel = stuckTitle?.trim() || null;
  const title = headlineTitle?.trim() || null;
  const meta = headlineMeta?.trim() || null;

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    let raf = 0;
    let poll: number | undefined;
    let stopPoll: number | undefined;
    let barHSettle: number | undefined;
    let lastBarH = -1;

    const publishBarH = () => {
      const next = Math.round(bar.getBoundingClientRect().height);
      if (next <= 0 || next === lastBarH) return;
      lastBarH = next;
      document.documentElement.style.setProperty("--bar-h", `${next}px`);
    };

    const publishBarHAfterTransition = () => {
      if (barHSettle != null) window.clearTimeout(barHSettle);
      barHSettle = window.setTimeout(() => {
        barHSettle = undefined;
        publishBarH();
      }, 180);
    };

    /** Card.html `syncCardImg` — match thumb height to `#hero-mid` on desktop. */
    const syncCardImg = () => {
      const img = bar.querySelector<HTMLElement>("#hero-img");
      const mid = midRef.current;
      if (!img || !mid) return;
      if (window.innerWidth < 1024 || bar.classList.contains("is-stuck")) {
        img.style.height = "";
        return;
      }
      const h = Math.round(mid.getBoundingClientRect().height);
      if (h > 40) img.style.height = `${h}px`;
    };

    const onScroll = () => {
      raf = 0;
      const r = bar.getBoundingClientRect();
      /* Card.html: stuck when sticky top reaches ~70px (desktop header). */
      const stuckTop = window.innerWidth <= 1023 ? 56 : 70;
      const stuck = r.top <= stuckTop;
      const wasStuck = bar.classList.contains("is-stuck");
      bar.classList.toggle("is-stuck", stuck);
      if (stuck !== wasStuck) {
        publishBarHAfterTransition();
      } else {
        publishBarH();
      }
      syncCardImg();
    };

    const onScrollOrResize = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        onScroll();
        syncCardImg();
      });
    };

    const scrollTargets: EventTarget[] = [window, document];
    let node: HTMLElement | null = bar.parentElement;
    while (node && node !== document.documentElement) {
      const { overflowY, overflow } = getComputedStyle(node);
      if (
        /(auto|scroll|overlay)/.test(overflowY) ||
        /(auto|scroll|overlay)/.test(overflow)
      ) {
        scrollTargets.push(node);
      }
      node = node.parentElement;
    }

    onScroll();
    syncCardImg();
    for (const t of scrollTargets) {
      t.addEventListener("scroll", onScrollOrResize, { passive: true });
    }
    window.addEventListener("resize", onScrollOrResize);
    bar.addEventListener("transitionend", publishBarH);
    poll = window.setInterval(() => {
      onScroll();
      syncCardImg();
    }, 400);
    stopPoll = window.setTimeout(() => {
      if (poll != null) window.clearInterval(poll);
    }, 6000);

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      for (const t of scrollTargets) {
        t.removeEventListener("scroll", onScrollOrResize);
      }
      window.removeEventListener("resize", onScrollOrResize);
      bar.removeEventListener("transitionend", publishBarH);
      if (poll != null) window.clearInterval(poll);
      if (stopPoll != null) window.clearTimeout(stopPoll);
      if (barHSettle != null) window.clearTimeout(barHSettle);
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

  return (
    <div className="cd-stat-main">
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
            className="cd-hero-bar__thumb cd-hero-bar__thumb--empty"
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
              <HeroMeta meta={meta} gradeLabel={gradeLabel} />
            </div>
          ) : null}

          <div className="cd-hero-bar__metrics">
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

            <div className="cd-hero-bar__secondary hero-secondary">
              <div className="cd-hero-bar__sec-row">
                <span className="cd-hero-bar__sec-lbl mono">Market cap</span>
                <span className="cd-hero-bar__sec-val mono">
                  {formatMarketCap(marketCapUsd)}
                </span>
              </div>
              <div className="cd-hero-bar__sec-row">
                <span className="cd-hero-bar__sec-lbl mono">Volume 30D</span>
                <span className="cd-hero-bar__sec-val mono">
                  {tradeVolumeLoading && tradeVolumeUsdc == null
                    ? "—"
                    : formatUsdCompact(
                        tradeVolumeUsdc != null &&
                          Number.isFinite(tradeVolumeUsdc)
                          ? tradeVolumeUsdc
                          : 0,
                      )}
                </span>
              </div>
              <div className="cd-hero-bar__sec-row">
                <span className="cd-hero-bar__sec-lbl mono">{popLabel}</span>
                <span className="cd-hero-bar__sec-val mono">{popValue}</span>
              </div>
              <div className="cd-hero-bar__sec-row">
                <span className="cd-hero-bar__sec-lbl mono">Lowest ask</span>
                <span className="cd-hero-bar__sec-val mono" id="ob-ask">
                  {formatBookUsd(lowestAskUsd)}
                </span>
              </div>
              <div className="cd-hero-bar__sec-row">
                <span className="cd-hero-bar__sec-lbl mono">Highest bid</span>
                <span
                  className={`cd-hero-bar__sec-val mono${hasBid ? " cd-hero-bar__sec-val--bid" : ""}`}
                  id="ob-bid"
                >
                  {formatBookUsd(highestBidUsd)}
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
