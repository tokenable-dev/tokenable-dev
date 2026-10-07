import { isFedExTrackableCarrier } from './fedex-track.util';

/** Default days after carrier_delivered_at before auto confirm-received. */
export const REDEEM_AUTO_RECEIPT_GRACE_DAYS_DEFAULT = 3;

/**
 * Resolve grace delay from env-style strings.
 * `REDEEM_AUTO_RECEIPT_GRACE_SECONDS` wins when set (dev); else days.
 */
export function resolveRedeemAutoReceiptGraceMs(input: {
  graceSecondsRaw?: string | null;
  graceDaysRaw?: string | null;
}): number {
  const secRaw = input.graceSecondsRaw?.trim();
  if (secRaw) {
    const sec = Number(secRaw);
    if (Number.isFinite(sec) && sec >= 0) {
      return Math.floor(sec) * 1000;
    }
  }
  const daysRaw = Number(
    input.graceDaysRaw ?? String(REDEEM_AUTO_RECEIPT_GRACE_DAYS_DEFAULT),
  );
  const days =
    Number.isFinite(daysRaw) && daysRaw >= 0
      ? Math.floor(daysRaw)
      : REDEEM_AUTO_RECEIPT_GRACE_DAYS_DEFAULT;
  return days * 24 * 60 * 60 * 1000;
}

export type AutoReceiptRow = {
  status: string;
  refundStatus: string;
  trackingNumber: string | null;
  trackingCarrier: string | null;
  carrierDeliveredAt: Date | null;
};

/**
 * Batch auto-receipt gate used by RedeemDeliveryTrackService.
 * All rows must be FedEx-trackable and past grace since the latest delivery.
 */
export function batchReadyForAutoReceipt(input: {
  rows: AutoReceiptRow[];
  /** Grace after latest carrier_delivered_at (ms). Prefer REDEEM_AUTO_RECEIPT_GRACE_SECONDS in env. */
  graceMs: number;
  now?: Date;
}): { ok: boolean; reason?: string } {
  const { rows, graceMs } = input;
  const now = input.now ?? new Date();
  if (rows.length === 0) return { ok: false, reason: 'empty' };
  if (rows.every((r) => r.status === 'completed')) {
    return { ok: false, reason: 'already_completed' };
  }
  if (rows.some((r) => r.refundStatus !== 'none' || r.status === 'refunded')) {
    return { ok: false, reason: 'refunded' };
  }
  const eligible = new Set([
    'in_custody',
    'burned',
    'vault_release_pending',
    'completed',
  ]);
  if (rows.some((r) => !eligible.has(r.status))) {
    return { ok: false, reason: 'bad_status' };
  }
  if (rows.some((r) => !r.trackingNumber?.trim())) {
    return { ok: false, reason: 'missing_tracking' };
  }
  if (rows.some((r) => !isFedExTrackableCarrier(r.trackingCarrier))) {
    return { ok: false, reason: 'non_fedex' };
  }
  if (rows.some((r) => !r.carrierDeliveredAt)) {
    return { ok: false, reason: 'not_all_delivered' };
  }
  const latest = Math.max(...rows.map((r) => r.carrierDeliveredAt!.getTime()));
  const dueAt = latest + graceMs;
  if (now.getTime() < dueAt) return { ok: false, reason: 'grace_pending' };
  return { ok: true };
}
