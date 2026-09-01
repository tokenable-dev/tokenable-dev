"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/ds/cn";
import { useListRwaPriceSuggestions } from "@/hooks/list-rwa/useListRwaPriceSuggestions";

const ADJUST_PCTS = [-20, -10, 0, 10, 20] as const;

function money(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function parsePriceInput(raw: string): number {
  const n = Number(String(raw).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function groupPrice(n: number): string {
  if (!n) return "";
  return Math.round(n).toLocaleString("en-US");
}

function applyPrice(n: number): string {
  if (!n || n <= 0) return "";
  return String(Math.round(n));
}

/**
 * Shared Set price / Edit price widget — `tk-price-input.js` (ds-26).
 */
export function ListRwaPriceInput({
  tokenId,
  collectionKey,
  price,
  onPriceChange,
  feePercent,
  marketValueUsd,
  disabled = false,
  payoutNote,
  highestBidUsd,
}: {
  tokenId: number;
  collectionKey?: string | null;
  price: string;
  onPriceChange: (value: string) => void;
  feePercent: number;
  marketValueUsd?: number | null;
  disabled?: boolean;
  payoutNote?: string | null;
  highestBidUsd?: number | null;
}) {
  const suggestions = useListRwaPriceSuggestions({
    tokenId,
    collectionKey,
    enabled: true,
  });

  const market = suggestions.marketPriceUsd ?? marketValueUsd ?? 0;
  const lowest = suggestions.lowestAskUsd ?? 0;
  const last = suggestions.lastTokenableTradeUsd ?? 0;
  const value = parsePriceInput(price);

  const [base, setBase] = useState<"market" | "lowest">("market");
  const [pick, setPick] = useState<string | null>(null);
  const highBid =
    highestBidUsd != null && Number.isFinite(highestBidUsd) && highestBidUsd > 0
      ? highestBidUsd
      : 0;
  const cross = highBid > 0 && value > 0 && value <= highBid;

  const baseVal = base === "lowest" ? lowest : market;
  const baseName = base === "lowest" ? "lowest ask" : "market value";
  const feeAmt = Math.round(value * feePercent) / 100;
  const netAmt = Math.max(0, value - feeAmt);

  const hint = useMemo(() => {
    if (cross) {
      return {
        kind: "cross" as const,
        msg: `Sells immediately to the top bid at ${money(highBid)}. This fills now instead of resting on the book.`,
      };
    }
    if (value <= 0) return null;
    if (market > 0 && value > market * 1.25) {
      return {
        kind: "warn" as const,
        msg: "Well above market value — this may sit unsold.",
      };
    }
    if (market > 0 && value < market * 0.7) {
      return {
        kind: "warn" as const,
        msg: "Well below market value — you’d be leaving money on the table.",
      };
    }
    if (lowest > 0 && value < lowest) {
      return { kind: "good" as const, msg: "You’d be the lowest ask." };
    }
    return null;
  }, [value, market, lowest, cross, highBid]);

  function setFromRef(n: number) {
    setPick(null);
    onPriceChange(applyPrice(n));
  }

  function useLowestAsk() {
    setBase("lowest");
    setFromRef(lowest);
  }

  function useMarketValue() {
    setBase("market");
    setFromRef(market);
  }

  const hasRefs = market > 0 || lowest > 0 || last > 0 || highBid > 0;

  return (
    <div className="tk-price">
      {hasRefs ? (
        <div className="tk-price__refs">
          {lowest > 0 ? (
            <div className="tk-price__ref">
              <span className="tk-price__ref-lbl">Lowest ask</span>
              <span className="tk-price__ref-right">
                <span className="tk-price__ref-val tkl-mono">{money(lowest)}</span>
                <button
                  type="button"
                  className="tk-price__use"
                  disabled={disabled}
                  onClick={useLowestAsk}
                >
                  Use
                </button>
              </span>
            </div>
          ) : null}
          {market > 0 ? (
            <div className="tk-price__ref">
              <span className="tk-price__ref-lbl">Last price</span>
              <span className="tk-price__ref-right">
                <span className="tk-price__ref-val tkl-mono">{money(market)}</span>
                <button
                  type="button"
                  className="tk-price__use"
                  disabled={disabled}
                  onClick={useMarketValue}
                >
                  Use
                </button>
              </span>
            </div>
          ) : null}
          {last > 0 ? (
            <div className="tk-price__ref">
              <span className="tk-price__ref-lbl">Last sold</span>
              <span className="tk-price__ref-right">
                <span className="tk-price__ref-val tkl-mono">{money(last)}</span>
                <button
                  type="button"
                  className="tk-price__use"
                  disabled={disabled}
                  onClick={() => setFromRef(last)}
                >
                  Use
                </button>
              </span>
            </div>
          ) : null}
          {highBid > 0 ? (
            <div className="tk-price__ref">
              <span className="tk-price__ref-lbl">
                Highest bid
                <span className="tk-price__sells-now">sells now</span>
              </span>
              <span className="tk-price__ref-right">
                <span className="tk-price__ref-val tk-price__ref-val--bid tkl-mono">
                  {money(highBid)}
                </span>
                <button
                  type="button"
                  className="tk-price__use tk-price__use--sell"
                  disabled={disabled}
                  onClick={() => {
                    setPick(null);
                    onPriceChange(applyPrice(highBid));
                  }}
                >
                  Use
                </button>
              </span>
            </div>
          ) : null}
        </div>
      ) : suggestions.loading ? (
        <p className="tk-price__loading" role="status">
          Loading market references…
        </p>
      ) : null}

      <div className="tk-price__your">
        <span className="tk-price__ref-lbl">Your listing price</span>
        {lowest > 0 ? (
          <span className="tk-price__base-tog tk-price__base-tog--static">
            Base: {base === "lowest" ? "Lowest ask" : "Market value"}
          </span>
        ) : null}
      </div>

      <div className="tk-price__field">
        <span className="tk-price__dollar tkl-mono" aria-hidden>
          $
        </span>
        <input
          id="list-rwa-price-usdc"
          className="tk-price__input tkl-mono"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="0"
          disabled={disabled}
          value={groupPrice(value)}
          onChange={(e) => {
            setPick(null);
            onPriceChange(applyPrice(parsePriceInput(e.target.value)));
          }}
        />
      </div>

      {baseVal > 0 ? (
        <div className="tk-price__chips">
          {ADJUST_PCTS.map((p) => {
            const label = p === 0 ? "Market" : p > 0 ? `+${p}%` : `${p}%`;
            const on = pick === String(p);
            return (
              <button
                key={p}
                type="button"
                className={cn("tk-price__chip", on && "tk-price__chip--on")}
                disabled={disabled || (p === 0 ? !market : !baseVal)}
                onClick={() => {
                  if (p === 0) {
                    if (!market) return;
                    setBase("market");
                    setPick("0");
                    onPriceChange(applyPrice(Math.round(market)));
                    return;
                  }
                  if (!baseVal) return;
                  setPick(String(p));
                  onPriceChange(applyPrice(Math.round(baseVal * (1 + p / 100))));
                }}
                title={
                  baseVal
                    ? `± relative to ${baseName} (${money(baseVal)})`
                    : undefined
                }
              >
                {label}
              </button>
            );
          })}
        </div>
      ) : null}

      {hint ? (
        <p
          className={cn(
            "tk-price__hint",
            hint.kind === "good" && "tk-price__hint--good",
            hint.kind === "cross" && "tk-price__hint--cross",
          )}
        >
          {hint.kind === "cross" ? `⚡ ${hint.msg}` : hint.msg}
        </p>
      ) : null}

      {feePercent > 0 ? (
        <>
          <div className="tk-price__fee">
            <span className="tk-price__ref-lbl">Platform fee ({feePercent}%)</span>
            <span className="tk-price__fee-amt tkl-mono">−{money(feeAmt)}</span>
          </div>
          <div className="tk-price__net">
            <span className="tk-price__ref-lbl tk-price__net-lbl">
              {cross ? "You receive" : "Net sale amount"}
            </span>
            <span className="tk-price__net-val tkl-mono">{money(netAmt)}</span>
          </div>
          {payoutNote ? <p className="tk-price__payout-note">{payoutNote}</p> : null}
        </>
      ) : null}
    </div>
  );
}
