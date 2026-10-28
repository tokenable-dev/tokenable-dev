"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TkButton } from "@/components/ds";
import {
  getMyRedemptions,
  paidEstimateFromMyRedemptions,
} from "@/lib/core/api/rwa-redeem";
import { rq } from "@/lib/core/queryKeys";
import { useAppChain } from "@/providers/AppChainProvider";
import { buildRedeemShipments, type RedeemShipmentView } from "@/lib/portfolio/buildRedeemShipments";
import type {
  RedeemAddressForm,
  RedeemDraftCard,
} from "@/lib/portfolio/redeemDraft";
import { RedeemCostBreakdown } from "./RedeemCostBreakdown";

/** After pay / custody — cards are being prepared (`#wd-preparing`). */
export function RedeemPreparingPanel({
  cards,
  form: _form,
  shipments: shipmentsProp,
}: {
  cards: RedeemDraftCard[];
  form: RedeemAddressForm;
  shipments?: RedeemShipmentView[];
}) {
  const { chainId } = useAppChain();
  const t = useTranslations("RedeemUi");
  const count = cards.length;
  const tokenIds = cards.map((c) => c.tokenId);
  const paidQuery = useQuery({
    queryKey: rq.myRedemptionsPaid(chainId, tokenIds.join(",")),
    queryFn: () => getMyRedemptions(chainId, tokenIds),
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
            vaultLabel: cards[0]?.vaultLabel?.trim() || "—",
            cardCount: count,
            state: "preparing" as const,
            idx: 1,
          },
        ];

  return (
    <div className="pf-redeem-panel">
      <div className="pf-redeem-eyebrow">{t("eyebrow")}</div>
      <h1 className="pf-redeem-h1">{t("preparingTitle")}</h1>
      <p className="pf-redeem-sub pf-redeem-sub--prep">{t("preparingSub")}</p>

      <div className="pf-redeem-shipment">
        <div className="pf-redeem-shipment__title">{t("shipmentProgress")}</div>
        {progressRows.map((sh) => (
          <div className="pf-redeem-prep-row" key={sh.shipmentKey}>
            <span>
              {t("shipmentLine", {
                index: sh.idx,
                vault: sh.vaultLabel ? ` · ${sh.vaultLabel}` : "",
                count: sh.cardCount || "—",
                unit: (sh.cardCount || 0) === 1 ? t("cardOne") : t("cardMany"),
              })}
            </span>
            <span className="pf-redeem-status-pill pf-redeem-status-pill--warn">
              {sh.state === "on_the_way" ? t("onTheWay") : t("preparing")}
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
          title={t("paid")}
          totalLabel={t("totalPaid")}
        />
        <p className="pf-redeem-cost__copy">{t("charged")}</p>
      </div>

      <TkButton
        type="button"
        variant="subtle"
        className="pf-redeem-primary pf-redeem-cancel-btn"
        disabled
      >
        {t("cancel")}
      </TkButton>
      <p className="pf-redeem-hint-below pf-redeem-hint-below--prep">
        {t("cancelHint")}
      </p>

      <Link href="/portfolio" className="pf-redeem-primary-link pf-redeem-primary-link--prep">
        <TkButton type="button" variant="primary" className="pf-redeem-primary">
          {t("backCollection")}
        </TkButton>
      </Link>
    </div>
  );
}
