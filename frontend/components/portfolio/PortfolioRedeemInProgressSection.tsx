"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { MyRedemptionRow } from "@/lib/core/api/rwa-redeem";
import type { AssetRow } from "@/lib/portfolio/portfolioTypes";
import {
  redeemSurfaceBadge,
  type RedeemSurfaceBadge,
} from "@/lib/portfolio/redeemDraft";

type OrderGroup = {
  key: string;
  paymentBatchId: string | null;
  rows: MyRedemptionRow[];
  cards: Array<{
    tokenId: number;
    name: string;
    imageUrl: string | null;
    status: string;
    badge: RedeemSurfaceBadge | null;
  }>;
};

function statusHrefFor(badge: RedeemSurfaceBadge | null): string | null {
  return badge?.statusHref ?? null;
}

function groupOrders(
  rowsIn: MyRedemptionRow[],
  assetRowsByTokenId: Map<number, AssetRow>,
): OrderGroup[] {
  const map = new Map<string, MyRedemptionRow[]>();
  for (const row of rowsIn) {
    const key = row.paymentBatchId?.trim() || `solo:${row.redemptionId}`;
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }

  const groups: OrderGroup[] = [];
  for (const [key, rows] of map) {
    const cards = rows.map((r) => {
      const tokenId = Number(r.tokenId);
      const asset = assetRowsByTokenId.get(tokenId);
      const badge = redeemSurfaceBadge(
        r.status,
        r.trackingNumber,
        r.carrierDeliveredAt,
      );
      return {
        tokenId,
        name: asset?.name ?? `RWA #${r.tokenId}`,
        imageUrl: asset?.imageUrl ?? null,
        status: r.status,
        badge,
      };
    });
    groups.push({
      key,
      paymentBatchId: rows[0]?.paymentBatchId ?? null,
      rows,
      cards,
    });
  }
  return groups;
}

function OrderList({
  orders,
  emptyCopy,
  linkLabel,
}: {
  orders: OrderGroup[];
  emptyCopy?: string;
  linkLabel?: (badge: RedeemSurfaceBadge | null) => string;
}) {
  if (orders.length === 0) {
    return emptyCopy ? <p className="pf-empty">{emptyCopy}</p> : null;
  }

  return (
    <ul className="pf-redeem-progress__orders">
      {orders.map((order) => {
        const firstBadge = order.cards[0]?.badge ?? null;
        const href = statusHrefFor(firstBadge);
        return (
          <li key={order.key} className="pf-redeem-progress__order">
            <div className="pf-redeem-progress__order-head">
              <div>
                <div className="pf-redeem-progress__order-title">
                  {order.cards.length} card
                  {order.cards.length === 1 ? "" : "s"}
                  {firstBadge ? (
                    <span
                      className={`pf-redeem-badge pf-redeem-badge--${firstBadge.tone}`}
                    >
                      {firstBadge.label}
                    </span>
                  ) : null}
                </div>
                {order.paymentBatchId ? (
                  <p className="pf-redeem-progress__order-meta tkl-mono">
                    Order {order.paymentBatchId.slice(0, 8)}…
                  </p>
                ) : null}
              </div>
              {href ? (
                <Link href={href} className="pf-redeem-progress__status-link">
                  {linkLabel
                    ? linkLabel(firstBadge)
                    : firstBadge?.kind === "custody_pending"
                      ? "Finish transfer"
                      : "View status"}
                </Link>
              ) : null}
            </div>
            <ul className="pf-redeem-progress__cards">
              {order.cards.map((c) => (
                <li key={c.tokenId} className="pf-redeem-progress__card">
                  <div className="pf-redeem-progress__thumb" aria-hidden>
                    {c.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.imageUrl} alt="" />
                    ) : null}
                  </div>
                  <div className="pf-redeem-progress__card-body">
                    <div className="pf-redeem-progress__card-name">{c.name}</div>
                    <div className="pf-redeem-progress__card-meta tkl-mono">
                      #{c.tokenId}
                      {c.badge ? ` · ${c.badge.label}` : ` · ${c.status}`}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}

/** Portfolio Redeem tab — in-progress orders + completed history. */
export function PortfolioRedeemInProgressSection({
  loading,
  inFlightRows,
  completedRows = [],
  assetRowsByTokenId,
}: {
  loading: boolean;
  inFlightRows: MyRedemptionRow[];
  completedRows?: MyRedemptionRow[];
  /** Owned + phantom rows for name/image. */
  assetRowsByTokenId: Map<number, AssetRow>;
}) {
  const inProgress = useMemo(
    () => groupOrders(inFlightRows, assetRowsByTokenId),
    [inFlightRows, assetRowsByTokenId],
  );
  const history = useMemo(
    () => groupOrders(completedRows, assetRowsByTokenId),
    [completedRows, assetRowsByTokenId],
  );

  if (loading) {
    return <p className="pf-empty">Loading redemptions…</p>;
  }

  if (inProgress.length === 0 && history.length === 0) {
    return (
      <div className="pf-redeem-progress">
        <p className="pf-empty">
          No redemptions yet. Select cards under My Assets → Redeem to start.
        </p>
      </div>
    );
  }

  return (
    <div className="pf-redeem-progress">
      <section className="pf-redeem-progress__section">
        <h2 className="pf-redeem-progress__section-title">In progress</h2>
        <p className="pf-redeem-progress__intro">
          Cards you&apos;ve paid to redeem — including ones already moved into
          Tokenable custody. Open status to finish transfers or track shipment.
        </p>
        <OrderList
          orders={inProgress}
          emptyCopy="No redemptions in progress."
        />
      </section>

      {history.length > 0 ? (
        <section className="pf-redeem-progress__section">
          <h2 className="pf-redeem-progress__section-title">Completed</h2>
          <p className="pf-redeem-progress__intro">
            Past redemptions — physical cards in your possession.
          </p>
          <OrderList
            orders={history}
            linkLabel={() => "View"}
          />
        </section>
      ) : null}
    </div>
  );
}
