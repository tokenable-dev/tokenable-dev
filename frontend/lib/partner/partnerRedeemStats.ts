/** Partner redeem ship SLA — Partner-Shipments.html (request + 5 days). */
export const PARTNER_REDEEM_SLA_MS = 5 * 24 * 60 * 60 * 1000;
const MS_24H = 24 * 60 * 60 * 1000;

export type PartnerRedeemOpenRow = {
  trackingNumber: string | null;
  status: string;
};

export function isPartnerRedeemOpen(row: PartnerRedeemOpenRow): boolean {
  if (
    row.status === "completed" ||
    row.status === "cancelled" ||
    row.status === "refunded"
  ) {
    return false;
  }
  return !row.trackingNumber?.trim();
}

/** Open redeems without tracking (row-level — portfolio header badge). */
export function openToShipCount(items: PartnerRedeemOpenRow[]): number {
  return items.filter(isPartnerRedeemOpen).length;
}

export function partnerRedeemDeadlineMs(requestedAt: string): number {
  return new Date(requestedAt).getTime() + PARTNER_REDEEM_SLA_MS;
}

/** Deadline within the next 24h and not yet passed. */
export function isPartnerRedeemDueSoon(requestedAt: string, now = Date.now()): boolean {
  const left = partnerRedeemDeadlineMs(requestedAt) - now;
  return left > 0 && left <= MS_24H;
}

export function partnerRedeemDueSoonBannerText(count: number): string {
  const noun = count === 1 ? "1 shipment" : `${count} shipments`;
  return `${noun} due within 24h — ship now to avoid auto-cancellation.`;
}

const MS_HOUR = 60 * 60 * 1000;
const MS_DAY = 24 * MS_HOUR;

/** Partner-Shipments.html — "Aug 6 · 10:16 PM" */
export function formatPartnerRedeemRequestedAt(requestedAt: string): string {
  const d = new Date(requestedAt);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date} · ${time}`;
}

/** Countdown for open shipments; em dash when not applicable. */
export function partnerRedeemDeadlineCountdown(
  requestedAt: string,
  isOpen: boolean,
  now = Date.now(),
): { text: string; warn: boolean } {
  if (!isOpen) return { text: "—", warn: false };
  const left = partnerRedeemDeadlineMs(requestedAt) - now;
  if (left <= 0) return { text: "—", warn: false };
  const days = Math.floor(left / MS_DAY);
  const hours = Math.floor((left % MS_DAY) / MS_HOUR);
  const text = days > 0 ? `${days}d ${hours}h left` : `${hours}h left`;
  return { text, warn: left <= MS_24H };
}
