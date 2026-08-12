import type { PartnerRedeemRow } from "@/lib/core";
import { getCachedRwaImageUrl } from "@/lib/marketplace";
import type { PartnerShipmentGroup } from "@/lib/partner/partnerRedeemGroups";
import { partnerRedeemDeadlineMs } from "@/lib/partner/partnerRedeemStats";

export type PartnerShipmentStatusKey =
  | "new"
  | "preparing"
  | "shipped"
  | "delivered"
  | "cancelled";

export const PARTNER_SHIPMENT_STATUS: Record<
  PartnerShipmentStatusKey,
  { label: string; bg: string; fg: string }
> = {
  new: {
    label: "New",
    bg: "rgba(26,111,255,0.14)",
    fg: "#5B9AFF",
  },
  preparing: {
    label: "Preparing",
    bg: "rgba(234,130,0,0.14)",
    fg: "#EA8200",
  },
  shipped: {
    label: "Shipped",
    bg: "rgba(0,200,100,0.14)",
    fg: "#00C864",
  },
  delivered: {
    label: "Delivered",
    bg: "rgba(255,255,255,0.08)",
    fg: "rgba(255,255,255,0.7)",
  },
  cancelled: {
    label: "Cancelled",
    bg: "rgba(255,255,255,0.08)",
    fg: "rgba(255,255,255,0.55)",
  },
};

function rowInCustody(row: PartnerRedeemRow): boolean {
  return row.status === "in_custody";
}

export function partnerShipmentStatusKey(
  group: PartnerShipmentGroup,
): PartnerShipmentStatusKey {
  if (group.tab === "cancelled") return "cancelled";
  if (group.tab === "delivered") return "delivered";
  if (group.tab === "shipped") return "shipped";
  const active = group.items.filter(
    (r) =>
      r.status !== "completed" &&
      r.status !== "cancelled" &&
      r.status !== "refunded" &&
      r.status !== "failed",
  );
  if (active.some(rowInCustody)) return "preparing";
  return "new";
}

export function partnerShipToCity(group: PartnerShipmentGroup): string {
  const ship = group.items[0]?.shipTo;
  if (!ship) return "";
  const parts = [ship.city, ship.region].filter(Boolean);
  return parts.join(", ");
}

export function partnerShipToAddressLines(
  group: PartnerShipmentGroup,
): string[] {
  const ship = group.items[0]?.shipTo;
  if (!ship) return [];
  return [
    ship.name,
    ship.line1,
    ship.line2,
    [ship.city, ship.region, ship.postal].filter(Boolean).join(", "),
    ship.country,
    ship.phone,
  ].filter((line): line is string => Boolean(line?.trim()));
}

export function partnerCardCertLine(item: PartnerRedeemRow): string | null {
  if (!item.certNumber?.trim()) return null;
  return item.certNumber.trim();
}

export function partnerTrackingUrl(
  carrier: string | null,
  trackingNumber: string,
): string {
  const c = (carrier ?? "").toLowerCase();
  const num = encodeURIComponent(trackingNumber);
  if (c.includes("dhl")) {
    return `https://www.dhl.com/en/express/tracking.html?AWB=${num}`;
  }
  if (c.includes("ups")) {
    return `https://www.ups.com/track?tracknum=${num}`;
  }
  if (c.includes("fedex")) {
    return `https://www.fedex.com/fedextrack/?trknbr=${num}`;
  }
  if (c.includes("usps")) {
    return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${num}`;
  }
  return "#";
}

/** Resolve card image: API `imageUrl` first, then metadata batch fallback for legacy rows. */
export function partnerCardImageUrl(
  item: { tokenId: string | null; imageUrl: string | null },
  metadataImages: ReadonlyMap<string, string>,
): string | null {
  const direct = item.imageUrl?.trim();
  if (direct) return direct;
  const tid = item.tokenId?.trim();
  if (tid) {
    const fromMeta = metadataImages.get(tid);
    if (fromMeta) return fromMeta;
  }
  const n = Number(item.tokenId);
  if (Number.isFinite(n) && n > 0) {
    const cached = getCachedRwaImageUrl(n);
    if (cached) return cached;
  }
  return null;
}

export function sortPartnerShipmentGroups(
  groups: PartnerShipmentGroup[],
): PartnerShipmentGroup[] {
  const list = [...groups];
  list.sort((a, b) => {
    const aOpen = a.tab === "to_ship";
    const bOpen = b.tab === "to_ship";
    if (aOpen !== bOpen) return aOpen ? -1 : 1;
    if (aOpen && bOpen) {
      return (
        partnerRedeemDeadlineMs(a.requestedAt) -
        partnerRedeemDeadlineMs(b.requestedAt)
      );
    }
    return new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime();
  });
  return list;
}
