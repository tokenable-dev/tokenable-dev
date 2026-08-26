"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Order, RwaMetadata } from "@/lib/core";
import { TkButton } from "@/components/ds";
import {
  formatListingUsdc,
  listingVaultBadge,
  listingVerificationTiles,
  shortenWallet,
} from "@/lib/marketplace/collectionListingModalHelpers";
import { formatOrderBookPriceUsdc } from "@/lib/marketplace/unified-order-book";

function vaultAccent(tone: "psa" | "partner"): string {
  return tone === "psa" ? "#5B9AFF" : "var(--pos)";
}

function copyRowMeta(
  order: Order,
  metadata: RwaMetadata | null | undefined,
): { cert: string; seller: string; sellerTitle?: string } {
  const tiles = listingVerificationTiles(metadata ?? null);
  const sellerAddr = order.offerer || order.parameters?.offerer;
  const seller =
    order.sellerDisplayName?.trim() || shortenWallet(sellerAddr);
  return {
    cert: tiles.certNumber !== "—" ? tiles.certNumber : "—",
    seller,
    sellerTitle: sellerAddr,
  };
}

export function CollectionChooseCopyModal({
  open,
  onClose,
  collectionTitle,
  collectionGradeLine,
  coverImageUrl,
  price,
  orders,
  batchMetadata,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  collectionTitle: string;
  /** Card.html: `PSA 10 · Gem Mint` (not Year · Set · Variant). */
  collectionGradeLine?: string | null;
  coverImageUrl?: string | null;
  price: number;
  orders: Order[];
  batchMetadata?:
    | Map<number, { metadata: RwaMetadata | null; imageUrl: string | null }>
    | undefined;
  onConfirm: (tokenId: number) => void;
}) {
  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => Number(a.tokenId) - Number(b.tokenId)),
    [orders],
  );

  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    if (open) setSelectedIdx(0);
  }, [open, price, orders]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || sortedOrders.length === 0 || typeof document === "undefined") {
    return null;
  }

  const priceLabel = formatOrderBookPriceUsdc(price);
  const selected = sortedOrders[selectedIdx] ?? sortedOrders[0]!;
  const selectedTokenId = Number(selected.tokenId);

  const handleConfirm = () => {
    if (!Number.isFinite(selectedTokenId)) return;
    onClose();
    onConfirm(selectedTokenId);
  };

  return createPortal(
    <div
      className="cd-choose-copy"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cd-choose-copy-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cd-choose-copy__panel cd-notch">
        <div className="cd-choose-copy__head">
          <h2 id="cd-choose-copy-title" className="cd-choose-copy__title">
            Choose your copy
          </h2>
          <button
            type="button"
            className="cd-choose-copy__close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="cd-choose-copy__item">
          <div className="cd-choose-copy__item-thumb">
            {coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverImageUrl} alt="" />
            ) : null}
          </div>
          <div className="cd-choose-copy__item-meta">
            <div className="cd-choose-copy__item-title">{collectionTitle}</div>
            {collectionGradeLine ? (
              <div className="cd-choose-copy__item-sub tkl-mono">{collectionGradeLine}</div>
            ) : null}
          </div>
        </div>

        <p className="cd-choose-copy__ctx tkl-mono">
          Ask ·{" "}
          <span className="cd-choose-copy__ctx-price">${priceLabel}</span> ·{" "}
          {sortedOrders.length} card{sortedOrders.length === 1 ? "" : "s"} at this price
        </p>

        <div className="cd-choose-copy__rows" role="radiogroup" aria-label="Listed copies">
          {sortedOrders.map((order, index) => {
            const tokenId = Number(order.tokenId);
            const meta = batchMetadata?.get(tokenId)?.metadata ?? null;
            const vault = listingVaultBadge(order);
            const row = copyRowMeta(order, meta);
            const selectedRow = index === selectedIdx;
            const accent = vaultAccent(vault.tone);

            return (
              <label
                key={order.orderHash}
                className={`cd-choose-copy__row${selectedRow ? " cd-choose-copy__row--sel" : ""}`}
              >
                <input
                  type="radio"
                  name="choose-copy"
                  className="cd-choose-copy__radio-input"
                  checked={selectedRow}
                  onChange={() => setSelectedIdx(index)}
                />
                <span className="cd-choose-copy__radio" aria-hidden>
                  {selectedRow ? <span className="cd-choose-copy__radio-dot" /> : null}
                </span>
                <span className="cd-choose-copy__row-body">
                  <span
                    className="cd-choose-copy__vault tkl-mono"
                    style={{ color: accent }}
                  >
                    <span
                      className="cd-choose-copy__vault-dot"
                      style={{ background: accent }}
                      aria-hidden
                    />
                    {vault.label}
                  </span>
                  <span className="cd-choose-copy__row-meta tkl-mono">
                    Cert #{row.cert} · {row.seller}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        <TkButton
          type="button"
          variant="primary"
          size="sm"
          className="cd-choose-copy__cta"
          onClick={handleConfirm}
        >
          Buy this copy
        </TkButton>

        <p className="cd-choose-copy__fine tkl-mono">
          Same price · you&apos;re choosing which unique card
        </p>
      </div>
    </div>,
    document.body,
  );
}

/** Price key for grouping asks — matches order book level keys. */
export function formatChooseCopyPriceLabel(order: Order): string {
  return formatListingUsdc(order.considerationAmount);
}
