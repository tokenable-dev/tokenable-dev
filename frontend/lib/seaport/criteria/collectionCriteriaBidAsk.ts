import { formatUnits } from "viem";
import type { Order } from "@/lib/core";

export function isListingAskRow(o: Order): boolean {
  const s = String(o.side ?? "ask").toLowerCase();
  return s !== "bid";
}

export function askPriceMicros(o: Order): bigint {
  try {
    const raw = o.considerationAmount;
    const s = typeof raw === "bigint" ? String(raw) : String(raw ?? "").trim();
    if (!s) return BigInt(0);
    return BigInt(s);
  } catch {
    return BigInt(0);
  }
}

export function pickLowestActiveAsk(activeAsks: Order[]): Order | null {
  const cands = activeAsks.filter((o) => o.status === "active" && isListingAskRow(o));
  if (cands.length === 0) return null;
  cands.sort((a, b) => {
    const pa = askPriceMicros(a);
    const pb = askPriceMicros(b);
    if (pa !== pb) return pa < pb ? -1 : 1;
    return Number(a.tokenId) - Number(b.tokenId);
  });
  return cands[0];
}

export function pickLowestActiveAskCandidates(activeAsks: Order[]): Order[] {
  const cands = activeAsks.filter((o) => o.status === "active" && isListingAskRow(o));
  if (cands.length === 0) return [];
  cands.sort((a, b) => {
    const pa = askPriceMicros(a);
    const pb = askPriceMicros(b);
    if (pa !== pb) return pa < pb ? -1 : 1;
    return Number(a.tokenId) - Number(b.tokenId);
  });
  const floor = askPriceMicros(cands[0]!);
  return cands.filter((o) => askPriceMicros(o) === floor);
}

export function formatCriteriaBidUsdc6(amountStr: string): string {
  try {
    const n = Number(formatUnits(BigInt(amountStr), 6));
    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch {
    return amountStr;
  }
}
