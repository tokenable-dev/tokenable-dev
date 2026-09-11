import type { PartnerRedeemRow, RwaMetadata } from "@/lib/core";
import { getCachedRwaImageUrl } from "@/lib/marketplace";
import type { PartnerShipmentGroup } from "@/lib/partner/partnerRedeemGroups";
import { partnerRedeemDeadlineMs } from "@/lib/partner/partnerRedeemStats";
import { formatRedeemCardLine1FromMetadata } from "@/lib/portfolio/portfolioTableHelpers";
import { buildCarrierTrackingUrl } from "@/lib/shipping/carrierTracking";

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
    bg: "rgba(243,112,30,0.14)",
    fg: "#F3701E",
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
  if (ship.region?.trim()) {
    return [ship.city, ship.region].filter(Boolean).join(", ");
  }
  // Partner-Shipments.html city line uses "City, Country" when region is absent.
  return [ship.city, ship.country].filter(Boolean).join(", ");
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

/**
 * Redeem requests card title — same Line 1 as portfolio redeem:
 * `{Name} · {Number} · {Grade}`.
 */
export function partnerRedeemCardTitle(
  item: PartnerRedeemRow,
  metadataByTokenId?: ReadonlyMap<string, RwaMetadata>,
): string {
  const fallback =
    item.displayName?.trim() ||
    (item.tokenId?.trim() ? `Token #${item.tokenId}` : "Card");
  const tid = item.tokenId?.trim();
  const meta = tid ? metadataByTokenId?.get(tid) : undefined;
  return formatRedeemCardLine1FromMetadata(meta ?? null, fallback);
}


export function partnerTrackingUrl(
  carrier: string | null,
  trackingNumber: string,
): string | null {
  return buildCarrierTrackingUrl(carrier ?? undefined, trackingNumber);
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
