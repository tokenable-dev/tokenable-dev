import type { PartnerRedeemRow } from "@/lib/core";
import { isPartnerRedeemOpen } from "@/lib/partner/partnerRedeemStats";

export type PartnerShipmentTab =
  | "to_ship"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "all";

function rowTab(r: PartnerRedeemRow): Exclude<PartnerShipmentTab, "all"> {
  if (r.status === "cancelled" || r.status === "refunded") return "cancelled";
  if (r.status === "completed") return "delivered";
  if (r.trackingNumber?.trim()) return "shipped";
  return "to_ship";
}

function isActiveShipmentRow(r: PartnerRedeemRow): boolean {
  return (
    r.status !== "completed" &&
    r.status !== "cancelled" &&
    r.status !== "refunded" &&
    r.status !== "failed"
  );
}

export type PartnerShipmentGroup = {
  key: string;
  paymentBatchId: string;
  shipmentKey: string;
  items: PartnerRedeemRow[];
  trackingNumber: string | null;
  trackingCarrier: string | null;
  requestedAt: string;
  shipToLabel: string;
  tab: Exclude<PartnerShipmentTab, "all">;
};

/** Group partner redeems by trackingGroupKey (batch + vault + ship-to). */
export function groupPartnerRedeems(items: PartnerRedeemRow[]): PartnerShipmentGroup[] {
  const map = new Map<string, PartnerRedeemRow[]>();
  for (const row of items) {
    const batch = row.paymentBatchId?.trim();
    if (!batch) continue;
    const groupKey =
      row.trackingGroupKey?.trim() ||
      `${batch}::${row.shipmentKey}`;
    const list = map.get(groupKey) ?? [];
    list.push(row);
    map.set(groupKey, list);
  }

  const groups: PartnerShipmentGroup[] = [];
  for (const [key, rows] of map) {
    const first = rows[0]!;
    const paymentBatchId = first.paymentBatchId?.trim() ?? "";
    const activeRows = rows.filter(isActiveShipmentRow);
    const tracked = activeRows.find((r) => r.trackingNumber?.trim());
    const tabVotes = activeRows.length > 0 ? activeRows.map(rowTab) : rows.map(rowTab);
    const tab: Exclude<PartnerShipmentTab, "all"> = tabVotes.every(
      (t) => t === "cancelled",
    )
      ? "cancelled"
      : tabVotes.every((t) => t === "delivered")
        ? "delivered"
        : tracked
          ? "shipped"
          : tabVotes.some((t) => t === "to_ship")
            ? "to_ship"
            : "delivered";
    const ship = first.shipTo;
    groups.push({
      key,
      paymentBatchId,
      shipmentKey: first.shipmentKey,
      items: rows,
      trackingNumber: tracked?.trackingNumber ?? null,
      trackingCarrier: tracked?.trackingCarrier ?? null,
      requestedAt: first.requestedAt,
      shipToLabel: [
        ship.name,
        [ship.city, ship.region, ship.postal].filter(Boolean).join(", "),
        ship.country,
      ]
        .filter(Boolean)
        .join(" · "),
      tab,
    });
  }

  groups.sort(
    (a, b) =>
      new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime(),
  );
  return groups;
}

/** Active open shipments for summary pills (row-level, in-flight without tracking). */
export function openPartnerShipmentCount(items: PartnerRedeemRow[]): number {
  return items.filter(isPartnerRedeemOpen).length;
}
