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
