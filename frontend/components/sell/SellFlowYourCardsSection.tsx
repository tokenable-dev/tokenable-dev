"use client";

import type { SellFlowCard } from "@/hooks/sell/useSellFlow";
import { cn } from "@/lib/ds/cn";
import { SellCardNameBlock } from "./SellCardNameBlock";

/** Choose-Vault-Individual.html `#cards-section` — rows after Check / upload. */
export function SellFlowYourCardsSection({
  cards,
  maxCards,
  onRemove,
  embedded = false,
}: {
  cards: SellFlowCard[];
  maxCards: number;
  onRemove: (index: number) => void;
  /** Inside the Enter card info glass panel. */
  embedded?: boolean;
}) {
  if (cards.length === 0) return null;

  return (
    <div
      className={cn(
        "sell-flow-cards-section",
        embedded && "sell-flow-cards-section--embedded",
      )}
    >
      <div className="sell-flow-cards-header">
        <div className="sell-flow-cards-title">
          Your cards{" "}
          <span className="sell-flow-cards-count">
            ({cards.length} of {maxCards})
          </span>
        </div>
      </div>
      <div className="sell-flow-cards-box">
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
                <SellCardNameBlock
                  card={card}
                  certOnLine2
                  line1ClassName="sell-flow-cardrow__name"
                  line2ClassName="sell-flow-cardrow__sub"
                />
              </div>
              <button
                type="button"
                className="sell-flow-cardrow__del"
                aria-label={`Remove ${card.name}`}
                title="Remove card"
                onClick={() => onRemove(i)}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
