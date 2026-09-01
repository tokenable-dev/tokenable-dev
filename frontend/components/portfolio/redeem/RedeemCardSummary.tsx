"use client";

import { useMemo, useState } from "react";
import type { RedeemDraftCard } from "@/lib/portfolio/redeemDraft";
import { formatRedeemCardLine1FromDraft } from "@/lib/portfolio/portfolioTableHelpers";

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export function RedeemCardSummary({
  cards,
  onRemove,
  compact = false,
}: {
  cards: RedeemDraftCard[];
  onRemove?: (tokenId: number) => void;
  /** Pay screen — thumbs + count only (HTML `#wd-pay` has no Review). */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const thumbs = cards.slice(0, 4);
  const vaultCount = useMemo(() => {
    const labels = new Set(
      cards.map((c) => (c.vaultLabel || "PSA Vault").trim()),
    );
    return labels.size;
  }, [cards]);

  return (
    <div className={compact ? "pf-redeem-summary pf-redeem-summary--compact" : "pf-redeem-summary"}>
      <div className="pf-redeem-summary__head">
        <div className="pf-redeem-summary__thumbs" aria-hidden>
          {thumbs.map((c, i) => (
            <div
              key={c.tokenId}
              className="pf-redeem-summary__thumb"
              style={{ zIndex: thumbs.length - i, marginLeft: i === 0 ? 0 : -12 }}
            >
              {c.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.imageUrl} alt="" />
              ) : null}
            </div>
          ))}
        </div>
        <div className="pf-redeem-summary__meta">
          <div className="pf-redeem-summary__count">
            {cards.length} card{cards.length === 1 ? "" : "s"}
          </div>
          <div className="pf-redeem-summary__sub">
            {vaultCount > 1
              ? `${vaultCount} deliveries`
              : "One delivery"}
          </div>
        </div>
        {!compact ? (
        <button
          type="button"
          className="pf-redeem-summary__toggle"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide" : "Review"}
        </button>
        ) : null}
      </div>
      {open && !compact ? (
        <ul className="pf-redeem-summary__list">
          {cards.map((c) => (
            <li key={c.tokenId} className="pf-redeem-summary__row">
              <div className="pf-redeem-summary__row-thumb">
                {c.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.imageUrl} alt="" />
                ) : null}
              </div>
              <div className="pf-redeem-summary__row-info">
                <div className="pf-redeem-summary__row-name">
                  {formatRedeemCardLine1FromDraft(c)}
                </div>
                <div className="pf-redeem-summary__row-meta">
                  <span className="pf-redeem-chip pf-redeem-chip--vault">
                    {c.vaultLabel || "PSA Vault"}
                  </span>
                  {c.certNumber ? (
                    <span className="pf-redeem-summary__row-cert tkl-mono">
                      Cert #{c.certNumber}
                    </span>
                  ) : null}
                </div>
              </div>
              {onRemove && cards.length > 1 ? (
                <button
                  type="button"
                  className="pf-redeem-summary__trash"
                  aria-label={`Remove ${c.name}`}
                  onClick={() => onRemove(c.tokenId)}
                >
                  <TrashIcon />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
