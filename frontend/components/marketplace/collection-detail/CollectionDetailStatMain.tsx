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
  const short = formatReferenceChangePeriodShort(
    period ?? null,
    period?.marketChangeWindow ?? null,
  );
  return `${short.toUpperCase()} Chg.`;
}

function formatBookUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return "—";
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/**
 * Card.html `#hero-bar` — sticky, binary `is-stuck` when `top <= 70`,
 * with CSS `transition` on padding / image height (same as the prototype).
 */
export function CollectionDetailStatMain({
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
  const coverSrc = imageUrl?.trim() || null;

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    let raf = 0;
    let poll: number | undefined;
    let stopPoll: number | undefined;
    let barHSettle: number | undefined;
    let lastBarH = -1;

    const publishBarH = () => {
      if (window.innerWidth <= 900) {
        if (lastBarH !== -1) {
          document.documentElement.style.removeProperty("--bar-h");
          lastBarH = -1;
        }
        return;
      }
      const next = Math.round(bar.getBoundingClientRect().height);
      if (next <= 0 || next === lastBarH) return;
      lastBarH = next;
      document.documentElement.style.setProperty("--bar-h", `${next}px`);
    };

    const publishBarHAfterTransition = () => {
      if (barHSettle != null) window.clearTimeout(barHSettle);
      /* Match .cd-hero-bar height/padding transition (0.16s). */
      barHSettle = window.setTimeout(() => {
        barHSettle = undefined;
        publishBarH();
      }, 180);
    };

    /**
     * Card.html `syncHeroWidth` — size `#hero-book` to the sidebar rail, but
     * never force a width that wraps the book onto a second row under the price.
     */
    const syncHeroWidth = () => {
      const book = bar.querySelector<HTMLElement>("#hero-book");
      const rail =
        document.querySelector<HTMLElement>(".cd-sidebar-sticky") ||
        document.querySelector<HTMLElement>(".cd-detail-grid__sidebar");
      const stats = bar.querySelector<HTMLElement>(":scope > .hero-secondary");
      if (!book) return;
      if (window.innerWidth < 901) {
        book.style.width = "";
        book.style.flex = "";
        book.style.marginRight = "";
        book.style.marginLeft = "";
        if (stats) {
          stats.style.width = "";
          stats.style.flex = "";
          stats.style.minWidth = "";
        }
        return;
      }
      if (!rail) return;

      const railW = Math.round(rail.getBoundingClientRect().width);
      if (railW <= 0) return;

      /* Measure left cluster first with book unconstrained. */
      book.style.width = "auto";
      book.style.flex = "0 0 auto";
      book.style.marginRight = "0px";
      book.style.marginLeft = "auto";

      const main = document.querySelector<HTMLElement>(
        ".cd-detail-grid__chart, .cd-detail-grid__left",
      );
      if (stats && main) {
        stats.style.flex = "0 1 auto";
        stats.style.minWidth = "0px";
        stats.style.width = "auto";
        const right = main.getBoundingClientRect().right;
        const left = stats.getBoundingClientRect().left;
        const statsW = Math.round(right - left);
        if (statsW >= 160) stats.style.width = `${statsW}px`;
      }

      const barRect = bar.getBoundingClientRect();
      const leftCluster = stats ?? bar.querySelector("#hero-priceblock");
      const leftRight = leftCluster
        ? leftCluster.getBoundingClientRect().right
        : barRect.left;
      const avail = Math.floor(barRect.right - leftRight - 20);
      const target = Math.max(180, Math.min(railW, avail > 0 ? avail : railW));
      book.style.width = `${target}px`;
      book.style.flex = `0 0 ${target}px`;
    };

    /** Card.html `onScroll` — stuck iff sticky bar has reached its top offset. */
    const onScroll = () => {
      raf = 0;
      if (window.innerWidth <= 900) {
        bar.classList.remove("is-stuck");
        if (lastBarH !== -1) {
          document.documentElement.style.removeProperty("--bar-h");
          lastBarH = -1;
        }
        return;
      }
      const r = bar.getBoundingClientRect();
      const stuck = r.top <= 70;
      const wasStuck = bar.classList.contains("is-stuck");
      bar.classList.toggle("is-stuck", stuck);
      if (stuck !== wasStuck) {
        publishBarHAfterTransition();
      } else {
        publishBarH();
      }
    };

    const onScrollOrResize = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        onScroll();
        syncHeroWidth();
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
    syncHeroWidth();
    for (const t of scrollTargets) {
      t.addEventListener("scroll", onScrollOrResize, { passive: true });
    }
    window.addEventListener("resize", onScrollOrResize);
    bar.addEventListener("transitionend", publishBarH);
    poll = window.setInterval(() => {
      onScroll();
      syncHeroWidth();
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
  const hasAsk = lowestAskUsd != null && lowestAskUsd > 0;
  const hasBid = highestBidUsd != null && highestBidUsd > 0;
  const showTradeBook = onBuyLowestAsk != null || onPlaceBid != null;
  const changeTagTone =
    changeTone === "down"
      ? "danger"
      : changeTone === "up"
        ? "positive"
        : "neutral";

  return (
    <div ref={barRef} id="hero-bar" className="cd-hero-bar">
      {coverSrc ? (
        <button
          type="button"
          className="cd-hero-bar__thumb-btn"
          onClick={() => setLightboxOpen(true)}
          aria-label="View enlarged collection cover"
          title="Tap to enlarge"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
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

      <div className="cd-hero-bar__priceblock" id="hero-priceblock">
        <div className="cd-hero-bar__lastlbl mono" id="hero-lastlbl">
          Last price
        </div>
        {priceLoading && priceUsd == null ? (
          <div className="cd-hero-bar__price cd-hero-bar__skeleton" aria-hidden />
        ) : priceUsd != null && Number.isFinite(priceUsd) ? (
          <div className="cd-hero-bar__price">{formatUsdCompact(priceUsd)}</div>
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
              <span aria-hidden>{changeTag.arrow}</span> {changeTag.label}
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
          <span className="cd-hero-bar__sec-lbl mono">MKT CAP</span>
          <span className="cd-hero-bar__sec-val mono">
            {formatMarketCap(marketCapUsd)}
          </span>
        </div>
        <div className="cd-hero-bar__sec-row">
          <span className="cd-hero-bar__sec-lbl mono">Vol. 30D</span>
          <span className="cd-hero-bar__sec-val mono">
            {tradeVolumeLoading && tradeVolumeUsdc == null
              ? "—"
              : formatUsdCompact(
                  tradeVolumeUsdc != null && Number.isFinite(tradeVolumeUsdc)
                    ? tradeVolumeUsdc
                    : 0,
                )}
          </span>
        </div>
        <div className="cd-hero-bar__sec-row">
          <span className="cd-hero-bar__sec-lbl mono">
            {(popMetrics.gradeLabel || gradeLabel).replace(/\s+/g, " ")}{" "}
            <span className="cd-hero-bar__sec-pipe">|</span> POP
          </span>
          <span className="cd-hero-bar__sec-val mono">{popValue}</span>
        </div>
      </div>

      {showTradeBook ? (
        <div className="cd-hero-bar__book" id="hero-book">
          <div className="cd-hero-bar__actions" id="hero-actions">
            <div className="cd-hero-bar__book-row">
              <div className="cd-hero-bar__book-col">
                <div className="cd-hero-bar__ob-stat ob-stat mono">
                  Lowest ask
                </div>
                <div className="cd-hero-bar__ob-price ob-stat mono" id="ob-ask">
                  {formatBookUsd(lowestAskUsd)}
                </div>
                {onBuyLowestAsk ? (
                  <TkButton
                    type="button"
                    variant="primary"
                    className="cd-hero-bar__buy-btn"
                    disabled={buyDisabled || !hasAsk}
                    onClick={onBuyLowestAsk}
                  >
                    Buy lowest ask
                  </TkButton>
                ) : null}
              </div>
              <div className="cd-hero-bar__book-col">
                <div className="cd-hero-bar__ob-stat ob-stat mono">
                  Highest bid
                </div>
                <div
                  className={`cd-hero-bar__ob-price ob-stat mono${hasBid ? " cd-hero-bar__ob-price--bid" : ""}`}
                  id="ob-bid"
                >
                  {formatBookUsd(highestBidUsd)}
                </div>
                {onPlaceBid ? (
                  <TkButton
                    type="button"
                    variant="subtle"
                    className="cd-hero-bar__bid-btn bid-btn"
                    disabled={bidDisabled}
                    onClick={onPlaceBid}
                  >
                    Place a bid
                  </TkButton>
                ) : null}
              </div>
            </div>
            <p className="cd-hero-bar__helper hero-secondary">
              A bid fills when any seller&rsquo;s ask meets your price.
            </p>
          </div>
        </div>
      ) : null}

      <RwaImageLightbox
        open={lightboxOpen}
        src={coverSrc}
        alt="Collection cover"
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}
