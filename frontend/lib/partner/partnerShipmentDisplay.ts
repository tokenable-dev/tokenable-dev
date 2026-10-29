import type { PartnerRedeemRow, RwaMetadata } from "@/lib/core";
import { activeRqChainId } from "@/lib/chains";
import { getCachedRwaImageUrl } from "@/lib/marketplace";
import type { PartnerShipmentGroup } from "@/lib/partner/partnerRedeemGroups";
import { partnerRedeemDeadlineMs } from "@/lib/partner/partnerRedeemStats";
import {
  buildRwaAssetDetailHeadlineParts,
  formatAssetDetailLine1,
  resolveRwaHeadlineGrade,
} from "@/lib/marketplace/assetDetailHeadline";
import { formatPortfolioGradeLabel } from "@/lib/portfolio/portfolioTableHelpers";
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

function partnerRedeemGrade(
  item: PartnerRedeemRow,
  metadataByTokenId?: ReadonlyMap<string, RwaMetadata>,
): string | null {
  const tid = item.tokenId?.trim();
  const meta = tid ? metadataByTokenId?.get(tid) : undefined;
  const grade =
    formatPortfolioGradeLabel(meta ?? null) || resolveRwaHeadlineGrade(meta);
  return grade?.trim() || null;
}

/** Partner-Shipments.html `.cid` — `{Grade} · {cert}` (grade left of cert number). */
export function partnerCardCertLine(
  item: PartnerRedeemRow,
  metadataByTokenId?: ReadonlyMap<string, RwaMetadata>,
): string | null {
  const grade = partnerRedeemGrade(item, metadataByTokenId);
  const cert = item.certNumber?.trim();
  if (grade && cert) return `${grade} · ${cert}`;
  if (grade) return grade;
  if (cert) return cert;
  return null;
}

function stripTrailingGradeFromTitle(title: string, grade: string | null): string {
  const g = grade?.trim();
  if (!g || !title.trim()) return title;
  const suffix = ` · ${g}`;
  if (title.endsWith(suffix)) return title.slice(0, -suffix.length).trim();
  if (title.endsWith(g)) {
    const trimmed = title.slice(0, -g.length).replace(/\s*·\s*$/, "").trim();
    if (trimmed) return trimmed;
  }
  return title;
}

/**
 * Redeem requests card title — Partner-Shipments.html `.cname` (no grade on the title line).
 */
export function partnerRedeemCardTitle(
  item: PartnerRedeemRow,
  metadataByTokenId?: ReadonlyMap<string, RwaMetadata>,
  labels?: { token: (id: string) => string; card: string },
): string {
  const fallback =
    item.displayName?.trim() ||
    (item.tokenId?.trim()
      ? labels
        ? labels.token(item.tokenId)
        : `Token #${item.tokenId}`
      : (labels?.card ?? "Card"));
  const tid = item.tokenId?.trim();
  const meta = tid ? metadataByTokenId?.get(tid) : undefined;
  const grade = partnerRedeemGrade(item, metadataByTokenId);
  const parts = buildRwaAssetDetailHeadlineParts(meta ?? null, fallback);
  const line1 = formatAssetDetailLine1(parts, { grade, omitGrade: true });
  if (line1?.trim()) return line1.trim();
  return stripTrailingGradeFromTitle(fallback, grade);
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
    const cached = getCachedRwaImageUrl(activeRqChainId(), n);
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
