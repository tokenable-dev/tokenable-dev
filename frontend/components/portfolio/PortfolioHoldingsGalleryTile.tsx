"use client";

import { memo, useState } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics/googleAnalytics";
import { CARD_DISPLAY_LINE1_CLAMP_CLASS } from "@/components/marketplace/marketplace-shared";
import type { AssetRow } from "@/lib/portfolio/portfolioTypes";
import type { RedeemSurfaceBadge } from "@/lib/portfolio/redeemDraft";
import { formatUsdCompact } from "@/lib/market/collectionMarketPricing";
import {
  formatPortfolioProfitReturn,
  portfolioPriceChangeArrow,
  type PortfolioHoldingsHeadline,
} from "@/lib/portfolio/portfolioTableHelpers";
import { PortfolioHoldingsRowActions } from "./PortfolioHoldingsRowActions";
import {
  holdingsSaleKind,
  holdingsSaleStatusLabel,
} from "@/lib/portfolio/portfolioHoldingsSaleStatus";
import { isKbwMysteryCardTokenId } from "@/lib/portfolio/kbwMysteryCard";
import { KbwMysteryPortfolioImage } from "./KbwMysteryPortfolioImage";
type GalleryStatusSeg = "notlisted" | "listed" | "redeeming";

const GALLERY_STATUS: Record<GalleryStatusSeg, { className: string }> = {
  notlisted: { className: "pf-gbadge--notlisted" },
  listed: { className: "pf-gbadge--listed" },
  redeeming: { className: "pf-gbadge--redeeming" },
};

function listedPriceInput(price: number | null | undefined): string {
  if (price == null || !Number.isFinite(price)) return "";
  return price.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** Digits the Set/Edit sheet should open with. Empty or junk stays unset. */
function draftPriceUsdc(raw: string): string | null {
  const v = raw.replace(/,/g, "").trim();
  if (!/^\d+(\.\d+)?$/.test(v)) return null;
  return v;
}

/** Portfolio.html gallery `pf-gfield` — $ input + Set / Update. Opens the price sheet. */
export function PortfolioGalleryPriceField({
  listed,
  listPriceUsd,
  disabled,
  disabledTitle,
  onSubmit,
}: {
  listed: boolean;
  listPriceUsd: number | null;
  disabled?: boolean;
  disabledTitle?: string;
  onSubmit: (draftPriceUsdc: string | null) => void;
}) {
  const [value, setValue] = useState(() =>
    listed ? listedPriceInput(listPriceUsd) : "",
  );

  const submit = () => {
    if (disabled) return;
    onSubmit(draftPriceUsdc(value));
  };

  return (
    <div className="pf-gact pf-gfield">
      <span className="pf-gfield__dollar" aria-hidden>
        $
      </span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="Input price"
        aria-label="Listing price"
        value={value}
        disabled={disabled}
        title={disabled ? disabledTitle : undefined}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          submit();
        }}
      />
      <button
        type="button"
        className="pf-gact-btn"
        disabled={disabled}
        title={disabled ? disabledTitle : undefined}
        onClick={submit}
      >
        {listed ? "Update" : "Set"}
      </button>
    </div>
  );
}

function galleryStatusSeg(
  isListed: boolean,
  redeemStatus: RedeemSurfaceBadge | null,
): GalleryStatusSeg {
  const kind = holdingsSaleKind(isListed, redeemStatus);
  if (kind === "listed") return "listed";
  if (kind === "redeeming") return "redeeming";
  return "notlisted";
}

/** My Assets gallery tile — Portfolio.html `pf-gtile`. */
export const PortfolioHoldingsGalleryTile = memo(function PortfolioHoldingsGalleryTile({
  row,
  headline,
  href,
  cost,
  valuesPending,
  isListed,
  redeemStatus = null,
  actionsDisabled = false,
  actionsDisabledTitle,
  onSetPrice,
  selectMode = false,
  selected = false,
  onToggleSelect,
  onActivate,
}: {
  row: AssetRow;
  headline: PortfolioHoldingsHeadline | null;
  href?: string;
  cost: number | undefined;
  valuesPending: boolean;
  isListed: boolean;
  redeemStatus?: RedeemSurfaceBadge | null;
  actionsDisabled?: boolean;
  actionsDisabledTitle?: string;
  onSetPrice: (tokenId: number, draftPriceUsdc?: string | null) => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onActivate?: () => void;
}) {
  const pnl = formatPortfolioProfitReturn(cost, row.currentPrice);
  const hasVal = row.currentPrice != null && Number.isFinite(row.currentPrice);
  const retLabel = pnl?.returnPct ?? null;
  const seg = galleryStatusSeg(isListed, redeemStatus);
  const badge = GALLERY_STATUS[seg];
  const badgeLabel = holdingsSaleStatusLabel(
    holdingsSaleKind(isListed, redeemStatus),
  );
  const titleHover = headline?.hover ?? row.name;
  const titleLabel = headline?.line1 ?? row.name;
  const kbwVirtual = isKbwMysteryCardTokenId(row.tokenId);

  const tileClass = [
    "pf-gtile",
    redeemStatus?.kind === "transit" ? "pf-gtile--transit" : null,
    redeemStatus?.kind === "possession" ? "pf-gtile--possession" : null,
    selectMode && selected ? "pf-gtile--sel-on" : null,
    selectMode ? "pf-gtile--sel-pick" : null,
    onActivate && !selectMode ? "pf-gtile--activate" : null,
  ]
    .filter(Boolean)
    .join(" ");

  const titleNode = headline ? (
    <span className={CARD_DISPLAY_LINE1_CLAMP_CLASS}>{headline.line1}</span>
  ) : (
    titleLabel
  );

  return (
    <div
      className={tileClass}
      role={onActivate && !selectMode ? "button" : undefined}
      tabIndex={onActivate && !selectMode ? 0 : undefined}
      onKeyDown={
        onActivate && !selectMode
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onActivate();
              }
            }
          : undefined
      }
      onClick={
        selectMode
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleSelect?.();
            }
          : onActivate && !selectMode
            ? (e) => {
                e.preventDefault();
                onActivate();
              }
            : undefined
      }
    >
      <div className="pf-gtile__media">
        {href && !selectMode ? (
          <Link href={href} className="pf-gtile__media-link" aria-label={titleLabel}>
            {kbwVirtual ? (
              <KbwMysteryPortfolioImage used={Boolean(row.kbwMysteryUsed)} />
            ) : row.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={row.imageUrl}
                alt=""
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="pf-gtile__media-empty tkl-mono">#{row.tokenId}</span>
            )}
          </Link>
        ) : kbwVirtual ? (
          <KbwMysteryPortfolioImage used={Boolean(row.kbwMysteryUsed)} />
        ) : row.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="pf-gtile__media-empty tkl-mono">#{row.tokenId}</span>
        )}
        {selectMode ? (
          <div className={`pf-selchk${selected ? " pf-selchk--on" : ""}`} aria-hidden>
            {selected ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : null}
          </div>
        ) : null}
        <div className="pf-gtile__badge-wrap">
          <span className={`pf-gbadge tkl-mono ${badge.className}`}>{badgeLabel}</span>
        </div>
      </div>

      <div className="pf-gtile__body">
        <div className="pf-gtile__title" title={titleHover}>
          {href && !selectMode ? (
            <Link href={href} className="pf-gtile__title-link">
              {titleNode}
            </Link>
          ) : (
            titleNode
          )}
        </div>

        {!selectMode ? (
          <div
            className="pf-gtile__act"
            onClick={onActivate ? (e) => e.stopPropagation() : undefined}
          >
            {seg === "redeeming" ? (
              <PortfolioHoldingsRowActions
                isListed={isListed}
                fullWidth
                disabled={actionsDisabled}
                disabledTitle={actionsDisabledTitle}
                redeemStatus={redeemStatus}
                onSetPrice={() => onSetPrice(row.tokenId)}
              />
            ) : (
              <PortfolioGalleryPriceField
                key={`${row.tokenId}-${row.listPriceUsd ?? "open"}`}
                listed={isListed}
                listPriceUsd={row.listPriceUsd}
                disabled={actionsDisabled}
                disabledTitle={actionsDisabledTitle}
                onSubmit={(draft) => {
                  trackEvent(isListed ? "edit_price_clicked" : "set_price_clicked", {
                    card_id: String(row.tokenId),
                    current_price: row.currentPrice ?? undefined,
                  });
                  onSetPrice(row.tokenId, draft);
                }}
              />
            )}
          </div>
        ) : null}

        <div className="pf-gtile__price-row">
          <div className="pf-gtile__price-main card__price-row">
            <span className="card__price pf-gtile__mkt tkl-mono" title="Market price">
              {valuesPending && row.currentPrice == null
                ? "…"
                : formatUsdCompact(row.currentPrice)}
              {hasVal && pnl && !pnl.muted ? (
                <span
                  className={`pf-mkt-dir${
                    pnl.positive ? " pf-table-pl--pos" : " pf-table-pl--neg"
                  }`}
                  aria-hidden
                >
                  {portfolioPriceChangeArrow(pnl.positive)}
                </span>
              ) : null}
            </span>
            <span
              className={`card__sub pf-gtile__ret tkl-mono${
                hasVal && retLabel && pnl
                  ? pnl.muted
                    ? " card__sub--muted"
                    : pnl.positive
                      ? " card__sub--up pf-table-pl--pos"
                      : " card__sub--down pf-table-pl--neg"
                  : " pf-gtile__ret--empty"
              }`}
              title={hasVal && retLabel ? "% change vs cost" : undefined}
              aria-hidden={!retLabel}
            >
              {hasVal && retLabel ? retLabel : "\u00a0"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});
