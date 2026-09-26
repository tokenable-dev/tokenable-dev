/**
 * Pure helpers for FedEx Track API (`POST /track/v1/trackingnumbers`) payloads.
 * Detect Delivered via ACTUAL_DELIVERY date or status code DL.
 */

export type FedExTrackPackageResult = {
  trackingNumber: string;
  delivered: boolean;
  deliveredAt: Date | null;
  statusCode: string | null;
  statusDescription: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

type LooseRecord = Record<string, unknown>;

function asRecord(v: unknown): LooseRecord | null {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as LooseRecord)
    : null;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t || null;
}

function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  // FedEx may return date-only (YYYY-MM-DD) or ISO datetime.
  const d = new Date(raw.length === 10 ? `${raw}T12:00:00Z` : raw);
  return Number.isFinite(d.getTime()) ? d : null;
}

function isDeliveredStatus(code: string | null, description: string | null): boolean {
  const c = (code ?? '').toUpperCase();
  if (c === 'DL') return true;
  const desc = (description ?? '').toLowerCase();
  return /\bdelivered\b/.test(desc) || desc.includes('배송했습니다') || desc.includes('배달 완료');
}

/**
 * Extract delivery info from one `trackResults[]` element.
 */
export function parseFedExTrackResult(
  trackingNumber: string,
  trackResult: unknown,
): FedExTrackPackageResult {
  const root = asRecord(trackResult);
  if (!root) {
    return {
      trackingNumber,
      delivered: false,
      deliveredAt: null,
      statusCode: null,
      statusDescription: null,
      errorCode: 'EMPTY_RESULT',
      errorMessage: 'Empty track result',
    };
  }

  const err = asRecord(root.error);
  const errorCode = str(err?.code);
  const errorMessage = str(err?.message);

  const latest = asRecord(root.latestStatusDetail);
  const statusCode =
    str(latest?.derivedCode) ?? str(latest?.code);
  const statusDescription =
    str(latest?.statusByLocale) ?? str(latest?.description);

  let deliveredAt: Date | null = null;
  for (const entry of asArray(root.dateAndTimes)) {
    const row = asRecord(entry);
    if (!row) continue;
    if (str(row.type)?.toUpperCase() === 'ACTUAL_DELIVERY') {
      deliveredAt = parseDate(str(row.dateTime));
      break;
    }
  }

  const delivered =
    Boolean(deliveredAt) || isDeliveredStatus(statusCode, statusDescription);

  if (delivered && !deliveredAt) {
    // Status says delivered but no ACTUAL_DELIVERY — use now as conservative stamp.
    deliveredAt = new Date();
  }

  return {
    trackingNumber,
    delivered,
    deliveredAt: delivered ? deliveredAt : null,
    statusCode,
    statusDescription,
    errorCode,
    errorMessage,
  };
}

/**
 * Flatten FedEx Track success body into per-tracking-number results.
 */
export function parseFedExTrackResponse(body: unknown): FedExTrackPackageResult[] {
  const root = asRecord(body);
  const output = asRecord(root?.output);
  const complete = asArray(output?.completeTrackResults);
  const out: FedExTrackPackageResult[] = [];

  for (const block of complete) {
    const b = asRecord(block);
    if (!b) continue;
    const trackingNumber = str(b.trackingNumber) ?? '';
    const trackResults = asArray(b.trackResults);
    if (trackResults.length === 0) {
      out.push({
        trackingNumber,
        delivered: false,
        deliveredAt: null,
        statusCode: null,
        statusDescription: null,
        errorCode: 'NO_TRACK_RESULTS',
        errorMessage: 'No trackResults in response',
      });
      continue;
    }
    // Prefer the first result; FedEx returns one primary when tracking a number.
    out.push(parseFedExTrackResult(trackingNumber, trackResults[0]));
  }

  return out;
}

/** Carriers we can resolve via FedEx Track (null/empty treated as FedEx). */
export function isFedExTrackableCarrier(carrier: string | null | undefined): boolean {
  const c = (carrier ?? '').trim().toLowerCase();
  return c === '' || c === 'fedex';
}

/**
 * Dev/sandbox dummy numbers (e.g. 111111111). FedEx Track does not return
 * Delivered for these — sandbox poll may treat them as delivered so auto-receipt
 * can run without a live shipment.
 */
export function isSandboxOnesTrackingNumber(trackingNumber: string): boolean {
  const key = trackingNumber.replace(/\s+/g, '');
  return /^1{6,15}$/.test(key);
}
