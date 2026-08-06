"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TkButton } from "@/components/ds";
import {
  getMyRedemptions,
  paidEstimateFromMyRedemptions,
} from "@/lib/core/api/rwa-redeem";
import { buildRedeemShipments, type RedeemShipmentView } from "@/lib/portfolio/buildRedeemShipments";
import type {
  RedeemAddressForm,
  RedeemDraftCard,
} from "@/lib/portfolio/redeemDraft";
import { RedeemCardSummary } from "./RedeemCardSummary";
import { RedeemCostBreakdown } from "./RedeemCostBreakdown";

/** After pay / custody — cards are being prepared (ds-5 `wd-preparing`). */
export function RedeemPreparingPanel({
  cards,
  form: _form,
  shipments: shipmentsProp,
}: {
  cards: RedeemDraftCard[];
  form: RedeemAddressForm;
  shipments?: RedeemShipmentView[];
}) {
  const count = cards.length;
  const tokenIds = cards.map((c) => c.tokenId);
  const paidQuery = useQuery({
    queryKey: ["rwa", "redemptions", "mine", "paid", tokenIds.join(",")],
    queryFn: () => getMyRedemptions(tokenIds),
    enabled: count > 0,
    staleTime: 30_000,
  });
  const est = paidEstimateFromMyRedemptions(paidQuery.data ?? []);

  const shipments = useMemo(() => {
    if (shipmentsProp && shipmentsProp.length > 0) return shipmentsProp;
    const cardsByTokenId = new Map(cards.map((c) => [c.tokenId, c]));
    const vaultLabelByTokenId = new Map(
      cards.map((c) => [c.tokenId, c.vaultLabel] as const),
    );
    return buildRedeemShipments({
      rows: paidQuery.data ?? [],
      cardsByTokenId,
      vaultLabelByTokenId,
    });
  }, [shipmentsProp, cards, paidQuery.data]);

  const progressRows =
    shipments.length > 0
      ? shipments
      : [
          {
            shipmentKey: "legacy",
            vaultLabel: cards[0]?.vaultLabel || "PSA Vault",
            cardCount: count,
            state: "preparing" as const,
            idx: 1,
          },
        ];

  return (
    <div className="pf-redeem-panel">
      <div className="pf-redeem-banner pf-redeem-banner--azure">
        <svg
          className="pf-redeem-banner__icon pf-redeem-banner__icon--pos"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          aria-hidden
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <div>
          <strong>Payment received — your cards are being prepared</strong>
          <p>
            While your cards are on their way, Tokenable holds their ownership for
            you. They can&rsquo;t be sold or listed until they&rsquo;re delivered.
            {progressRows.length > 1
              ? " Cards from different vaults ship as separate packages."
              : ""}
          </p>
        </div>
      </div>

      {cards.length > 0 ? <RedeemCardSummary cards={cards} /> : null}

      <div className="pf-redeem-shipment">
        <div className="pf-redeem-shipment__title">Shipment progress</div>
        {progressRows.map((sh) => (
          <div className="pf-redeem-prep-row" key={sh.shipmentKey}>
            <span>
              Shipment {sh.idx} · {sh.vaultLabel} ({sh.cardCount || "—"} card
              {(sh.cardCount || 0) === 1 ? "" : "s"})
            </span>
            <span className="pf-redeem-status-pill pf-redeem-status-pill--warn tkl-mono">
              {sh.state === "on_the_way" ? "On the way" : "Preparing"}
            </span>
          </div>
        ))}
      </div>

      <div className="pf-redeem-cost">
        <RedeemCostBreakdown
          est={est ?? undefined}
          loading={paidQuery.isLoading}
          cardCount={count}
          embed
          title="Paid"
          totalLabel="Total paid"
        />
        <p className="pf-redeem-cost__copy">
          Charged when you confirmed — no markup. Amounts are from your recorded
          payment (not re-quoted).
        </p>
      </div>

      <TkButton
        type="button"
        variant="subtle"
        className="pf-redeem-primary"
        disabled
      >
        Cancel redemption
      </TkButton>
      <p className="pf-redeem-hint-below" style={{ marginBottom: 20 }}>
        You can cancel until the courier is contacted. Cancelling refunds shipping
        and the Redemption fee in full, and ownership returns to your account.
        (Cancel ships in a later update.)
      </p>

      <Link href="/portfolio" className="pf-redeem-primary-link">
        <TkButton type="button" variant="primary" className="pf-redeem-primary">
          Back to Portfolio
        </TkButton>
      </Link>
    </div>
  );
}
