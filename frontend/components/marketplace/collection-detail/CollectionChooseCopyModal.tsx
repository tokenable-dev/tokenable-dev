"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Order, RwaMetadata } from "@/lib/core";
import { TkButton } from "@/components/ds";
import {
  formatListingUsdc,
  listingGalleryImages,
  listingVaultBadge,
  listingVerificationTiles,
} from "@/lib/marketplace/collectionListingModalHelpers";
import { formatOrderBookPriceUsdc } from "@/lib/marketplace/unified-order-book";

const FILTER_THRESHOLD = 8;

function vaultAccent(tone: "psa" | "partner"): string {
  return tone === "psa" ? "#5B9AFF" : "#00C350";
}

/** Card.html vault chip — first word only (`PSA`, `Tokenable`). */
function vaultShortCode(label: string): string {
  const first = label.trim().split(/\s+/)[0] ?? label;
  return first || "Vault";
}

function createdMs(order: Order): number {
  const t = Date.parse(order.createdAt ?? "");
  return Number.isFinite(t) ? t : 0;
}

type CopyRow = {
  order: Order;
  tokenId: number;
  cert: string;
  vaultLabel: string;
  vaultTone: "psa" | "partner";
  front: string;
  back: string | null;
};

function buildCopyRow(
  order: Order,
  batchMetadata:
    | Map<number, { metadata: RwaMetadata | null; imageUrl: string | null; imageBackUrl?: string | null }>
    | undefined,
  coverFallback?: string | null,
): CopyRow {
  const tokenId = Number(order.tokenId);
  const packed = batchMetadata?.get(tokenId);
  const meta = packed?.metadata ?? null;
  const tiles = listingVerificationTiles(meta);
  const vault = listingVaultBadge(order);
  const packedImage = packed?.imageUrl?.trim() || null;
  const cover = coverFallback?.trim() || null;
  const gallery = listingGalleryImages(
    meta,
    packedImage,
    packed?.imageBackUrl,
  );
  const front =
    gallery.find((g) => g.id === "front" || g.label === "Front")?.src ||
    packedImage ||
    cover ||
    "";
  const back =
    gallery.find((g) => g.id === "back" || g.label === "Back")?.src ?? null;
  return {
    order,
    tokenId,
    cert: tiles.certNumber !== "—" ? tiles.certNumber : "—",
    vaultLabel: vault.label,
    vaultTone: vault.tone,
    front,
    back,
  };
}

function pickSoonestPsa(rows: CopyRow[]): CopyRow | null {
  const psa = rows
    .filter((r) => r.vaultTone === "psa")
    .sort((a, b) => createdMs(a.order) - createdMs(b.order));
  return psa[0] ?? rows[0] ?? null;
}

/**
 * Card.html `#tk-choose` — Select your card sheet after Buy now / ask row.
 */
export function CollectionChooseCopyModal({
  open,
  onClose,
  collectionTitle,
  itemMetaLine,
  coverImageUrl,
  price,
  orders,
  batchMetadata,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  collectionTitle: string;
  /**
   * Line 2 SSOT — `{Year} · {Set} {Language} · {Variant}`.
   * Ask price is appended in the modal.
   */
  itemMetaLine?: string | null;
  coverImageUrl?: string | null;
  price: number;
  orders: Order[];
  batchMetadata?:
    | Map<number, { metadata: RwaMetadata | null; imageUrl: string | null; imageBackUrl?: string | null }>
    | undefined;
  onConfirm: (tokenId: number) => void;
}) {
  const allRows = useMemo(
    () =>
      [...orders]
        .map((order) => buildCopyRow(order, batchMetadata, coverImageUrl))
        .filter((r) => Number.isFinite(r.tokenId)),
    [orders, batchMetadata, coverImageUrl],
  );

  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const [autoSel, setAutoSel] = useState(false);
  /** Card.html `#tkc-vfilter` — default Vault · All. */
  const [vaultFilter, setVaultFilter] = useState<"all" | "psa" | "tkb">("all");
  const [fadeHidden, setFadeHidden] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  /** Card.html: auto-pick row only when many copies. */
  const showAutoPick = allRows.length > FILTER_THRESHOLD;

  const visibleRows = useMemo(() => {
    let list = [...allRows];
    if (vaultFilter === "psa") {
      list = list.filter((r) => r.vaultTone === "psa");
    } else if (vaultFilter === "tkb") {
      list = list.filter((r) => r.vaultTone === "partner");
    }
    list.sort((a, b) => createdMs(a.order) - createdMs(b.order));
    return list;
  }, [allRows, vaultFilter]);

  useEffect(() => {
    if (!open) return;
    setAutoSel(false);
    setVaultFilter("all");
    const sorted = [...orders].sort((a, b) => createdMs(a) - createdMs(b));
    setSelectedHash(sorted[0]?.orderHash ?? null);
  }, [open, price, orders]);

  useEffect(() => {
    if (!open) return;
    if (autoSel) return;
    if (visibleRows.some((r) => r.order.orderHash === selectedHash)) return;
    setSelectedHash(visibleRows[0]?.order.orderHash ?? null);
  }, [open, visibleRows, selectedHash, autoSel]);

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

  const updateFade = () => {
    const sc = scrollRef.current;
    if (!sc) return;
    const atBottom =
      sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 4 ||
      sc.scrollHeight <= sc.clientHeight + 4;
    setFadeHidden(atBottom);
  };

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(updateFade, 40);
    return () => window.clearTimeout(t);
  }, [open, visibleRows.length, showAutoPick, autoSel, vaultFilter]);

  if (!open || allRows.length === 0 || typeof document === "undefined") {
    return null;
  }

  const priceLabel = formatOrderBookPriceUsdc(price);
  const askLabel = `Ask $${priceLabel.replace(/\.\d+$/, "")}`;
  /** SSOT Line 2 + ask — never invent variant like “Gem Mint”. */
  const itemSub = [itemMetaLine?.trim() || null, askLabel]
    .filter(Boolean)
    .join(" · ");

  const selected =
    visibleRows.find((r) => r.order.orderHash === selectedHash) ??
    visibleRows[0] ??
    allRows[0]!;

  const confirmToken = (): number | null => {
    const pick = autoSel ? pickSoonestPsa(allRows) : selected;
    if (!pick || !Number.isFinite(pick.tokenId)) return null;
    return pick.tokenId;
  };

  const handleConfirm = () => {
    const tokenId = confirmToken();
    if (tokenId == null) return;
    onClose();
    onConfirm(tokenId);
  };

  return createPortal(
    <div
      className="cd-choose-copy"
      id="tk-choose"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="cd-choose-copy__sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cd-choose-copy-title"
      >
        <div className="cd-choose-copy__grab" aria-hidden />
        <div className="cd-choose-copy__head">
          <h2 id="cd-choose-copy-title" className="cd-choose-copy__title">
            Select your card
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

        <div className="cd-choose-copy__fixed">
          <div className="cd-choose-copy__item">
            <div className="cd-choose-copy__item-title">{collectionTitle}</div>
            <div className="cd-choose-copy__item-sub tkl-mono" id="tkc-sub">
              {itemSub}
            </div>
          </div>
          <p className="cd-choose-copy__ctx tkl-mono" id="tk-choose-ctx">
            {allRows.length} card{allRows.length === 1 ? "" : "s"} at this price
          </p>
          {/* Card.html `#tkc-filterbar` — vault filter only (sort select is hidden). */}
          <div className="cd-choose-copy__filters" id="tkc-filterbar">
            <select
              id="tkc-vfilter"
              className="cd-choose-copy__fsel tkl-mono"
              value={vaultFilter}
              onChange={(e) => {
                setAutoSel(false);
                setVaultFilter(e.target.value as "all" | "psa" | "tkb");
              }}
              aria-label="Filter by vault"
            >
              <option value="all">Vault · All</option>
              <option value="psa">PSA Vault</option>
              <option value="tkb">TKB Vault</option>
            </select>
          </div>
        </div>

        <div className="cd-choose-copy__scrollwrap">
          <div
            className="cd-choose-copy__scroll"
            id="tkc-scroll"
            ref={scrollRef}
            onScroll={updateFade}
          >
            {showAutoPick ? (
              <button
                type="button"
                className={`cd-choose-copy__auto${autoSel ? " cd-choose-copy__auto--sel" : ""}`}
                onClick={() => setAutoSel(true)}
              >
                <span className="cd-choose-copy__radio" aria-hidden>
                  {autoSel ? (
                    <span className="cd-choose-copy__radio-dot" />
                  ) : null}
                </span>
                <span className="cd-choose-copy__auto-body">
                  <span className="cd-choose-copy__auto-title">Any card</span>
                  <span className="cd-choose-copy__auto-sub tkl-mono">
                    PSA Vault, soonest ship
                  </span>
                </span>
              </button>
            ) : null}

            {visibleRows.length === 0 ? (
              <p className="cd-choose-copy__empty tkl-mono">
                No cards in this vault
              </p>
            ) : null}

            {visibleRows.map((row) => {
              const selectedRow =
                !autoSel && row.order.orderHash === selected.order.orderHash;
              const accent = vaultAccent(row.vaultTone);
              return (
                <div
                  key={row.order.orderHash}
                  className={`cd-choose-copy__row${selectedRow ? " cd-choose-copy__row--sel" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setAutoSel(false);
                    setSelectedHash(row.order.orderHash);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setAutoSel(false);
                      setSelectedHash(row.order.orderHash);
                    }
                  }}
                >
                  <span className="cd-choose-copy__radio" aria-hidden>
                    {selectedRow ? (
                      <span className="cd-choose-copy__radio-dot" />
                    ) : null}
                  </span>
                  <span className="cd-choose-copy__cert tkl-mono">
                    Cert #{row.cert}
                  </span>
                  <span
                    className="cd-choose-copy__vault-pill tkl-mono"
                    style={{
                      color: accent,
                      background: `${accent}22`,
                    }}
                  >
                    {vaultShortCode(row.vaultLabel)}
                  </span>
                </div>
              );
            })}
          </div>
          <div
            className={`cd-choose-copy__fade${fadeHidden ? " cd-choose-copy__fade--hide" : ""}`}
            id="tkc-fade"
            aria-hidden
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>

        <div className="cd-choose-copy__foot">
          <TkButton
            type="button"
            variant="primary"
            size="sm"
            className="cd-choose-copy__cta"
            id="tk-choose-go"
            disabled={!autoSel && visibleRows.length === 0}
            onClick={handleConfirm}
          >
            Buy
          </TkButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Price key for grouping asks — matches order book level keys. */
export function formatChooseCopyPriceLabel(order: Order): string {
  return formatListingUsdc(order.considerationAmount);
}
