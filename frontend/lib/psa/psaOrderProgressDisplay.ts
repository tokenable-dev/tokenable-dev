/** PSA Swagger `OrderProgress` — fields may be omitted upstream. */
export type PsaOrderProgressBody = {
  orderNumber?: string;
  problemOrder?: boolean;
  readyForLabelReview?: boolean;
  gradesReady?: boolean;
  accountingHold?: boolean;
  shipped?: boolean;
  shipTrackingNumber?: string;
  shipCarrier?: string;
  orderProgressSteps?: Array<{
    index?: number;
    step?: number;
    completed?: boolean;
  }>;
};

export type PsaOrderProgressLookupResponse = {
  status: "success" | "error" | "disabled" | "skipped";
  referenceNumber?: string;
  psaPath?: string;
  raw?: unknown;
  reason?: string;
  message?: string;
  httpStatus?: number;
};

/** PSA Swagger enum 0–8 — labels are approximate (upstream does not document names). */
const STEP_LABELS: Record<number, string> = {
  0: "Step 0",
  1: "Step 1",
  2: "Step 2",
  3: "Step 3",
  4: "Step 4",
  5: "Step 5",
  6: "Step 6",
  7: "Step 7",
  8: "Step 8",
};

export function parseOrderProgressBody(raw: unknown): PsaOrderProgressBody | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as PsaOrderProgressBody;
}

export function orderProgressStepLabel(step: number | undefined): string {
  if (step == null || Number.isNaN(step)) return "Unknown";
  return STEP_LABELS[step] ?? `Step ${step}`;
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
    return `https://www.dhl.com/global-en/home/tracking.html?tracking-id=${encodeURIComponent(num)}`;
  }
  return null;
}

export function formatBoolFlag(value: boolean | undefined, yes = "Yes", no = "No"): string {
  if (value === true) return yes;
  if (value === false) return no;
  return "—";
}
