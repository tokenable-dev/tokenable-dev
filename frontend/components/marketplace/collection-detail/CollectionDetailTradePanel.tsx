"use client";

import { useEffect, useMemo, useState } from "react";
import { TkButton } from "@/components/ds";
import { sanitizeTokenBidPriceInput } from "@/hooks/token-offer/useTokenOffer";

export type CollectionDetailTradeTab = "buy" | "bid" | "sell";

/** One selectable copy in Buy / Sell cert carousels (Card.html `#tk-trade`). */
export type CollectionTradeCertItem = {
  tokenId: number;
  /** e.g. `Cert. 64950960 · TOKN Vault` */
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

/** Whole dollars only. Below $100 step $1; $100+ step 1%. */
function bumpWholeUsd(current: number, direction: 1 | -1): number {
  const base = Math.max(0, Math.round(Number.isFinite(current) ? current : 0));
  if (base < 100) return Math.max(0, base + direction);
  return Math.max(0, Math.round(base * (1 + direction * 0.01)));
}

function rawFromWholeUsd(n: number): string {
  const v = Math.max(0, Math.round(n));
  return String(v);
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
      <span className="cd-trade-panel__cert-label">
        {current?.label ?? (emptyLabel || "\u00a0")}
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
          <span className="cd-trade-panel__cert-idx">
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
 * Inactive tabs are taken out of flow so loading copy cannot stretch the box.
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
  buyBusy = false,
  bidBusy = false,
  sellBusy = false,
  initialTab = "buy",
  focusSeq = 0,
  focusTab,
  focusBuyTokenId,
  focusSellTokenId,
  focusBidUsd,
}: {
  /** Active asks (lowest first) — Buy cert carousel. */
  buyItems?: CollectionTradeCertItem[];
  /** Wallet-owned copies — Sell cert carousel. */
  ownedItems?: CollectionTradeCertItem[];
  /** Market floor ask (Buy tab + Bid ≥ this → Buy now, Card.html `ASK`). */
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
  buyBusy?: boolean;
  bidBusy?: boolean;
  sellBusy?: boolean;
  initialTab?: CollectionDetailTradeTab;
  /** Bump to apply deep-link / order-book focus. */
  focusSeq?: number;
  focusTab?: CollectionDetailTradeTab;
  focusBuyTokenId?: number | null;
  focusSellTokenId?: number | null;
  focusBidUsd?: number | null;
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

  const defaultSell = useMemo(
    () =>
      floorAsk > 0
        ? Math.round(floorAsk * 0.99)
        : last > 0
          ? Math.round(last)
          : 0,
    [floorAsk, last],
  );

  const [bidTouched, setBidTouched] = useState(false);
  const [bidRaw, setBidRaw] = useState("0");
  const [sellRaw, setSellRaw] = useState(() => rawFromUsd(defaultSell));
  const [sellTouched, setSellTouched] = useState(false);

  useEffect(() => {
    if (focusSeq < 1) return;
    if (focusTab) setTab(focusTab);
    if (focusBuyTokenId != null && focusBuyTokenId >= 0) {
      const i = buyItems.findIndex((x) => x.tokenId === focusBuyTokenId);
      if (i >= 0) setBuyIndex(i);
    }
    if (focusSellTokenId != null && focusSellTokenId >= 0) {
      const i = ownedItems.findIndex((x) => x.tokenId === focusSellTokenId);
      if (i >= 0) setSellIndex(i);
    }
    if (focusBidUsd != null && focusBidUsd > 0) {
      setBidTouched(true);
      setBidRaw(rawFromUsd(focusBidUsd));
    }
  }, [focusSeq]);

  useEffect(() => {
    if (sellTouched) return;
    setSellRaw(rawFromUsd(defaultSell));
  }, [defaultSell, sellTouched]);

  const bidUsd = usdFromRaw(bidRaw);
  const sellUsd = usdFromRaw(sellRaw);
  // Card.html `#tk-trade`: `bid >= ASK` (collection live floor, same $ as Buy tab).
  const bidCrossesAsk = floorAsk > 0 && bidUsd >= Math.round(floorAsk);

  useEffect(() => {
    if (bidTouched) return;
    if (topBid > 0) setBidRaw(rawFromUsd(topBid));
  }, [topBid, bidTouched]);

  const bumpBid = (direction: 1 | -1) => {
    setBidTouched(true);
    if (direction === 1 && !(bidUsd > 0) && topBid > 0) {
      setBidRaw(rawFromWholeUsd(bumpWholeUsd(topBid, 1)));
      return;
    }
    setBidRaw(rawFromWholeUsd(bumpWholeUsd(bidUsd, direction)));
  };
  const bumpSell = (direction: 1 | -1) => {
    setSellTouched(true);
    const base = sellUsd > 0 ? sellUsd : defaultSell || 0;
    setSellRaw(rawFromWholeUsd(bumpWholeUsd(base, direction)));
  };

  const hasAsk = payUsd > 0 && selectedBuy != null;
  const buyMeta =
    askCount > 0
      ? `Lowest · ${askCount} ${askCount === 1 ? "Ask" : "Asks"}`
      : hasAsk
        ? "Lowest · Ask"
        : "No asks";

  const bidMeta =
    bidCount > 0
      ? `Highest · ${bidCount} ${bidCount === 1 ? "Bid" : "Bids"}`
      : topBid > 0
        ? "Highest · Bid"
        : "No bids";

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
            emptyLabel=""
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
            <span className="cd-trade-panel__field-val">
              {moneyRound(payUsd)}
            </span>
          </div>
          <div className="cd-trade-panel__foot">
            <div className="cd-trade-panel__meta">
              <span className="cd-trade-panel__meta-muted">{buyMeta}</span>
              <span className="cd-trade-panel__meta-end" aria-hidden="true" />
            </div>
            <TkButton
              type="button"
              variant="primary"
              className="cd-trade-panel__cta"
              disabled={tab !== "buy" || buyDisabled || !hasAsk || buyBusy}
              tabIndex={tab === "buy" ? 0 : -1}
              onClick={() => selectedBuy && onBuy(selectedBuy.tokenId)}
            >
              {buyBusy ? "Buying…" : "Buy now"}
            </TkButton>
          </div>
        </div>
        <div
          className={`cd-trade-panel__body${tab === "bid" ? "" : " cd-trade-panel__body--off"}`}
          data-ttp="bid"
          role="tabpanel"
          aria-hidden={tab !== "bid"}
        >
          <div className="cd-trade-panel__row cd-trade-panel__row--reserved" aria-hidden="true">
            <span className="cd-trade-panel__row-lbl" />
            <span className="cd-trade-panel__row-val" />
          </div>
          <div className="cd-trade-panel__adj">
            <span className="cd-trade-panel__field-lbl">Your bid</span>
            <button
              type="button"
              className="cd-trade-panel__adj-btn"
              aria-label="Decrease bid by 1%"
              disabled={tab !== "bid" || !(bidUsd > 0)}
              tabIndex={tab === "bid" ? 0 : -1}
              onClick={() => bumpBid(-1)}
            >
              −1%
            </button>
            <input
              id="tt-bid-v"
              className="cd-trade-panel__adj-input"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              name="tk-bid-amount"
              aria-label="Your bid amount"
              placeholder="$0"
              value={bidRaw ? `$${formatAdjDisplay(bidRaw)}` : "$0"}
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
              aria-label="Increase bid by 1%"
              disabled={tab !== "bid"}
              tabIndex={tab === "bid" ? 0 : -1}
              onClick={() => bumpBid(1)}
            >
              +1%
            </button>
          </div>
          <div className="cd-trade-panel__foot">
            <div className="cd-trade-panel__meta">
              <span className="cd-trade-panel__meta-muted">{bidMeta}</span>
              <span className="cd-trade-panel__meta-end" aria-hidden="true" />
            </div>
            <TkButton
              type="button"
              variant="primary"
              className="cd-trade-panel__cta"
              disabled={
                tab !== "bid" || bidDisabled || bidBusy || buyBusy || !(bidUsd > 0)
              }
              tabIndex={tab === "bid" ? 0 : -1}
              onClick={() => {
                if (!(bidUsd > 0)) return;
                onBid(bidUsd);
              }}
            >
              {bidCrossesAsk
                ? bidBusy || buyBusy
                  ? "Buying…"
                  : "Buy now"
                : bidBusy
                  ? "Placing bid…"
                  : "Place bid"}
            </TkButton>
          </div>
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
            emptyLabel=""
          />
          <div className="cd-trade-panel__adj">
            <span className="cd-trade-panel__field-lbl">Your price</span>
            <button
              type="button"
              className="cd-trade-panel__adj-btn"
              aria-label="Decrease price by 1%"
              disabled={tab !== "sell" || !(sellUsd > 0)}
              tabIndex={tab === "sell" ? 0 : -1}
              onClick={() => bumpSell(-1)}
            >
              −1%
            </button>
            <input
              id="tt-sell-v"
              className="cd-trade-panel__adj-input"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              name="tk-ask-amount"
              aria-label="Your asking price"
              placeholder={defaultSell > 0 ? moneyRound(defaultSell) : "$0"}
              value={sellRaw ? `$${formatAdjDisplay(sellRaw)}` : ""}
              disabled={tab !== "sell"}
              tabIndex={tab === "sell" ? 0 : -1}
              onChange={(e) => {
                setSellTouched(true);
                setSellRaw(sanitizeTokenBidPriceInput(e.target.value));
              }}
            />
            <button
              type="button"
              className="cd-trade-panel__adj-btn"
              aria-label="Increase price by 1%"
              disabled={tab !== "sell"}
              tabIndex={tab === "sell" ? 0 : -1}
              onClick={() => bumpSell(1)}
            >
              +1%
            </button>
          </div>
          <div className="cd-trade-panel__foot">
            <div className="cd-trade-panel__meta">
              <span className="cd-trade-panel__meta-muted">{buyMeta}</span>
              <span className="cd-trade-panel__meta-end" aria-hidden="true" />
            </div>
            <TkButton
              type="button"
              variant="primary"
              className="cd-trade-panel__cta"
              disabled={
                tab !== "sell" ||
                sellDisabled ||
                !hasOwned ||
                !(sellUsd > 0) ||
                sellBusy
              }
              tabIndex={tab === "sell" ? 0 : -1}
              onClick={() => {
                if (!selectedOwned || !(sellUsd > 0)) return;
                onSell(selectedOwned.tokenId, sellUsd);
              }}
            >
              {sellBusy ? "Listing…" : "List for sale"}
            </TkButton>
          </div>
        </div>
      </div>
    </div>
  );
}
