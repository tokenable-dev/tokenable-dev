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

/** Atomic USDC string (6 decimals) → `1,234.56`. Invalid → em dash. */
export function formatUsdcAtomicAmount(amount: string): string {
  try {
    const n = Number(formatUnits(BigInt(amount.trim()), 6));
    if (!Number.isFinite(n)) return "—";
    return formatTradeTicketUsdcPrice(n);
  } catch {
    return "—";
  }
}

/** Admin micros (`bigint` string). Empty → em dash; bad input → original. */
export function formatUsdcMicrosAmount(
  micros: string | null | undefined,
  opts?: { dollar?: boolean },
): string {
  if (!micros) return "—";
  try {
    const n = Number(BigInt(micros)) / 1e6;
    if (!Number.isFinite(n)) return micros;
    const body = formatTradeTicketUsdcPrice(n);
    return opts?.dollar ? `$${body}` : body;
  } catch {
    return micros;
  }
}

export function priceUsdcFromOrder(o: Order): number {
  return Number(o.considerationAmount) / 1_000_000;
}
