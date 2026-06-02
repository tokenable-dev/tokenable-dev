import { formatUnits } from "viem";
import type { Order } from "@/lib/core";

export function formatOrderUsdc6(amountStr: string): string {
  try {
    const n = Number(formatUnits(BigInt(amountStr), 6));
    return n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return amountStr;
  }
}

export function bidMaxUsdcFromOrder(o: Order): string {
  try {
    const offer0 = o.parameters?.offer?.[0];
    if (offer0?.startAmount) return formatOrderUsdc6(String(offer0.startAmount));
  } catch {
    /* */
  }
  return formatOrderUsdc6(o.considerationAmount);
}

export function formatTradeTicketUsdcPrice(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function priceUsdcFromOrder(o: Order): number {
  return Number(o.considerationAmount) / 1_000_000;
}
