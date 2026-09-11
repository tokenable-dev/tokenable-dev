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

export { buildCarrierTrackingUrl } from "@/lib/shipping/carrierTracking";

export function formatBoolFlag(value: boolean | undefined, yes = "Yes", no = "No"): string {
  if (value === true) return yes;
  if (value === false) return no;
  return "—";
}
