import type { Order } from "@/lib/api";

/** USDC amount in offer[0] for collection bids (6 decimals). */
export function bidUsdcAmount(o: Order): bigint {
  try {
    const offer0 = o.parameters?.offer?.[0];
    if (offer0?.startAmount) return BigInt(offer0.startAmount);
  } catch {
    /* fall through */
  }
  return BigInt(o.considerationAmount);
}

/**
 * Gross list price for an ask: sum of ERC20 consideration items (seller + fee), matching backend validation.
 * Prefer over `considerationAmount` alone when comparing to a bid’s gross offer.
 */
export function askGrossUsdcMicros(o: Order): bigint {
  try {
    const cons = o.parameters?.consideration ?? [];
    let sum = BigInt(0);
    for (const c of cons) {
      if (Number(c.itemType) === 1 && c.startAmount) {
        sum += BigInt(String(c.startAmount).trim());
      }
    }
    if (sum > BigInt(0)) return sum;
  } catch {
    /* fall through */
  }
  try {
    return BigInt(String(o.considerationAmount ?? "0").trim() || "0");
  } catch {
    return BigInt(0);
  }
}
