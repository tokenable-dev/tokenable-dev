/** Shared collector + partner carrier labels / track URLs (Partner-Shipments.html). */

export function formatCarrierLabel(carrier?: string | null): string | null {
  const raw = carrier?.trim();
  if (!raw) return null;
  const c = raw.toLowerCase();
  if (c.includes("fedex")) return "FedEx";
  if (c.includes("ups")) return "UPS";
  if (c.includes("dhl")) return "DHL";
  if (c.includes("usps")) return "USPS";
  return raw;
}

export function buildCarrierTrackingUrl(
  carrier: string | undefined,
  trackingNumber: string | undefined,
): string | null {
  const num = trackingNumber?.trim();
  if (!num) return null;
  const c = carrier?.trim().toLowerCase() ?? "";
  if (c.includes("ups")) {
    return `https://www.ups.com/track?tracknum=${encodeURIComponent(num)}`;
  }
  if (c.includes("fedex")) {
    return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(num)}`;
  }
  if (c.includes("usps")) {
    return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(num)}`;
  }
  if (c.includes("dhl")) {
    return `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(num)}`;
  }
  return null;
}
