import type { QueryClient } from "@tanstack/react-query";
import { formatUnits, type Address, type PublicClient } from "viem";
import { cancelOrder, getMarketplaceCollectionDetail, getOrderByHash, rq, type Order } from "@/lib/core";
import {
  invalidateAfterListing,
  invalidateForMatchRetry,
} from "@/lib/core/invalidation";
import {
  applyInstantOnlyProtection,
  isAbortLikeError,
  matchFlowHttpSignal,
  mergeBidsByOrderHash,
  orderCollectionKey,
  orderMatchCandidates,
  resolveMatchCollectionKey,
} from "@/lib/seaport/listing/listRwaModalUtils";
import type {
  InstantMatchDecision,
  ListSuccessMeta,
} from "@/lib/seaport/listing/listRwaModalTypes";
import { askGrossUsdcMicros, bidUsdcAmount } from "@/lib/seaport/orders/bidUsdc";
import { isCriteriaCollectionBid } from "@/lib/seaport/criteria/criteriaMatch";
import {
  bidMerkleRootMatchesCollection,
  fetchMerkleSnapshotForMatch,
} from "@/lib/seaport/criteria/collectionCriteriaRoot";
import {
  runCriteriaMatch,
  runTokenBidMatch,
  classifyMatchFailureCode,
  mapMatchError,
  type MatchFailureCode,
  type MatchWriteContractAsync,
} from "@/lib/seaport/fulfillment/runCriteriaMatch";
import { isTokenBidOrder } from "@/lib/seaport/orders/isTokenBidOrder";
import { normalizeDecimalTokenId } from "@/lib/marketplace";
import {
  getChainTimestampSec,
  isSeaportOrderActiveAt,
} from "@/lib/seaport/orders/seaportOrderTime";
import { submitAskListingOrder } from "@/lib/seaport/orders/submitAskListing";
import type { SupportedChainId } from "@/lib/chains";
import type { SignSeaportOrderFn } from "@/lib/seaport/signSeaportOrder";

export type ListRwaInstantMatchDeps = {
  tokenId: number;
  address: Address | undefined;
  publicClient: PublicClient | undefined;
  collectionKey?: string | null;
  collectionBids?: Order[];
  preferredBidForMatch: string | null;
  topCollectionBid: { micros: bigint } | null;
  resolvedExistingAsk: Order | null;
  getSignSeaportOrder: () => SignSeaportOrderFn | null;
  writeContractAsync: MatchWriteContractAsync;
  queryClient: QueryClient;
  chainId: SupportedChainId;
};

async function resolveCollectionKeyForMatch(
  deps: ListRwaInstantMatchDeps,
  created: Order,
): Promise<string | undefined> {
  let key = resolveMatchCollectionKey(
    created,
    deps.collectionKey,
    deps.resolvedExistingAsk,
    deps.collectionBids,
  );
  if (!key && created.orderHash) {
    try {
      const refreshed = await getOrderByHash(created.orderHash, {
        signal: matchFlowHttpSignal(),
      });
      key = resolveMatchCollectionKey(
        refreshed,
        deps.collectionKey,
        deps.resolvedExistingAsk,
        deps.collectionBids,
      );
    } catch {
      /* keep */
    }
  }
  if (!key && deps.collectionKey != null && String(deps.collectionKey).trim() !== "") {
    key = String(deps.collectionKey).trim();
  }
  return key;
}

async function tryMatchAfterListing(
  deps: ListRwaInstantMatchDeps,
  created: Order,
): Promise<ListSuccessMeta> {
  const key = await resolveCollectionKeyForMatch(deps, created);
  if (!key || !deps.address || !deps.publicClient) {
    return { matched: false };
  }

  const propBids = deps.collectionBids ?? [];
  const askAm = askGrossUsdcMicros(created);
  const matchWrite = deps.writeContractAsync;
  const tokenIdNorm = normalizeDecimalTokenId(deps.tokenId);

  const isCrossingTokenBid = (b: Order) => {
    if (b.status !== "active" || !isTokenBidOrder(b)) return false;
    if (normalizeDecimalTokenId(b.tokenId) !== tokenIdNorm) return false;
    return bidUsdcAmount(b) >= askAm;
  };

  const isCrossingCriteriaBid = (b: Order) => {
    if (b.status !== "active" || !isCriteriaCollectionBid(b)) return false;
    const bk = orderCollectionKey(b);
    if (bk && bk.toLowerCase() !== key.toLowerCase()) return false;
    return bidUsdcAmount(b) >= askAm;
  };

  const bidCrossesAsk = (rows: Order[]) =>
    rows.some((b) => isCrossingTokenBid(b) || isCrossingCriteriaBid(b));

  const hotPath =
    bidCrossesAsk(propBids) ||
    (deps.topCollectionBid != null && deps.topCollectionBid.micros >= askAm);

  const maxMatchRounds = 3;
  let lastMeta: ListSuccessMeta = { matched: false, reasonCode: "unknown" };

  for (let round = 0; round < maxMatchRounds; round++) {
    if (round > 0) {
      await new Promise((r) => setTimeout(r, 200 * round));
      await invalidateForMatchRetry(deps.queryClient, key);
    }

    let bids: Order[] = [];
    const detailAttempts = hotPath ? 8 : 12;
    for (let attempt = 0; attempt < detailAttempts; attempt++) {
      let detail: Awaited<ReturnType<typeof getMarketplaceCollectionDetail>> | null = null;
      try {
        detail = await getMarketplaceCollectionDetail(key, {
          bypassCache: true,
          signal: matchFlowHttpSignal(),
        });
      } catch (e) {
        if (isAbortLikeError(e)) {
          detail = null;
        } else {
          throw e;
        }
      }
      const fromApi = detail?.collectionBids ?? [];
      bids = mergeBidsByOrderHash(fromApi, propBids);

      if (bids.length > 0 && bidCrossesAsk(bids)) break;

      if (attempt < detailAttempts - 1) {
        const gapMs = hotPath ? 55 + attempt * 22 : 120 + attempt * 35;
        await new Promise((r) => setTimeout(r, gapMs));
      }
    }

    if (!bids.length) {
      lastMeta = { matched: false, reasonCode: "unknown" };
      continue;
    }

    // Prefer card-level token offers (FIFO within price) over legacy criteria bids.
    const tokenCandidates = orderMatchCandidates(
      bids.filter(isCrossingTokenBid),
      deps.preferredBidForMatch,
    );

    if (tokenCandidates.length > 0) {
      let lastErr = "";
      let lastReason: MatchFailureCode = "unknown";
      let listing: Order = created;

      for (const bid of tokenCandidates) {
        try {
          const chainNow = await getChainTimestampSec(deps.publicClient);
          if (!isSeaportOrderActiveAt(listing, chainNow)) {
            const signOrder = deps.getSignSeaportOrder();
            if (!signOrder) {
              lastErr =
                "Wallet signer not ready — unlock your wallet, then try again so the listing can be refreshed.";
              continue;
            }
            listing = await submitAskListingOrder({
              tokenId: deps.tokenId,
              priceUsdc: formatUnits(askGrossUsdcMicros(listing), 6),
              address: deps.address,
              publicClient: deps.publicClient,
              signSeaportOrder: signOrder,
              writeContractAsync: deps.writeContractAsync as Parameters<
                typeof submitAskListingOrder
              >[0]["writeContractAsync"],
              chainId: deps.chainId,
              mode: "replace",
              oldOrderHash: listing.orderHash,
            });
          }
          if (askGrossUsdcMicros(listing) > bidUsdcAmount(bid)) {
            const signOrder = deps.getSignSeaportOrder();
            if (!signOrder) {
              lastErr =
                "Wallet signer not ready — unlock your wallet, then change the list price to the bid or try again.";
              continue;
            }
            listing = await submitAskListingOrder({
              tokenId: deps.tokenId,
              priceUsdc: formatUnits(bidUsdcAmount(bid), 6),
              address: deps.address,
              publicClient: deps.publicClient,
              signSeaportOrder: signOrder,
              writeContractAsync: deps.writeContractAsync as Parameters<
                typeof submitAskListingOrder
              >[0]["writeContractAsync"],
              chainId: deps.chainId,
              mode: "replace",
              oldOrderHash: listing.orderHash,
            });
          }

          await runTokenBidMatch({
            address: deps.address,
            publicClient: deps.publicClient,
            writeContractAsync: matchWrite,
            bid,
            listing,
            chainId: deps.chainId,
          });

          return { matched: true };
        } catch (e: unknown) {
          lastErr = mapMatchError(e, { bidOfferer: bid.offerer });
          lastReason = classifyMatchFailureCode(e);
        }
      }

      lastMeta = {
        matched: false,
        reasonCode: lastReason,
        hint: lastErr || "Could not fill a bid automatically.",
      };
      continue;
    }

    const merkleSnap = await fetchMerkleSnapshotForMatch(key, {
      expectTokenId: deps.tokenId,
      maxAttempts: hotPath ? 18 : 14,
      delayMs: hotPath ? 110 : 200,
      bypassMerkleCache: true,
    });

    if (!merkleSnap?.tokenIds.length) {
      lastMeta = {
        matched: false,
        reasonCode: "merkle_mismatch",
        hint:
          "Your listing is not in the collection Merkle set yet (indexing delay). Retrying… If this persists, open this collection again in a few seconds.",
      };
      continue;
    }

    const { tokenIds: merkleTokenIds, rootHex: currentRoot } = merkleSnap;

    const pricedBids = bids.filter(isCrossingCriteriaBid);

    if (pricedBids.length === 0) {
      lastMeta = {
        matched: false,
        reasonCode: undefined,
        hint: undefined,
      };
      break;
    }

    const merkleOk = pricedBids.filter((b) =>
      bidMerkleRootMatchesCollection(b, currentRoot),
    );
    const candidates = orderMatchCandidates(merkleOk, deps.preferredBidForMatch);

    if (candidates.length === 0) {
      lastMeta = {
        matched: false,
        reasonCode: "merkle_mismatch",
        hint:
          "No bid’s Merkle root matches the server’s current leaf set. The buyer must cancel and re-place their collection bid after pool updates, then list again (or use Match on the token page).",
      };
      continue;
    }

    let lastErr = "";
    let lastReason: MatchFailureCode = "unknown";
    let listing: Order = created;

    for (const bid of candidates) {
      try {
        const chainNow = await getChainTimestampSec(deps.publicClient);
        if (!isSeaportOrderActiveAt(listing, chainNow)) {
          const signOrder = deps.getSignSeaportOrder();
          if (!signOrder) {
            lastErr =
              "Wallet signer not ready — unlock your wallet, then try again so the listing can be refreshed.";
            continue;
          }
          listing = await submitAskListingOrder({
            tokenId: deps.tokenId,
            priceUsdc: formatUnits(askGrossUsdcMicros(listing), 6),
            address: deps.address,
            publicClient: deps.publicClient,
            signSeaportOrder: signOrder,
            writeContractAsync: deps.writeContractAsync as Parameters<
              typeof submitAskListingOrder
            >[0]["writeContractAsync"],
            chainId: deps.chainId,
            mode: "replace",
            oldOrderHash: listing.orderHash,
          });
        }
        if (askGrossUsdcMicros(listing) > bidUsdcAmount(bid)) {
          const signOrder = deps.getSignSeaportOrder();
          if (!signOrder) {
            lastErr =
              "Wallet signer not ready — unlock your wallet, then change the list price to the bid or try again.";
            continue;
          }
          listing = await submitAskListingOrder({
            tokenId: deps.tokenId,
            priceUsdc: formatUnits(bidUsdcAmount(bid), 6),
            address: deps.address,
            publicClient: deps.publicClient,
            signSeaportOrder: signOrder,
            writeContractAsync: deps.writeContractAsync as Parameters<
              typeof submitAskListingOrder
            >[0]["writeContractAsync"],
            chainId: deps.chainId,
            mode: "replace",
            oldOrderHash: listing.orderHash,
          });
        }

        await runCriteriaMatch({
          address: deps.address,
          publicClient: deps.publicClient,
          writeContractAsync: matchWrite,
          bid,
          listing,
          tokenId: deps.tokenId,
          collectionKey: key,
          merkleTokenIds,
          chainId: deps.chainId,
        });

        return { matched: true };
      } catch (e: unknown) {
        lastErr = mapMatchError(e, { bidOfferer: bid.offerer });
        lastReason = classifyMatchFailureCode(e);
      }
    }

    const merkleHint = lastErr.toLowerCase().includes("merkle")
      ? " If this persists, the buyer may need to cancel and re-place their collection bid for the updated listing set."
      : "";

    lastMeta = {
      matched: false,
      reasonCode: lastReason,
      hint: lastErr
        ? `${lastErr}${merkleHint}`
        : "Could not fill a collection bid automatically.",
    };
  }

  return lastMeta;
}

export async function tryMatchAfterListingWithTimeout(
  deps: ListRwaInstantMatchDeps,
  created: Order,
): Promise<ListSuccessMeta> {
  const timeoutMs = 90_000;
  return Promise.race([
    tryMatchAfterListing(deps, created),
    new Promise<ListSuccessMeta>((resolve) =>
      setTimeout(
        () =>
          resolve({
            matched: false,
            hint:
              "Automatic bid matching took too long (indexing) or is waiting on another wallet confirmation. Your listing is already saved — refresh this page or match from the collection order book.",
          }),
        timeoutMs,
      ),
    ),
  ]);
}

export async function shouldRunInstantMatchAfterList(
  deps: ListRwaInstantMatchDeps,
  created: Order,
): Promise<InstantMatchDecision> {
  const key = await resolveCollectionKeyForMatch(deps, created);
  if (!key || !deps.address || !deps.publicClient) {
    return { shouldRun: false, enforceImmediateFill: false };
  }
  const askAm = askGrossUsdcMicros(created);
  const propBids = deps.collectionBids ?? [];
  const crosses = (rows: Order[]) =>
    rows.some((b) => {
      if (b.status !== "active" || !isCriteriaCollectionBid(b)) return false;
      const bk = orderCollectionKey(b);
      if (bk && bk.toLowerCase() !== key.toLowerCase()) return false;
      return bidUsdcAmount(b) >= askAm;
    });
  const uiSaysCross =
    deps.topCollectionBid != null && deps.topCollectionBid.micros >= askAm;
  if (uiSaysCross || crosses(propBids)) {
    return { shouldRun: true, enforceImmediateFill: true };
  }
  let detail: Awaited<ReturnType<typeof getMarketplaceCollectionDetail>> | null = null;
  let timedOut = false;
  try {
    detail = await getMarketplaceCollectionDetail(key, {
      bypassCache: true,
      signal: matchFlowHttpSignal(),
    });
  } catch (e) {
    if (isAbortLikeError(e)) {
      timedOut = true;
    } else {
      throw e;
    }
  }
  const merged = mergeBidsByOrderHash(detail?.collectionBids ?? [], propBids);
  if (crosses(merged)) {
    return { shouldRun: true, enforceImmediateFill: true };
  }
  if (timedOut) {
    return { shouldRun: true, enforceImmediateFill: false };
  }
  return { shouldRun: false, enforceImmediateFill: false };
}

export async function cancelListingWithRetryAndVerify(
  deps: ListRwaInstantMatchDeps,
  orderHash: string,
): Promise<boolean> {
  const maxAttempts = 3;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await cancelOrder(orderHash, deps.address as string);
    } catch {
      /* retry */
    }
    try {
      const refreshed = await getOrderByHash(orderHash, {
        signal: matchFlowHttpSignal(),
      });
      if (String(refreshed.status).toLowerCase() !== "active") {
        return true;
      }
    } catch {
      /* retry */
    }
    if (i < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, 250 * (i + 1)));
    }
  }
  return false;
}

export async function invalidateListingQueries(
  deps: ListRwaInstantMatchDeps,
  created: Order,
): Promise<void> {
  const colKey =
    orderCollectionKey(created) ||
    (deps.collectionKey != null ? deps.collectionKey.trim() : "") ||
    orderCollectionKey(deps.resolvedExistingAsk);
  await invalidateAfterListing(deps.queryClient, {
    collectionKey: colKey || null,
    address: deps.address || null,
    tokenId: deps.tokenId,
  });
}

/** Shared post-list flow: optional instant match + instant-only protection. */
export async function runPostListInstantMatch(
  deps: ListRwaInstantMatchDeps,
  created: Order,
  hooks?: { onStartMatching?: () => void },
): Promise<ListSuccessMeta> {
  const instantDecision = await shouldRunInstantMatchAfterList(deps, created);
  if (!instantDecision.shouldRun) {
    return { matched: false };
  }
  hooks?.onStartMatching?.();
  const ck = deps.collectionKey?.trim();
  if (ck) {
    await invalidateForMatchRetry(deps.queryClient, ck);
  }
  let meta = await tryMatchAfterListingWithTimeout(deps, created);
  if (!meta.matched && instantDecision.enforceImmediateFill) {
    const cancelled = await cancelListingWithRetryAndVerify(deps, created.orderHash);
    meta = applyInstantOnlyProtection({
      ...meta,
      hint: cancelled
        ? "Instant-only protection cancelled this listing because immediate match failed. " +
          (meta.hint ?? "")
        : "Immediate match failed and auto-cancel could not be completed after retries. Listing may remain on order book. " +
          (meta.hint ?? ""),
    });
  }
  return meta;
}
