"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { CARD_DISPLAY_LINE1_CLAMP_CLASS } from "@/components/marketplace/marketplace-shared";
import type { AssetRow } from "@/lib/portfolio/portfolioTypes";
import type { RedeemSurfaceBadge } from "@/lib/portfolio/redeemDraft";
import type { PortfolioCostBasisSource } from "@/lib/core/api/portfolio";
import { formatUsdCompact } from "@/lib/market/collectionMarketPricing";
import {
  formatPortfolioProfitReturn,
  type PortfolioHoldingsHeadline,
} from "@/lib/portfolio/portfolioTableHelpers";
import { TkTable } from "@/components/ds";
import { portfolioAssetHref } from "@/lib/portfolio/portfolioPaths";
import { isKbwMysteryCardTokenId } from "@/lib/portfolio/kbwMysteryCard";
import { KbwMysteryPortfolioImage } from "./KbwMysteryPortfolioImage";
import { PortfolioHoldingsRowActions } from "./PortfolioHoldingsRowActions";
import { PortfolioHoldingsSaleStatus } from "./PortfolioHoldingsSaleStatus";
import { PortfolioStaticTh } from "./PortfolioSortableTh";

export type HoldingsVaultChip = { text: string; tone: "psa" | "partner" };

/** Portfolio.html `#pf-tableview` — My Assets table layout. */
export function PortfolioHoldingsTableView({
  rows,
  headlineByTokenId,
  vaultByTokenId,
  costBasisByTokenId,
  costBasisSourceByTokenId,
  valuesPending,
  onSetPrice,
  getBadge,
  isTradeBlocked,
  assetHrefBase,
  selectMode = false,
  selectedTokenIds,
  onToggleSelect,
  isRowSelectable,
  onOpenKbwMysteryCard,
}: {
  rows: AssetRow[];
  headlineByTokenId: Map<number, PortfolioHoldingsHeadline>;
  vaultByTokenId?: Map<number, HoldingsVaultChip>;
  costBasisByTokenId: Map<number, number>;
  costBasisSourceByTokenId?: Map<number, PortfolioCostBasisSource | null>;
  valuesPending: boolean;
  onSetPrice: (tokenId: number) => void;
  getBadge: (tokenId: number) => RedeemSurfaceBadge | null;
  isTradeBlocked: (tokenId: number) => boolean;
  assetHrefBase: string;
  selectMode?: boolean;
  selectedTokenIds?: Set<number>;
  onToggleSelect?: (tokenId: number) => void;
  isRowSelectable?: (row: AssetRow) => boolean;
  onOpenKbwMysteryCard?: () => void;
}) {
  const t = useTranslations("PortfolioTable");
  return (
    <TkTable wrapClassName="pf-table-wrap pf-holdings-table-wrap" className="pf-table--holdings">
      <colgroup>
        <col className="pf-col-card" />
        <col className="pf-col-grade" />
        <col className="pf-col-value" />
        <col className="pf-col-return" />
        <col className="pf-col-status" />
        <col className="pf-col-action" />
      </colgroup>
      <thead>
        <tr>
          <PortfolioStaticTh label={t("card")} sortHint />
          <PortfolioStaticTh label={t("vault")} sortHint />
          <PortfolioStaticTh label={t("mktPrice")} sortHint align="right" />
          <PortfolioStaticTh label={t("chg")} sortHint align="right" />
          <PortfolioStaticTh label={t("status")} muted />
          <PortfolioStaticTh label={t("action")} align="center" muted />
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => {
          const cost = costBasisByTokenId.get(row.tokenId);
          const isListed =
            row.listPriceUsd != null && row.activeListingOrderHash != null;
          const badge = getBadge(row.tokenId);
          const tradeBlocked = isTradeBlocked(row.tokenId);
          const pnl = formatPortfolioProfitReturn(
            cost,
            row.currentPrice,
            costBasisSourceByTokenId?.get(row.tokenId),
          );
          const zebra = index % 2 === 1 ? " pf-table-row--zebra" : "";
          const dim =
            badge?.kind === "transit" || badge?.kind === "possession"
              ? " pf-holdings-row--dim"
              : "";
          const headline = headlineByTokenId.get(row.tokenId) ?? null;
          const titleLabel = headline?.line1 ?? row.name;
          const vault = vaultByTokenId?.get(row.tokenId) ?? null;
          const selected = selectedTokenIds?.has(row.tokenId) ?? false;
          const virtual = isKbwMysteryCardTokenId(row.tokenId);
          const kbwUsed = Boolean(row.kbwMysteryUsed);
          const canSelect =
            selectMode &&
            (isRowSelectable?.(row) ?? !tradeBlocked);
          const rowMods = [
            zebra,
            dim,
            canSelect && selected ? " pf-holdings-row--cl-on" : "",
            canSelect ? " pf-holdings-row--cl-pick" : "",
            selectMode && !canSelect ? " pf-holdings-row--cl-dim" : "",
          ].join("");

          const cardMedia = (
            <>
              <div className="pf-table-thumb">
                {virtual ? (
                  <KbwMysteryPortfolioImage used={kbwUsed} />
                ) : row.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.imageUrl} alt="" loading="lazy" decoding="async" />
                ) : null}
              </div>
              <div className="pf-table-card-copy">
                <span
                  className={`pf-table-card-name pf-table-card-name--holdings ${CARD_DISPLAY_LINE1_CLAMP_CLASS}`}
                  title={headline?.hover ?? titleLabel}
                >
                  {titleLabel}
                </span>
                {headline?.line2 ? (
                  <span className="pf-table-card-sub pf-table-card-sub--hover">
                    {headline.line2}
                  </span>
                ) : null}
              </div>
            </>
          );

          return (
            <tr
              key={row.tokenId}
              className={`asset-row pf-holdings-row${rowMods}`}
              onClick={
                canSelect
                  ? (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onToggleSelect?.(row.tokenId);
                    }
                  : undefined
              }
            >
              <td data-label="Card">
                {canSelect ? (
                  <div className="pf-table-card-cell pf-table-card-cell--holdings pf-table-card-cell--cl">
                    <span className="pf-rowchk" aria-hidden />
                    {cardMedia}
                  </div>
                ) : virtual && !kbwUsed ? (
                  <button
                    type="button"
                    className="pf-table-card-cell pf-table-card-cell--holdings pf-table-card-cell--activate"
                    onClick={() => onOpenKbwMysteryCard?.()}
                  >
                    {cardMedia}
                  </button>
                ) : virtual ? (
                  <div className="pf-table-card-cell pf-table-card-cell--holdings">
                    {cardMedia}
                  </div>
                ) : (
                  <Link
                    href={portfolioAssetHref(assetHrefBase, row.tokenId)}
                    className="pf-table-card-cell pf-table-card-cell--holdings"
                    onClick={selectMode ? (e) => e.preventDefault() : undefined}
                  >
                    {cardMedia}
                  </Link>
                )}
              </td>
              <td data-label="Vault" className="pf-col-grade-cell">
                {vault ? (
                  <span
                    className={`pf-vault-chip${
                      vault.tone === "partner" ? " pf-vault-chip--partner" : ""
                    }`}
                  >
                    {vault.text}
                  </span>
                ) : (
                  <span className="pf-table-muted">—</span>
                )}
              </td>
              <td data-label="Mkt Price" className="pf-col-num-cell">
                <span className="tkl-mono pf-table-mkt">
                  {valuesPending && row.currentPrice == null
                    ? "…"
                    : formatUsdCompact(row.currentPrice)}
                </span>
              </td>
              <td data-label="% Chg." className="pf-col-return-cell">
                <span
                  className={`tkl-mono pf-table-return${
                    pnl
                      ? pnl.muted
                        ? " pf-table-muted"
                        : pnl.positive
                          ? " pf-table-pl--pos"
                          : " pf-table-pl--neg"
                      : ""
                  }`}
                >
                  {pnl?.returnPct ?? "—"}
                </span>
              </td>
              <td data-label="Status">
                <PortfolioHoldingsSaleStatus
                  isListed={isListed}
                  redeemStatus={badge}
                  listPriceUsd={row.listPriceUsd}
                />
              </td>
              <td data-label="Action" className="pf-col-action-cell">
                {selectMode ? null : (
                  <PortfolioHoldingsRowActions
                    isListed={isListed}
                    disabled={tradeBlocked}
                    disabledTitle={
                      virtual
                        ? kbwUsed
                          ? "Event collectible — already used"
                          : "Event collectible — not listable"
                        : tradeBlocked
                          ? "Redemption in progress — listing unavailable"
                          : undefined
                    }
                    redeemStatus={badge}
                    onSetPrice={() => onSetPrice(row.tokenId)}
                  />
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </TkTable>
  );
}
