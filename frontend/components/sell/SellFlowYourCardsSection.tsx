"use client";

import type { SellFlowCard } from "@/hooks/sell/useSellFlow";

type Variant = "psa" | "partner";

export function SellFlowYourCardsSection({
  variant,
  cards,
  maxCards,
  allConfirmed,
  onToggleConfirm,
  onToggleAllConfirmed,
  onRemove,
}: {
  variant: Variant;
  cards: SellFlowCard[];
  maxCards: number;
  allConfirmed: boolean;
  onToggleConfirm: (index: number) => void;
  onToggleAllConfirmed: (confirmed: boolean) => void;
  onRemove: (index: number) => void;
}) {
  const countLabel =
    variant === "partner" ? (
      <>
        {cards.length} scanned · {maxCards} allowed
      </>
    ) : (
      <>
        ({cards.length} of {maxCards})
      </>
    );

  const selectAllLabel =
    variant === "partner"
      ? "Confirm all"
      : allConfirmed
        ? "Deselect all"
        : "Select all";

  const confirmRowLabel =
    variant === "partner" ? "Cert matches this card" : "Confirm this is your card";

  const handleSelectAll = () => {
    if (variant === "partner") {
      onToggleAllConfirmed(!allConfirmed);
    } else {
      onToggleAllConfirmed(!allConfirmed);
    }
  };

  return (
    <div className="sell-flow-cards-section">
      <div className="sell-flow-cards-header">
        <div className="sell-flow-cards-title">
          Your cards{" "}
          <span className="tkl-mono sell-flow-cards-count">{countLabel}</span>
        </div>
        {cards.length > 0 ? (
          <button type="button" className="sell-flow-select-all" onClick={handleSelectAll}>
            {selectAllLabel}
          </button>
        ) : null}
      </div>
      <div className="sell-flow-cards-box">
        {cards.length === 0 ? (
          <div className="sell-flow-cards-empty">
            No cards yet.
            <br />
            Scan a slab or enter a cert number to get started.
          </div>
        ) : (
          <ul className="sell-flow-cards-list">
            {cards.map((card, i) => (
              <li key={`${card.cert}-${i}`} className="sell-flow-cardrow">
                {card.img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={card.img} alt="" className="sell-flow-cardrow__thumb" />
                ) : (
                  <div className="sell-flow-cardrow__thumb sell-flow-cardrow__thumb--empty" />
                )}
                <div className="sell-flow-cardrow__body">
                  <div className="sell-flow-cardrow__name">{card.name}</div>
                  <div className="sell-flow-cardrow__meta">
                    <span className="sell-flow-grade tkl-mono">PSA {card.grade}</span>
                    <span className="tkl-mono sell-flow-cardrow__cert">Cert #{card.cert}</span>
                  </div>
                  <label className="sell-flow-cardrow__confirm">
                    <button
                      type="button"
                      className={`sell-flow-chk sell-flow-chk--sm${card.confirmed ? " sell-flow-chk--on" : ""}`}
                      aria-pressed={card.confirmed}
                      onClick={() => onToggleConfirm(i)}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" aria-hidden>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </button>
                    <span>{confirmRowLabel}</span>
                  </label>
                </div>
                <button
                  type="button"
                  className="sell-flow-cardrow__del"
                  aria-label={`Remove ${card.name}`}
                  title="Remove card"
                  onClick={() => onRemove(i)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
