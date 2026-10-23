"use client";

import { memo, useState } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics/googleAnalytics";
import type { AssetRow } from "@/lib/portfolio/portfolioTypes";
import type { RedeemSurfaceBadge } from "@/lib/portfolio/redeemDraft";
import { type PortfolioHoldingsHeadline } from "@/lib/portfolio/portfolioTableHelpers";
import { holdingsSaleKind } from "@/lib/portfolio/portfolioHoldingsSaleStatus";
import { isKbwMysteryCardTokenId } from "@/lib/portfolio/kbwMysteryCard";
import { KbwMysteryPortfolioImage } from "./KbwMysteryPortfolioImage";
/** Portfolio.html gallery `data-seg`. Listed / unlisted have no badge. */
type GalleryStyleSeg = "notlisted" | "listed" | "shipping";

function listedPriceInput(price: number | null | undefined): string {
  if (price == null || !Number.isFinite(price)) return "";
  return Math.round(price).toLocaleString("en-US");
}

function formatLastPrice(price: number): string {
  return `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
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
  marketPriceUsd = null,
  disabled,
  disabledTitle,
  onSubmit,
}: {
  listed: boolean;
  listPriceUsd: number | null;
  /** Unlisted tiles prefill the last market price (Portfolio.html `pfActRow`). */
  marketPriceUsd?: number | null;
  disabled?: boolean;
  disabledTitle?: string;
  onSubmit: (draftPriceUsdc: string | null) => void;
}) {
  const [value, setValue] = useState(() =>
    listed ? listedPriceInput(listPriceUsd) : listedPriceInput(marketPriceUsd),
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
        {listed ? "Change" : "Set"}
      </button>
    </div>
  );
}

function galleryStatusSeg(
  isListed: boolean,
  redeemStatus: RedeemSurfaceBadge | null,
): GalleryStyleSeg {
  const kind = holdingsSaleKind(isListed, redeemStatus);
  if (kind === "listed") return "listed";
  if (kind === "redeeming") return "shipping";
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
  const seg = galleryStatusSeg(isListed, redeemStatus);
  const titleHover = headline?.hover ?? row.name;
  const titleLabel = headline?.nameLine?.trim() || headline?.line1 || row.name;
  const gradeLabel = headline?.grade?.trim() || "";
  void cost;
  void valuesPending;
  const marketUsd =
    row.currentPrice != null && Number.isFinite(row.currentPrice)
      ? row.currentPrice
      : null;
  const lifecycleBadge = seg === "shipping" ? "Redeeming" : null;
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

  return (
    <div
      className={tileClass}
      data-seg={seg}
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
        {lifecycleBadge ? (
          <div className="pf-gtile__badge-wrap">
            <span className="pf-gbadge pf-gbadge--lifecycle">{lifecycleBadge}</span>
          </div>
        ) : null}
      </div>

      <div className="pf-gtile__body">
        <div className="pf-gtile__title" title={titleHover}>
          {href && !selectMode ? (
            <Link href={href} className="pf-gtile__title-link">
              <span className="pf-gtile__title-name">{titleLabel}</span>
              <span className="pf-gtile__title-grade">{gradeLabel || "\u00a0"}</span>
            </Link>
          ) : (
            <>
              <span className="pf-gtile__title-name">{titleLabel}</span>
              <span className="pf-gtile__title-grade">{gradeLabel || "\u00a0"}</span>
            </>
          )}
        </div>

        {!selectMode ? (
          <div
            className="pf-gtile__act"
            onClick={onActivate ? (e) => e.stopPropagation() : undefined}
          >
            {seg === "shipping" ? (
              redeemStatus?.statusHref ? (
                <Link href={redeemStatus.statusHref} className="pf-gstatus">
                  View status →
                </Link>
              ) : (
                <div className="pf-gact pf-gact--empty" />
              )
            ) : (
              <PortfolioGalleryPriceField
                key={`${row.tokenId}-${row.listPriceUsd ?? "open"}-${seg}`}
                listed={seg === "listed"}
                listPriceUsd={row.listPriceUsd}
                marketPriceUsd={marketUsd}
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
            <div className="pf-gcap">
              {seg === "listed" && marketUsd != null ? (
                <>
                  Last price <span className="pf-gcap__amt">{formatLastPrice(marketUsd)}</span>
                </>
              ) : seg === "notlisted" ? (
                "Last price"
              ) : (
                "\u00a0"
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
});
