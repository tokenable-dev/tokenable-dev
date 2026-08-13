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
 * Shared Set price / Edit price widget — `tk-price-input.js`.
 * Market / lowest ask (live) / last sold, ±% chips, undercut, fee, you receive.
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
}: {
  tokenId: number;
  collectionKey?: string | null;
  price: string;
  onPriceChange: (value: string) => void;
  feePercent: number;
  marketValueUsd?: number | null;
  disabled?: boolean;
  payoutNote?: string | null;
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

  const baseVal = base === "lowest" ? lowest : market;
  const baseName = base === "lowest" ? "lowest ask" : "market value";
  const feeAmt = Math.round(value * feePercent) / 100;
  const netAmt = Math.max(0, value - feeAmt);
  const undercut = lowest > 0 ? Math.max(1, Math.round(lowest) - 1) : 0;

  const hint = useMemo(() => {
    if (value <= 0) return null;
    if (market > 0 && value > market * 1.25) {
      return {
        good: false,
        msg: "Well above market value — this may sit unsold.",
      };
    }
    if (market > 0 && value < market * 0.7) {
      return {
        good: false,
        msg: "Well below market value — you’d be leaving money on the table.",
      };
    }
    if (lowest > 0 && value < lowest) {
      return { good: true, msg: "You’d be the lowest ask." };
    }
    return null;
  }, [value, market, lowest]);

  function setFromRef(n: number) {
    setPick(null);
    onPriceChange(applyPrice(n));
  }

  return (
    <div className="tk-price">
      {market > 0 || lowest > 0 || last > 0 ? (
        <div className="tk-price__refs">
          {market > 0 ? (
            <div className="tk-price__ref">
              <span className="tk-price__ref-lbl">Market value</span>
              <span className="tk-price__ref-right">
                <span className="tk-price__ref-val tkl-mono">{money(market)}</span>
                <button
                  type="button"
                  className="tk-price__use"
                  disabled={disabled}
                  onClick={() => setFromRef(market)}
                >
                  Use
                </button>
              </span>
            </div>
          ) : null}
          {lowest > 0 ? (
            <div className="tk-price__ref">
              <span className="tk-price__ref-lbl">
                Lowest ask
                <span className="tk-price__live">
                  <i className="tk-price__live-dot" aria-hidden />
                  live
                </span>
              </span>
              <span className="tk-price__ref-right">
                <span className="tk-price__ref-val tkl-mono">{money(lowest)}</span>
                <button
                  type="button"
                  className="tk-price__use"
                  disabled={disabled}
                  onClick={() => setFromRef(lowest)}
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
        </div>
      ) : suggestions.loading ? (
        <p className="tk-price__loading" role="status">
          Loading market references…
        </p>
      ) : null}

      <div className="tk-price__your">
        <span className="tk-price__ref-lbl">Your price</span>
        {lowest > 0 ? (
          <button
            type="button"
            className="tk-price__base-tog"
            disabled={disabled}
            onClick={() => {
              setBase((b) => (b === "lowest" ? "market" : "lowest"));
              setPick(null);
            }}
          >
            Base: {base === "lowest" ? "Lowest ask" : "Market value"}
          </button>
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

      <div className="tk-price__chips">
        {ADJUST_PCTS.map((p) => {
          const label = p === 0 ? "Market" : p > 0 ? `+${p}%` : `${p}%`;
          const on = pick === String(p);
          return (
            <button
              key={p}
              type="button"
              className={cn("tk-price__chip", on && "tk-price__chip--on")}
              disabled={disabled || !baseVal}
              onClick={() => {
                if (!baseVal) return;
                setPick(String(p));
                onPriceChange(applyPrice(Math.round(baseVal * (1 + p / 100))));
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {lowest > 0 ? (
        <button
          type="button"
          className="tk-price__undercut"
          disabled={disabled}
          onClick={() => {
            setPick(null);
            onPriceChange(applyPrice(undercut));
          }}
        >
          Undercut lowest ask —{" "}
          <span className="tkl-mono">{money(undercut)}</span>
        </button>
      ) : null}

      {baseVal > 0 ? (
        <p className="tk-price__basenote">
          ± relative to {baseName} ({money(baseVal)})
        </p>
      ) : null}

      {hint ? (
        <p className={cn("tk-price__hint", hint.good && "tk-price__hint--good")}>
          {hint.msg}
        </p>
      ) : null}

      {feePercent > 0 ? (
        <>
          <div className="tk-price__fee">
            <span className="tk-price__ref-lbl">Platform fee ({feePercent}%)</span>
            <span className="tk-price__fee-amt tkl-mono">−{money(feeAmt)}</span>
          </div>
          <div className="tk-price__net">
            <span className="tk-price__ref-lbl tk-price__net-lbl">You receive</span>
            <span className="tk-price__net-val tkl-mono">{money(netAmt)}</span>
          </div>
          {payoutNote ? <p className="tk-price__payout-note">{payoutNote}</p> : null}
        </>
      ) : null}
    </div>
  );
}
