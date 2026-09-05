"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Order, RwaMetadata } from "@/lib/core";
import { TkBadge, TkButton } from "@/components/ds";
import {
  formatListingUsdc,
  listingGalleryImages,
  listingVaultBadge,
  listingVerificationTiles,
} from "@/lib/marketplace/collectionListingModalHelpers";
import { formatOrderBookPriceUsdc } from "@/lib/marketplace/unified-order-book";
import { CARD_DISPLAY_LINE1_CLAMP_CLASS } from "@/components/marketplace/marketplace-shared";

const FILTER_THRESHOLD = 8;

function vaultAccent(tone: "psa" | "partner"): string {
  return tone === "psa" ? "#5B9AFF" : "var(--pos)";
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

function ZoomIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
  );
}

export function CollectionChooseCopyModal({
  open,
  onClose,
  collectionTitle,
  itemSetLine,
  coverImageUrl,
  price,
  orders,
  batchMetadata,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  collectionTitle: string;
  /** Card.html `#tkc-sub` prefix: `2023 · 151 EN` */
  itemSetLine?: string | null;
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
  const [sort, setSort] = useState<"rec" | "new" | "vault">("rec");
  const [vaultFilter, setVaultFilter] = useState<"all" | "psa" | "partner">("all");
  const [lbOpen, setLbOpen] = useState(false);
  const [lbIdx, setLbIdx] = useState(0);
  const [lbFace, setLbFace] = useState<"front" | "back">("front");
  const [lbZoom, setLbZoom] = useState(false);

  const showFilters = allRows.length > FILTER_THRESHOLD;

  const vaultOptions = useMemo(() => {
    const hasPsa = allRows.some((r) => r.vaultTone === "psa");
    const hasPartner = allRows.some((r) => r.vaultTone === "partner");
    return { hasPsa, hasPartner };
  }, [allRows]);

  const visibleRows = useMemo(() => {
    let list = [...allRows];
    if (vaultFilter === "psa") list = list.filter((r) => r.vaultTone === "psa");
    if (vaultFilter === "partner") list = list.filter((r) => r.vaultTone === "partner");
    if (sort === "vault") {
      list.sort((a, b) => a.vaultLabel.localeCompare(b.vaultLabel) || createdMs(a.order) - createdMs(b.order));
    } else if (sort === "new") {
      list.sort((a, b) => createdMs(b.order) - createdMs(a.order));
    } else {
      list.sort((a, b) => createdMs(a.order) - createdMs(b.order));
    }
    return list;
  }, [allRows, sort, vaultFilter]);

  useEffect(() => {
    if (!open) return;
    setAutoSel(false);
    setSort("rec");
    setVaultFilter("all");
    setLbOpen(false);
    const sorted = [...orders].sort((a, b) => createdMs(a) - createdMs(b));
    setSelectedHash(sorted[0]?.orderHash ?? null);
  }, [open, price, orders]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (lbOpen) {
          setLbOpen(false);
          return;
        }
        onClose();
      }
      if (!lbOpen) return;
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, lbOpen, allRows.length]);

  if (!open || allRows.length === 0 || typeof document === "undefined") {
    return null;
  }

  const priceLabel = formatOrderBookPriceUsdc(price);
  const subParts = [itemSetLine?.trim() || null, "Gem Mint"].filter(Boolean);
  const itemSub = subParts.join(" · ");

  const selected =
    visibleRows.find((r) => r.order.orderHash === selectedHash) ?? visibleRows[0] ?? allRows[0]!;

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

  const openLightbox = (hash: string, face: "front" | "back" = "front") => {
    const idx = allRows.findIndex((r) => r.order.orderHash === hash);
    const row = allRows[idx >= 0 ? idx : 0];
    setLbIdx(idx >= 0 ? idx : 0);
    setLbFace(face === "back" && row?.back ? "back" : "front");
    setLbZoom(false);
    setLbOpen(true);
  };

  const lbRow = allRows[lbIdx] ?? allRows[0]!;
  const lbSrc = lbFace === "back" && lbRow.back ? lbRow.back : lbRow.front;

  return createPortal(
    <>
      <div
        className="cd-choose-copy"
        role="presentation"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="cd-choose-copy__sheet"
          role="dialog"
          aria-modal="true"
          aria-label="Select your card"
        >
          <div className="cd-choose-copy__grab" aria-hidden />
          <div className="cd-choose-copy__head">
            <div className="cd-choose-copy__head-title">
              <h2 id="cd-choose-copy-title" className="cd-choose-copy__title">
                Select your card
              </h2>
              <TkBadge>{`$${priceLabel}`}</TkBadge>
            </div>
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
              <div className={`cd-choose-copy__item-title ${CARD_DISPLAY_LINE1_CLAMP_CLASS}`}>
                {collectionTitle}
              </div>
              <div className="cd-choose-copy__item-sub tkl-mono">{itemSub}</div>
            </div>
            <p className="cd-choose-copy__ctx tkl-mono">
              {allRows.length} card{allRows.length === 1 ? "" : "s"} at this price
            </p>
            {showFilters ? (
              <div className="cd-choose-copy__filters">
                <select
                  className="cd-choose-copy__fsel tkl-mono"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as "rec" | "new" | "vault")}
                  aria-label="Sort copies"
                >
                  <option value="rec">Sort · Recommended</option>
                  <option value="new">Newest listed</option>
                  <option value="vault">Vault</option>
                </select>
                <select
                  className="cd-choose-copy__fsel tkl-mono"
                  value={vaultFilter}
                  onChange={(e) => setVaultFilter(e.target.value as "all" | "psa" | "partner")}
                  aria-label="Filter by vault"
                >
                  <option value="all">Vault · All</option>
                  {vaultOptions.hasPsa ? <option value="psa">PSA Vault</option> : null}
                  {vaultOptions.hasPartner ? <option value="partner">Tokenable Vault</option> : null}
                </select>
              </div>
            ) : null}
          </div>

          <div className="cd-choose-copy__scroll">
            {showFilters ? (
              <button
                type="button"
                className={`cd-choose-copy__auto${autoSel ? " cd-choose-copy__auto--sel" : ""}`}
                onClick={() => setAutoSel(true)}
              >
                <span className="cd-choose-copy__radio" aria-hidden>
                  {autoSel ? <span className="cd-choose-copy__radio-dot" /> : null}
                </span>
                <span className="cd-choose-copy__auto-body">
                  <span className="cd-choose-copy__auto-title">Any card</span>
                  <span className="cd-choose-copy__auto-sub tkl-mono">PSA Vault, soonest ship</span>
                </span>
              </button>
            ) : null}

            {visibleRows.map((row) => {
              const selectedRow = !autoSel && row.order.orderHash === selected.order.orderHash;
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
                  {row.front ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="cd-choose-copy__thumb" src={row.front} alt="" />
                  ) : (
                    <span className="cd-choose-copy__thumb cd-choose-copy__thumb--empty" />
                  )}
                  <span className="cd-choose-copy__row-body">
                    <span className="cd-choose-copy__cert tkl-mono">Cert #{row.cert}</span>
                    <span className="cd-choose-copy__vault tkl-mono" style={{ color: accent }}>
                      <span className="cd-choose-copy__vault-dot" style={{ background: accent }} aria-hidden />
                      {row.vaultLabel}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="cd-choose-copy__zoom"
                    aria-label="View card front and back"
                    onClick={(e) => {
                      e.stopPropagation();
                      openLightbox(row.order.orderHash);
                    }}
                  >
                    <ZoomIcon />
                  </button>
                  <span className="cd-choose-copy__radio" aria-hidden>
                    {selectedRow ? <span className="cd-choose-copy__radio-dot" /> : null}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="cd-choose-copy__foot">
            <TkButton
              type="button"
              variant="primary"
              size="sm"
              className="cd-choose-copy__cta"
              onClick={handleConfirm}
            >
              Buy
            </TkButton>
          </div>
        </div>
      </div>

      {lbOpen ? (
        <div className="cd-choose-copy-lb" role="dialog" aria-modal="true" aria-label="Card copy">
          <div className="cd-choose-copy-lb__top">
            <span className="cd-choose-copy-lb__counter tkl-mono">
              Cert #{lbRow.cert}
            </span>
          </div>
          <div className="cd-choose-copy-lb__stage">
            {lbSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className={`cd-choose-copy-lb__img${lbZoom ? " cd-choose-copy-lb__img--zoom" : ""}`}
                src={lbSrc}
                alt={`Cert #${lbRow.cert} ${lbFace}`}
                onClick={() => setLbZoom((z) => !z)}
              />
            ) : (
              <span className="cd-choose-copy-lb__missing tkl-mono">
                No slab photo for this cert
              </span>
            )}
          </div>
          <div className="cd-choose-copy-lb__faces">
            <button
              type="button"
              className={`cd-choose-copy-lb__ftab${lbFace === "front" ? " is-on" : ""}`}
              onClick={() => {
                setLbFace("front");
                setLbZoom(false);
              }}
            >
              Front
            </button>
            <button
              type="button"
              className={`cd-choose-copy-lb__ftab${lbFace === "back" ? " is-on" : ""}`}
              disabled={!lbRow.back}
              onClick={() => {
                if (!lbRow.back) return;
                setLbFace("back");
                setLbZoom(false);
              }}
            >
              Back
            </button>
          </div>
          <div className="cd-choose-copy-lb__foot">
            <TkButton
              type="button"
              variant="primary"
              size="sm"
              className="cd-choose-copy__cta"
              onClick={() => setLbOpen(false)}
            >
              Close
            </TkButton>
          </div>
        </div>
      ) : null}
    </>,
    document.body,
  );
}

/** Price key for grouping asks — matches order book level keys. */
export function formatChooseCopyPriceLabel(order: Order): string {
  return formatListingUsdc(order.considerationAmount);
}
