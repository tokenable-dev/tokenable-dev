import type { PublicClient, Address } from "viem";
import { formatUnits } from "viem";
import type { Order } from "@/lib/api";
import { getMarketplaceCollectionDetail } from "@/lib/api";
import { bidUsdcAmount } from "@/lib/seaport/bidUsdc";
import {
  bidMerkleRootMatchesCollection,
  fetchMerkleSnapshotForMatch,
} from "@/lib/seaport/collectionCriteriaRoot";
import { isCriteriaCollectionBid } from "@/lib/seaport/criteriaMatch";
import {
  runCriteriaMatch,
  mapMatchError,
  type MatchWriteContractAsync,
} from "@/lib/seaport/runCriteriaMatch";
import { normalizeDecimalTokenId } from "@/lib/normalizeTokenId";
import {
  getChainTimestampSec,
  isSeaportOrderActiveAt,
} from "@/lib/seaport/seaportOrderTime";

function orderCollectionKey(o: Order): string {
  const any = o as Order & { collection_key?: string };
  const k = o.collectionKey ?? any.collection_key;
  return k != null ? String(k).trim() : "";
}

function isListingAskRow(o: Order): boolean {
  return String(o.side ?? "ask").toLowerCase() !== "bid";
}

function askPriceMicros(o: Order): bigint {
  try {
    return BigInt(String(o.considerationAmount ?? "0").trim() || "0");
  } catch {
    return BigInt(0);
  }
}

export type TryMatchCriteriaBidAgainstBookResult =
  | { matched: true; fillUsdc: number }
  | { matched: false; hint?: string };

/**
 * After a new collection criteria bid is saved, attempt `matchAdvancedOrders` against any
 * active listing in the same bucket with ask price ≤ bid (symmetric to list-then-match).
 */
function mergeListingsByOrderHash(api: Order[], hints: Order[]): Order[] {
  const m = new Map<string, Order>();
  for (const o of api) {
    if (o?.orderHash) m.set(o.orderHash, o);
  }
  for (const o of hints) {
    if (o?.orderHash && !m.has(o.orderHash)) m.set(o.orderHash, o);
  }
  return [...m.values()];
}

export async function tryMatchCriteriaBidAgainstBook(params: {
  bid: Order;
  collectionKey: string;
  address: Address;
  publicClient: PublicClient;
  writeContractAsync: MatchWriteContractAsync;
  /** Order-book asks from UI — merged when collection detail is stale right after a new listing. */
  listingHints?: Order[];
}): Promise<TryMatchCriteriaBidAgainstBookResult> {
  const { bid, collectionKey, address, publicClient, writeContractAsync, listingHints } =
    params;
  const key = collectionKey.trim();
  if (!key || !isCriteriaCollectionBid(bid)) {
    return { matched: false };
  }

  const bidOffer = bidUsdcAmount(bid);
  const hints = listingHints ?? [];

  let listings: Order[] = [];
  for (let attempt = 0; attempt < 12; attempt++) {
    const detail = await getMarketplaceCollectionDetail(key, {
      bypassCache: true,
    }).catch(() => null);
    const fromApi = detail?.listings ?? [];
    listings = mergeListingsByOrderHash(fromApi, hints);

    if (listings.length > 0) {
      const hasCrossing = listings.some(
        (a) =>
          a.status === "active" &&
          isListingAskRow(a) &&
          (!orderCollectionKey(a) || orderCollectionKey(a).toLowerCase() === key.toLowerCase()) &&
          bidOffer >= askPriceMicros(a),
      );
      if (hasCrossing) break;
    }

    if (attempt < 11) {
      await new Promise((r) => setTimeout(r, 120 + attempt * 35));
    }
  }

  const asks = listings.filter((a) => {
    if (a.status !== "active" || !isListingAskRow(a)) return false;
    const ck = orderCollectionKey(a);
    if (ck && ck.toLowerCase() !== key.toLowerCase()) return false;
    return bidOffer >= askPriceMicros(a);
  });

  if (asks.length === 0) {
    return { matched: false };
  }

  asks.sort((a, b) => {
    const pa = askPriceMicros(a);
    const pb = askPriceMicros(b);
    if (pa !== pb) return pa < pb ? -1 : pa > pb ? 1 : 0;
    return Number(a.tokenId) - Number(b.tokenId);
  });

  const merkleSnap = await fetchMerkleSnapshotForMatch(key, {
    maxAttempts: 14,
    delayMs: 200,
    bypassMerkleCache: true,
  });

  if (!merkleSnap?.tokenIds.length) {
    return {
      matched: false,
      hint: "Could not load the collection Merkle set. Try again in a few seconds.",
    };
  }

  const merkleTokenIds = merkleSnap.tokenIds;
  const currentRoot = merkleSnap.rootHex;

  if (!bidMerkleRootMatchesCollection(bid, currentRoot)) {
    return {
      matched: false,
      hint:
        "This bid’s Merkle root doesn’t match the current pool. Cancel the bid, re-place it, then matching can run.",
    };
  }

  const chainNow = await getChainTimestampSec(publicClient);

  let lastErr = "";
  for (const listing of asks) {
    if (!isSeaportOrderActiveAt(listing, chainNow)) {
      continue;
    }
    const tidBn = BigInt(normalizeDecimalTokenId(listing.tokenId));
    const ids = merkleTokenIds.map((x) => BigInt(normalizeDecimalTokenId(x)));
    if (!ids.some((id) => id === tidBn)) {
      continue;
    }
    try {
      await runCriteriaMatch({
        address,
        publicClient,
        writeContractAsync,
        bid,
        listing,
        tokenId: listing.tokenId,
        collectionKey: key,
        merkleTokenIds,
      });
      const micros = askPriceMicros(listing);
      const fillUsdc = Number(formatUnits(micros, 6));
      return {
        matched: true,
        fillUsdc: Number.isFinite(fillUsdc) && fillUsdc > 0 ? fillUsdc : Number(formatUnits(bidOffer, 6)),
      };
    } catch (e: unknown) {
      lastErr = mapMatchError(e, { bidOfferer: bid.offerer });
    }
  }

  return {
    matched: false,
    hint: lastErr || "No listing could be matched against this bid automatically.",
  };
}
