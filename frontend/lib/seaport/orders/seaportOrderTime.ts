import type { PublicClient } from "viem";
import type { Order } from "@/lib/core";

/**
 * Seaport `_verifyTime`: active iff `startTime <= now && now < endTime` (strict end).
 * New EIP-712 orders should set `startTime` from {@link getChainTimestampSec}, not `Date.now()/1000`,
 * so the order is never “starts in the future” vs the next `matchAdvancedOrders` block.
 */
export function readOrderStartEndSec(o: Order): { start: bigint; end: bigint } {
  const st = o.parameters?.startTime;
  const et = o.parameters?.endTime;
  return {
    start: BigInt(String(st ?? "0").trim() || "0"),
    end: BigInt(String(et ?? "0").trim() || "0"),
  };
}

export function isSeaportOrderActiveAt(o: Order, chainNowSec: bigint): boolean {
  const { start, end } = readOrderStartEndSec(o);
  return start <= chainNowSec && chainNowSec < end;
}

const timestampCache = new WeakMap<PublicClient, { at: number; ts: bigint }>();

export async function getChainTimestampSec(
  publicClient: PublicClient,
): Promise<bigint> {
  const cached = timestampCache.get(publicClient);
  if (cached && Date.now() - cached.at < 2_000) return cached.ts;
  const b = await publicClient.getBlock({ blockTag: "latest" });
  timestampCache.set(publicClient, { at: Date.now(), ts: b.timestamp });
  return b.timestamp;
}

/** Human-readable reason when `isSeaportOrderActiveAt` is false. */
export function explainSeaportOrderInactive(
  o: Order,
  chainNowSec: bigint,
  kind: "bid" | "listing",
): string {
  const { start, end } = readOrderStartEndSec(o);
  const label = kind === "bid" ? "Collection bid" : "Listing";
  if (chainNowSec < start) {
    return (
      `${label} is not active yet: chain time ${chainNowSec} is before startTime ${start}. ` +
      `This usually means startTime was set from a wall clock ahead of the chain block time. ` +
      (kind === "listing"
        ? "Use Replace listing or list again (the app anchors start time to the chain)."
        : "Cancel this bid and place it again.")
    );
  }
  if (chainNowSec >= end) {
    return (
      `${label} has expired: chain time ${chainNowSec} is at or after endTime ${end}. ` +
      (kind === "listing"
        ? "Re-list or replace the listing."
        : "Cancel the bid and place a new one.")
    );
  }
  return `${label} time window could not be validated (start ${start}, end ${end}, chain ${chainNowSec}).`;
}
