"use client";

import { useEffect, useMemo, useState } from "react";
import { TkButton } from "@/components/ds";
import { sanitizeTokenBidPriceInput } from "@/hooks/token-offer/useTokenOffer";

export type CollectionDetailTradeTab = "buy" | "bid" | "sell";

/** One selectable copy in Buy / Sell cert carousels (Card.html `#tk-trade`). */
export type CollectionTradeCertItem = {
  tokenId: number;
  /** e.g. `Cert. 64950960 · Tokenable Vault` */
  label: string;
  /** Buy tab: ask price for this listing. */
  priceUsd?: number;
};

function moneyRound(n: number): string {
  if (!(n > 0) || !Number.isFinite(n)) return "—";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function formatAdjDisplay(raw: string): string {
  if (!raw) return "";
  const intDigits = raw.replace(/[^0-9]/g, "");
  if (!intDigits) return "";
  const intNum = parseInt(intDigits, 10);
  return Number.isFinite(intNum) ? intNum.toLocaleString("en-US") : intDigits;
}

function usdFromRaw(raw: string): number {
  const n = parseInt(raw.replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function rawFromUsd(n: number): string {
  if (!(n > 0) || !Number.isFinite(n)) return "";
  return String(Math.round(n));
}

function Chevron({
  dir,
  active,
}: {
  dir: "prev" | "next";
  active: boolean;
}) {
  const stroke = active ? "var(--brand-400, #5B9AFF)" : "var(--t3)";
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {dir === "prev" ? (
        <polyline points="15 18 9 12 15 6" />
      ) : (
        <polyline points="9 18 15 12 9 6" />
      )}
    </svg>
  );
}

function CertCarousel({
  items,
  index,
  onIndexChange,
  emptyLabel,
}: {
  items: CollectionTradeCertItem[];
  index: number;
  onIndexChange: (next: number) => void;
  emptyLabel: string;
}) {
  const total = items.length;
  const current = total > 0 ? items[Math.min(index, total - 1)] : null;
  const canPrev = total > 1 && index > 0;
  const canNext = total > 1 && index < total - 1;

  return (
    <div className="cd-trade-panel__cert">
      <span className="cd-trade-panel__cert-label mono">
        {current?.label ?? emptyLabel}
      </span>
      {total > 0 ? (
        <span className="cd-trade-panel__cert-nav">
          <button
            type="button"
            className="cd-trade-panel__cert-chev"
            aria-label="Previous copy"
            disabled={!canPrev}
            onClick={() => canPrev && onIndexChange(index - 1)}
          >
            <Chevron dir="prev" active={canPrev} />
          </button>
          <span className="cd-trade-panel__cert-idx mono">
            {index + 1}/{total}
          </span>
          <button
            type="button"
            className="cd-trade-panel__cert-chev"
            aria-label="Next copy"
            disabled={!canNext}
            onClick={() => canNext && onIndexChange(index + 1)}
          >
            <Chevron dir="next" active={canNext} />
          </button>
        </span>
      ) : null}
    </div>
  );
}

/**
 * Card.html `#tk-trade` — Buy | Bid | Sell ticket on the detail rail.
 * Panel height is locked (all tab bodies stacked); no warning rows.
 */
export function CollectionDetailTradePanel({
  buyItems = [],
  ownedItems = [],
  lowestAskUsd,
  highestBidUsd,
  lastSaleUsd,
  askCount = 0,
  bidCount = 0,
  onBuy,
  onBid,
  onSell,
  buyDisabled,
  bidDisabled,
  sellDisabled,
  initialTab = "buy",
}: {
  /** Active asks (lowest first) — Buy cert carousel. */
  buyItems?: CollectionTradeCertItem[];
  /** Wallet-owned copies — Sell cert carousel. */
  ownedItems?: CollectionTradeCertItem[];
  /** Market floor ask (for bid/sell hints); Buy “You pay” uses selected copy. */
  lowestAskUsd?: number | null;
  highestBidUsd?: number | null;
  lastSaleUsd?: number | null;
  askCount?: number;
  bidCount?: number;
  onBuy: (tokenId: number) => void;
  onBid: (priceUsd: number) => void;
  onSell: (tokenId: number, priceUsd: number) => void;
  buyDisabled?: boolean;
  bidDisabled?: boolean;
  sellDisabled?: boolean;
  initialTab?: CollectionDetailTradeTab;
}) {
  const [tab, setTab] = useState<CollectionDetailTradeTab>(initialTab);
  const [buyIndex, setBuyIndex] = useState(0);
  const [sellIndex, setSellIndex] = useState(0);

  useEffect(() => {
    setBuyIndex((i) =>
      buyItems.length === 0 ? 0 : Math.min(i, buyItems.length - 1),
    );
  }, [buyItems.length]);
  useEffect(() => {
    setSellIndex((i) =>
      ownedItems.length === 0 ? 0 : Math.min(i, ownedItems.length - 1),
    );
  }, [ownedItems.length]);

  const selectedBuy = buyItems[buyIndex] ?? null;
  const selectedOwned = ownedItems[sellIndex] ?? null;

  const payUsd =
    selectedBuy?.priceUsd != null && selectedBuy.priceUsd > 0
      ? selectedBuy.priceUsd
      : 0;
  const floorAsk =
    lowestAskUsd != null && lowestAskUsd > 0
      ? lowestAskUsd
      : payUsd > 0
        ? payUsd
        : 0;
  const topBid =
    highestBidUsd != null && highestBidUsd > 0 ? highestBidUsd : 0;
  const last =
    lastSaleUsd != null && lastSaleUsd > 0
      ? lastSaleUsd
      : floorAsk > 0
        ? floorAsk
        : topBid;

  const defaultBid = useMemo(
    () =>
      topBid > 0 ? Math.round(topBid * 1.01) : last > 0 ? Math.round(last) : 0,
    [topBid, last],
  );
  const defaultSell = useMemo(
    () =>
      floorAsk > 0
        ? Math.round(floorAsk * 0.99)
        : last > 0
          ? Math.round(last)
          : 0,
    [floorAsk, last],
  );

  const [bidRaw, setBidRaw] = useState(() => rawFromUsd(defaultBid));
  const [sellRaw, setSellRaw] = useState(() => rawFromUsd(defaultSell));
  const [bidTouched, setBidTouched] = useState(false);
  const [sellTouched, setSellTouched] = useState(false);

  useEffect(() => {
    if (bidTouched) return;
    setBidRaw(rawFromUsd(defaultBid));
  }, [defaultBid, bidTouched]);
  useEffect(() => {
    if (sellTouched) return;
    setSellRaw(rawFromUsd(defaultSell));
  }, [defaultSell, sellTouched]);

  const bidUsd = usdFromRaw(bidRaw);
  const sellUsd = usdFromRaw(sellRaw);

  const bumpBid = (deltaPct: number) => {
    setBidTouched(true);
    const base = bidUsd > 0 ? bidUsd : defaultBid || 1;
    setBidRaw(rawFromUsd(Math.max(1, Math.round(base * (1 + deltaPct)))));
  };
  const bumpSell = (deltaPct: number) => {
    setSellTouched(true);
    const base = sellUsd > 0 ? sellUsd : defaultSell || 1;
    setSellRaw(rawFromUsd(Math.max(1, Math.round(base * (1 + deltaPct)))));
  };

  const bidHint = useMemo(() => {
    if (!(bidUsd > 0))
      return { text: "Enter a bid", tone: "muted" as const };
    if (floorAsk > 0 && bidUsd >= floorAsk) {
      return {
        text:
          bidCount > 0
            ? `The highest of ${bidCount} bids`
            : "The highest bid",
        tone: "pos" as const,
      };
    }
    if (topBid > 0 && bidUsd > topBid) {
      return {
        text:
          bidCount > 0
            ? `The highest of ${bidCount} bids`
            : "The highest bid",
        tone: "pos" as const,
      };
    }
    if (topBid > 0 && bidUsd <= topBid) {
      return { text: "Below top bid", tone: "muted" as const };
    }
    return { text: "Your bid", tone: "pos" as const };
  }, [bidUsd, floorAsk, topBid, bidCount]);

  const sellHint = useMemo(() => {
    if (!(sellUsd > 0))
      return { text: "Enter a price", tone: "muted" as const };
    if (topBid > 0 && sellUsd <= topBid) {
      return { text: "At or below top bid", tone: "muted" as const };
    }
    if (floorAsk > 0 && sellUsd < floorAsk) {
      return {
        text: askCount > 0 ? `Lowest of ${askCount} asks` : "Lowest ask",
        tone: "pos" as const,
      };
    }
    if (floorAsk > 0 && sellUsd >= floorAsk) {
      return { text: "Above lowest ask", tone: "muted" as const };
    }
    return { text: "Your price", tone: "pos" as const };
  }, [sellUsd, floorAsk, topBid, askCount]);

  const hasAsk = payUsd > 0 && selectedBuy != null;
  const buyMeta =
    askCount > 0
      ? `Lowest of ${askCount} asks`
      : hasAsk
        ? "Lowest ask"
        : "No asks";
  const bidMeetsAsk = floorAsk > 0 && bidUsd >= floorAsk;
  const hasOwned = selectedOwned != null;

  return (
    <div className="cd-trade-panel cd-notch" id="tk-trade">
      <div className="cd-trade-panel__tabs" id="tk-trade-tabs" role="tablist">
        {(
          [
            ["buy", "Buy"],
            ["bid", "Bid"],
            ["sell", "Sell"],
          ] as const
        ).map(([id, label]) => {
          const on = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={on}
              className={`cd-trade-panel__tab${on ? " cd-trade-panel__tab--on" : ""}`}
              data-tt={id}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* All bodies stay mounted + stacked so panel height never changes. */}
      <div className="cd-trade-panel__bodies">
        <div
          className={`cd-trade-panel__body${tab === "buy" ? "" : " cd-trade-panel__body--off"}`}
          data-ttp="buy"
          role="tabpanel"
          aria-hidden={tab !== "buy"}
        >
          <CertCarousel
            items={buyItems}
            index={buyIndex}
            onIndexChange={setBuyIndex}
            emptyLabel="No asks in this collection"
          />
          <div className="cd-trade-panel__field">
            <span className="cd-trade-panel__field-lbl">You pay</span>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="cd-trade-panel__lock"
              aria-hidden
            >
              <rect x="4" y="11" width="16" height="9" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            <span className="cd-trade-panel__field-val mono">
              {moneyRound(payUsd)}
            </span>
          </div>
          <div className="cd-trade-panel__meta">
            <span className="cd-trade-panel__meta-muted">{buyMeta}</span>
            <span className="cd-trade-panel__meta-muted">Set by seller</span>
          </div>
          <TkButton
            type="button"
            variant="primary"
            className="cd-trade-panel__cta"
            disabled={tab !== "buy" || buyDisabled || !hasAsk}
            tabIndex={tab === "buy" ? 0 : -1}
            onClick={() => selectedBuy && onBuy(selectedBuy.tokenId)}
          >
            Buy now
          </TkButton>
        </div>

        <div
          className={`cd-trade-panel__body${tab === "bid" ? "" : " cd-trade-panel__body--off"}`}
          data-ttp="bid"
          role="tabpanel"
          aria-hidden={tab !== "bid"}
        >
          <div className="cd-trade-panel__row">
            <span className="cd-trade-panel__row-lbl">Highest bid</span>
            <span className="cd-trade-panel__row-val mono">
              {topBid > 0 ? moneyRound(topBid) : "—"}
            </span>
          </div>
          <div className="cd-trade-panel__adj">
            <span className="cd-trade-panel__field-lbl">Your bid</span>
            <button
              type="button"
              className="cd-trade-panel__adj-btn"
              aria-label="−1%"
              disabled={tab !== "bid" || !(bidUsd > 0)}
              tabIndex={tab === "bid" ? 0 : -1}
              onClick={() => bumpBid(-0.01)}
            >
              −
            </button>
            <input
              id="tt-bid-v"
              className="cd-trade-panel__adj-input mono"
              type="text"
              inputMode="numeric"
              aria-label="Your bid amount"
              placeholder={defaultBid > 0 ? moneyRound(defaultBid) : "$0"}
              value={bidRaw ? `$${formatAdjDisplay(bidRaw)}` : ""}
              disabled={tab !== "bid"}
              tabIndex={tab === "bid" ? 0 : -1}
              onChange={(e) => {
                setBidTouched(true);
                setBidRaw(sanitizeTokenBidPriceInput(e.target.value));
              }}
            />
            <button
              type="button"
              className="cd-trade-panel__adj-btn"
              aria-label="+1%"
              disabled={tab !== "bid"}
              tabIndex={tab === "bid" ? 0 : -1}
              onClick={() => bumpBid(0.01)}
            >
              +
            </button>
          </div>
          <div className="cd-trade-panel__meta">
            <span
              className={
                bidHint.tone === "pos"
                  ? "cd-trade-panel__meta-pos"
                  : "cd-trade-panel__meta-muted"
              }
              id="tt-bid-hint"
            >
              {bidHint.text}
            </span>
            <span className="cd-trade-panel__meta-muted">Top bid +1%</span>
          </div>
          <TkButton
            type="button"
            variant="primary"
            className="cd-trade-panel__cta"
            disabled={
              tab !== "bid" ||
              (bidMeetsAsk
                ? buyDisabled || buyItems.length === 0
                : bidDisabled || !(bidUsd > 0))
            }
            tabIndex={tab === "bid" ? 0 : -1}
            onClick={() => {
              if (bidMeetsAsk) {
                const floor = buyItems[0];
                if (floor) onBuy(floor.tokenId);
                return;
              }
              onBid(bidUsd);
            }}
          >
            {bidMeetsAsk ? "Buy" : "Place bid"}
          </TkButton>
        </div>

        <div
          className={`cd-trade-panel__body${tab === "sell" ? "" : " cd-trade-panel__body--off"}`}
          data-ttp="sell"
          role="tabpanel"
          aria-hidden={tab !== "sell"}
        >
          <CertCarousel
            items={ownedItems}
            index={sellIndex}
            onIndexChange={setSellIndex}
            emptyLabel="None in this collection"
          />
          <div className="cd-trade-panel__adj">
            <span className="cd-trade-panel__field-lbl">Your price</span>
            <button
              type="button"
              className="cd-trade-panel__adj-btn"
              aria-label="−1%"
              disabled={tab !== "sell" || !(sellUsd > 0)}
              tabIndex={tab === "sell" ? 0 : -1}
              onClick={() => bumpSell(-0.01)}
            >
              −
            </button>
            <span id="tt-sell-v" className="cd-trade-panel__adj-val mono">
              {sellUsd > 0 ? moneyRound(sellUsd) : "—"}
            </span>
            <button
              type="button"
              className="cd-trade-panel__adj-btn"
              aria-label="+1%"
              disabled={tab !== "sell"}
              tabIndex={tab === "sell" ? 0 : -1}
              onClick={() => bumpSell(0.01)}
            >
              +
            </button>
          </div>
          <div className="cd-trade-panel__meta">
            <span
              className={
                sellHint.tone === "pos"
                  ? "cd-trade-panel__meta-pos"
                  : "cd-trade-panel__meta-muted"
              }
              id="tt-sell-hint"
            >
              {sellHint.text}
            </span>
            <span className="cd-trade-panel__meta-muted">Ask −1%</span>
          </div>
          <TkButton
            type="button"
            variant="primary"
            className="cd-trade-panel__cta"
            disabled={
              tab !== "sell" || sellDisabled || !hasOwned || !(sellUsd > 0)
            }
            tabIndex={tab === "sell" ? 0 : -1}
            onClick={() => {
              if (!selectedOwned || !(sellUsd > 0)) return;
              onSell(selectedOwned.tokenId, sellUsd);
            }}
          >
            List for sale
          </TkButton>
        </div>
      </div>
    </div>
  );
}
