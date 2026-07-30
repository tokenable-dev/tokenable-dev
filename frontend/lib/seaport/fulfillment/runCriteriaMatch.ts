import type { Abi, PublicClient, Address } from "viem";
import { formatUnits } from "viem";
import { getChainContracts, type SupportedChainId } from "@/lib/chains";
import {
  SEAPORT_ADDRESS,
  SEAPORT_ABI_WITH_MATCH_ADVANCED,
  USDC_ABI,
} from "@/constants/contracts";
import { fulfillMatchedPairApi, getMerkleEligibleTokenIds, type Order } from "@/lib/core";
import { canonicalBytes32Hex } from "../criteria/collectionCriteriaRoot";
import { buildCriteriaMatchExecution, buildTokenBidMatchExecution, isCriteriaCollectionBid } from "../criteria/criteriaMatch";
import { isTokenBidOrder } from "../orders/isTokenBidOrder";
import { matchAdvancedOrdersArgs } from "../criteria/matchAdvancedOrdersArgs";
import { SeaportMerkleTree } from "../merkle";
import { GAS_FALLBACK, gasWithCapFast, mapWalletError } from "@/lib/network";
import { normalizeDecimalTokenId } from "@/lib/marketplace";
import {
  explainSeaportOrderInactive,
  getChainTimestampSec,
  isSeaportOrderActiveAt,
} from "../orders/seaportOrderTime";

export type MatchWriteContractAsync = (args: {
  address: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
  chainId: number;
  gas: bigint;
}) => Promise<`0x${string}`>;

export type MatchFailureCode =
  | "insufficient_balance"
  | "insufficient_allowance"
  | "merkle_mismatch"
  | "expired_or_inactive"
  | "timeout"
  | "unknown";

/** ERC20 offer item in Seaport order parameters. */
const ITEM_ERC20 = 1;

export type BuyerUsdcReadyResult =
  | { ok: true }
  | {
      ok: false;
      code: "balance" | "allowance";
      message: string;
    };

/**
 * Criteria / token bids do not escrow USDC — at match/fulfill time Seaport
 * transfers from the buyer (`offerer`). Returns a structured result for UI preflight.
 */
export async function checkBuyerUsdcReadyForBid(
  publicClient: PublicClient,
  bid: Order,
  usdcAddress: Address,
): Promise<BuyerUsdcReadyResult> {
  const offer0 = bid.parameters?.offer?.[0];
  if (!offer0 || Number(offer0.itemType) !== ITEM_ERC20) return { ok: true };
  if (
    String(offer0.token).toLowerCase() !== String(usdcAddress).toLowerCase()
  ) {
    return { ok: true };
  }
  const buyer = bid.offerer as Address;
  let needed: bigint;
  try {
    needed = BigInt(String(offer0.startAmount).trim());
  } catch {
    return { ok: true };
  }
  if (needed <= BigInt(0)) return { ok: true };

  const [bal, allowance] = await Promise.all([
    publicClient.readContract({
      address: usdcAddress,
      abi: USDC_ABI,
      functionName: "balanceOf",
      args: [buyer],
    }),
    publicClient.readContract({
      address: usdcAddress,
      abi: USDC_ABI,
      functionName: "allowance",
      args: [buyer, SEAPORT_ADDRESS],
    }),
  ]);

  if ((bal as bigint) < needed) {
    return {
      ok: false,
      code: "balance",
      message:
        `Buyer USDC insufficient: ${buyer} has ${formatUnits(bal as bigint, 6)} USDC but this offer requires ${formatUnits(needed, 6)} USDC. ` +
        `Offers do not lock USDC — the buyer must still hold the funds when you accept.`,
    };
  }
  if ((allowance as bigint) < needed) {
    return {
      ok: false,
      code: "allowance",
      message:
        `Buyer USDC allowance too low for Seaport: ${buyer} must approve at least ${formatUnits(needed, 6)} USDC for Seaport.`,
    };
  }
  return { ok: true };
}

/**
 * Fail early with a clear message when the buyer cannot fund the bid.
 */
export async function assertBuyerUsdcReadyForCriteriaBid(
  publicClient: PublicClient,
  bid: Order,
  usdcAddress: Address,
): Promise<void> {
  const ready = await checkBuyerUsdcReadyForBid(publicClient, bid, usdcAddress);
  if (!ready.ok) throw new Error(ready.message);
}

export async function runCriteriaMatch(params: {
  address: Address;
  publicClient: PublicClient;
  writeContractAsync: MatchWriteContractAsync;
  bid: Order;
  listing: Order;
  tokenId: string | number;
  collectionKey: string;
  /**
   * When the caller already fetched a fresh merkle set (e.g. list-then-match), pass it here so
   * proof/root match that snapshot. Otherwise we bypass server cache to avoid stale sets vs bids.
   */
  merkleTokenIds?: string[];
  chainId: SupportedChainId;
}): Promise<void> {
  const {
    address,
    publicClient,
    writeContractAsync,
    bid,
    listing,
    tokenId,
    collectionKey,
    merkleTokenIds: merkleTokenIdsParam,
    chainId,
  } = params;

  const { usdcAddress } = getChainContracts(chainId);

  if (!isCriteriaCollectionBid(bid)) {
    throw new Error("Not a criteria collection bid");
  }

  const tidBn = BigInt(normalizeDecimalTokenId(tokenId));

  const tokenIds =
    merkleTokenIdsParam ??
    (await getMerkleEligibleTokenIds(collectionKey, { bypassCache: true })).tokenIds;
  const ids = tokenIds.map((x) => BigInt(normalizeDecimalTokenId(x)));
  if (ids.length === 0) {
    throw new Error("Merkle set is empty.");
  }
  if (!ids.some((id) => id === tidBn)) {
    throw new Error("This token ID is not in the current Merkle leaf set.");
  }

  const tree = new SeaportMerkleTree(ids);
  const currentRoot = tree.getHexRoot();
  const bidRoot = bid.parameters?.consideration?.[0]?.identifierOrCriteria;
  const bidCanon = canonicalBytes32Hex(bidRoot);
  const curCanon = canonicalBytes32Hex(currentRoot);
  if (!bidCanon || !curCanon) {
    throw new Error("Invalid bid: missing or malformed Merkle root.");
  }
  if (bidCanon !== curCanon) {
    throw new Error(
      "This bid’s Merkle root does not match the current listing set. The buyer should cancel and place a new collection bid."
    );
  }

  const chainNow = await getChainTimestampSec(publicClient);
  if (!isSeaportOrderActiveAt(bid, chainNow)) {
    throw new Error(explainSeaportOrderInactive(bid, chainNow, "bid"));
  }
  if (!isSeaportOrderActiveAt(listing, chainNow)) {
    throw new Error(explainSeaportOrderInactive(listing, chainNow, "listing"));
  }

  const proof = tree.getCriteriaProof(tidBn);

  await assertBuyerUsdcReadyForCriteriaBid(publicClient, bid, usdcAddress);

  const exec = buildCriteriaMatchExecution({
    criteriaBidOrder: bid,
    listingOrder: listing,
    tokenId: tidBn,
    criteriaProof: proof,
  });
  const prepared = matchAdvancedOrdersArgs({
    orders: exec.orders,
    criteriaResolvers: exec.criteriaResolvers,
    fulfillments: exec.fulfillments,
    recipient: exec.recipient,
  });

  const gasPromise = gasWithCapFast(
    publicClient,
    {
      address: SEAPORT_ADDRESS,
      abi: prepared.abi,
      functionName: prepared.functionName,
      args: prepared.args,
      account: address,
    },
    GAS_FALLBACK.matchAdvancedOrders,
  );

  const SIMULATION_MS = 55_000;
  const [, gas] = await Promise.race([
    Promise.all([
      publicClient.simulateContract({
        address: SEAPORT_ADDRESS,
        abi: SEAPORT_ABI_WITH_MATCH_ADVANCED,
        functionName: "matchAdvancedOrders",
        args: prepared.args as readonly [unknown, unknown, unknown, unknown],
        account: address,
      }),
      gasPromise,
    ]),
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              "Simulation timed out (RPC slow or overloaded). Try again in a moment.",
            ),
          ),
        SIMULATION_MS,
      ),
    ),
  ]);

  const hash = await writeContractAsync({
    address: SEAPORT_ADDRESS,
    abi: prepared.abi as Abi,
    functionName: prepared.functionName,
    args: prepared.args as readonly unknown[],
    chainId,
    gas,
  });

  const receipt = await Promise.race([
    publicClient.waitForTransactionReceipt({ hash }),
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              "Match transaction confirmation timed out. Check the explorer for this tx or try again.",
            ),
          ),
        120_000,
      ),
    ),
  ]);
  if (receipt.status === "reverted") {
    throw new Error(
      `Seaport match reverted on-chain (tx ${hash}). Simulation may differ from execution; check the buyer’s USDC balance and approval to Seaport.`,
    );
  }

  /** Listing modal must not hang if the indexer/API stalls after a successful match on-chain. */
  const FULFILL_MS = 38_000;
  const fulfillAbort = new AbortController();
  const fulfillTimer = setTimeout(() => fulfillAbort.abort(), FULFILL_MS);
  try {
    await fulfillMatchedPairApi(
      {
        bidOrderHash: bid.orderHash,
        askOrderHash: listing.orderHash,
      },
      { signal: fulfillAbort.signal },
    );
  } catch (e: unknown) {
    const aborted =
      fulfillAbort.signal.aborted ||
      (e instanceof Error && e.name === "AbortError") ||
      (typeof DOMException !== "undefined" &&
        e instanceof DOMException &&
        e.name === "AbortError");
    if (aborted) {
      console.warn(
        "[runCriteriaMatch] fulfillMatchedPairApi timed out; match likely succeeded on-chain — refresh or check explorer.",
      );
      return;
    }
    throw e;
  } finally {
    clearTimeout(fulfillTimer);
  }
}

/**
 * Match a card-level token offer against an ask via `matchAdvancedOrders` (no Merkle).
 */
export async function runTokenBidMatch(params: {
  address: Address;
  publicClient: PublicClient;
  writeContractAsync: MatchWriteContractAsync;
  bid: Order;
  listing: Order;
  chainId: SupportedChainId;
}): Promise<void> {
  const { address, publicClient, writeContractAsync, bid, listing, chainId } =
    params;
  const { usdcAddress } = getChainContracts(chainId);

  if (!isTokenBidOrder(bid)) {
    throw new Error("Not a token bid");
  }

  const chainNow = await getChainTimestampSec(publicClient);
  if (!isSeaportOrderActiveAt(bid, chainNow)) {
    throw new Error(explainSeaportOrderInactive(bid, chainNow, "bid"));
  }
  if (!isSeaportOrderActiveAt(listing, chainNow)) {
    throw new Error(explainSeaportOrderInactive(listing, chainNow, "listing"));
  }

  await assertBuyerUsdcReadyForCriteriaBid(publicClient, bid, usdcAddress);

  const exec = buildTokenBidMatchExecution({
    tokenBidOrder: bid,
    listingOrder: listing,
  });
  const prepared = matchAdvancedOrdersArgs({
    orders: exec.orders,
    criteriaResolvers: exec.criteriaResolvers,
    fulfillments: exec.fulfillments,
    recipient: exec.recipient,
  });

  const gasPromise = gasWithCapFast(
    publicClient,
    {
      address: SEAPORT_ADDRESS,
      abi: prepared.abi,
      functionName: prepared.functionName,
      args: prepared.args,
      account: address,
    },
    GAS_FALLBACK.matchAdvancedOrders,
  );

  const SIMULATION_MS = 55_000;
  const [, gas] = await Promise.race([
    Promise.all([
      publicClient.simulateContract({
        address: SEAPORT_ADDRESS,
        abi: SEAPORT_ABI_WITH_MATCH_ADVANCED,
        functionName: "matchAdvancedOrders",
        args: prepared.args as readonly [unknown, unknown, unknown, unknown],
        account: address,
      }),
      gasPromise,
    ]),
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              "Simulation timed out (RPC slow or overloaded). Try again in a moment.",
            ),
          ),
        SIMULATION_MS,
      ),
    ),
  ]);

  const hash = await writeContractAsync({
    address: SEAPORT_ADDRESS,
    abi: prepared.abi as Abi,
    functionName: prepared.functionName,
    args: prepared.args as readonly unknown[],
    chainId,
    gas,
  });

  const receipt = await Promise.race([
    publicClient.waitForTransactionReceipt({ hash }),
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              "Match transaction confirmation timed out. Check the explorer for this tx or try again.",
            ),
          ),
        120_000,
      ),
    ),
  ]);
  if (receipt.status === "reverted") {
    throw new Error(
      `Seaport match reverted on-chain (tx ${hash}). Check the buyer’s USDC balance and approval to Seaport.`,
    );
  }

  const FULFILL_MS = 38_000;
  const fulfillAbort = new AbortController();
  const fulfillTimer = setTimeout(() => fulfillAbort.abort(), FULFILL_MS);
  try {
    await fulfillMatchedPairApi(
      {
        bidOrderHash: bid.orderHash,
        askOrderHash: listing.orderHash,
      },
      { signal: fulfillAbort.signal },
    );
  } catch (e: unknown) {
    const aborted =
      fulfillAbort.signal.aborted ||
      (e instanceof Error && e.name === "AbortError") ||
      (typeof DOMException !== "undefined" &&
        e instanceof DOMException &&
        e.name === "AbortError");
    if (aborted) {
      console.warn(
        "[runTokenBidMatch] fulfillMatchedPairApi timed out; match likely succeeded on-chain — refresh or check explorer.",
      );
      return;
    }
    throw e;
  } finally {
    clearTimeout(fulfillTimer);
  }
}

const GENERIC_CONTRACT =
  "The contract could not complete this action. Check balances, approvals, and listing status.";

export function mapMatchError(
  e: unknown,
  ctx?: {
    /** `bid.offerer` — shown when USDC transfer fails so users know whose wallet matters. */
    bidOfferer?: string;
  },
): string {
  const { message, code } = mapWalletError(e);
  if (code !== "REVERT") return message;

  const low = message.toLowerCase();
  if (
    low.includes("invalidtime") ||
    low.includes("not active on-chain") ||
    low.includes("seaport invalidtime")
  ) {
    return message;
  }
  if (
    low.includes("allowance") ||
    low.includes("erc20") ||
    (low.includes("transfer") &&
      (low.includes("fail") || low.includes("exceed") || low.includes("insufficient")))
  ) {
    const who = ctx?.bidOfferer
      ? `The wallet that signed this bid (buyer) is ${ctx.bidOfferer}. `
      : "";
    return `${message} ${who}` +
      `Seaport moves USDC from that buyer when the match executes. A collection bid does not escrow tokens first — if their balance fell or Seaport’s USDC allowance was revoked or spent, this revert happens. ` +
      `If you are both buyer and seller, that same address must still hold the full bid USDC plus an active approve(Seaport).`;
  }

  if (message === GENERIC_CONTRACT) {
    return `${message} For instant match: confirm the buyer still has USDC + Seaport approval, your NFT is approved for Seaport, listing/bid are active, and Merkle set matches.`;
  }

  return message;
}

export function classifyMatchFailureCode(e: unknown): MatchFailureCode {
  const { message, code } = mapWalletError(e);
  const low = message.toLowerCase();
  if (
    low.includes("balance insufficient") ||
    low.includes("insufficient balance") ||
    low.includes("buyer usdc insufficient") ||
    low.includes("usdc insufficient") ||
    (low.includes("erc20") && low.includes("insufficient"))
  ) {
    return "insufficient_balance";
  }
  if (low.includes("allowance too low") || low.includes("allowance")) {
    return "insufficient_allowance";
  }
  if (low.includes("merkle root") || low.includes("leaf set") || low.includes("criteria")) {
    return "merkle_mismatch";
  }
  if (low.includes("invalidtime") || low.includes("not active on-chain") || low.includes("expired")) {
    return "expired_or_inactive";
  }
  if (low.includes("timed out") || low.includes("timeout")) {
    return "timeout";
  }
  if (code === "REVERT") return "unknown";
  return "unknown";
}
