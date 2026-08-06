import type { MyRedemptionRow } from "@/lib/core/api/rwa-redeem";
import type { RedeemDraftCard } from "@/lib/portfolio/redeemDraft";
import {
  defaultVaultLabelForShipment,
  redeemShipmentKey,
} from "@/lib/portfolio/redeemShipmentKey";

export type RedeemShipmentView = {
  shipmentKey: string;
  vaultLabel: string;
  idx: number;
  cardCount: number;
  cards: RedeemDraftCard[];
  trackingNumber: string | null;
  trackingCarrier: string | null;
  /** preparing = custody, no tracking yet; on_the_way = tracking set. */
  state: "preparing" | "on_the_way";
};

export function buildRedeemShipments(input: {
  rows: MyRedemptionRow[];
  cardsByTokenId: Map<number, RedeemDraftCard>;
  vaultLabelByTokenId?: Map<number, string>;
}): RedeemShipmentView[] {
  type Acc = {
    shipmentKey: string;
    vaultLabel: string;
    rows: MyRedemptionRow[];
  };
  const map = new Map<string, Acc>();
  const order: string[] = [];

  for (const row of input.rows) {
    const tokenId = Number(row.tokenId);
    const key = redeemShipmentKey({
      settlementPolicy: row.settlementPolicy,
      vaultPartnerId: row.vaultPartnerId,
    });
    let acc = map.get(key);
    if (!acc) {
      const fromCard = Number.isFinite(tokenId)
        ? input.vaultLabelByTokenId?.get(tokenId)
        : undefined;
      acc = {
        shipmentKey: key,
        vaultLabel: defaultVaultLabelForShipment({
          shipmentKey: key,
          vaultLabel: fromCard,
        }),
        rows: [],
      };
      map.set(key, acc);
      order.push(key);
    }
    acc.rows.push(row);
  }

  return order.map((key, i) => {
    const acc = map.get(key)!;
    const tracked = acc.rows.find((r) => r.trackingNumber?.trim());
    const cards = acc.rows.map((r) => {
      const tid = Number(r.tokenId);
      return (
        input.cardsByTokenId.get(tid) ?? {
          tokenId: tid,
          name: `RWA #${r.tokenId}`,
          imageUrl: null,
          grade: null,
          certNumber: null,
          vaultLabel: acc.vaultLabel,
        }
      );
    });
    return {
      shipmentKey: key,
      vaultLabel: acc.vaultLabel,
      idx: i + 1,
      cardCount: cards.length,
      cards,
      trackingNumber: tracked?.trackingNumber?.trim() || null,
      trackingCarrier: tracked?.trackingCarrier?.trim() || null,
      state: tracked?.trackingNumber?.trim() ? "on_the_way" : "preparing",
    };
  });
}
