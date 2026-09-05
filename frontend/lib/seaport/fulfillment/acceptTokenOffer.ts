import type { Abi, Address, Hash, PublicClient } from "viem";
import { formatUnits } from "viem";
import {
  SEAPORT_ADDRESS,
  SEAPORT_ABI,
  TOKENABLE_RWA_APPROVE_ABI,
} from "@/constants/contracts";
import { getChainContracts, type SupportedChainId } from "@/lib/chains";
import { fulfillOrderApi, getRwaSettlementPolicy, type Order } from "@/lib/core";
import { GAS_FALLBACK, gasWithCapFast, mapWalletError, waitForUserTxReceipt } from "@/lib/network";
import { askGrossUsdcMicros, bidUsdcAmount } from "../orders/bidUsdc";
import { isTokenBidOrder } from "../orders/isTokenBidOrder";
import {
  FULFILL_EXTRA_DATA,
  fulfillSeaportOrderArgs,
} from "../orders/fulfillOrderArgs";
import {
  explainSeaportOrderInactive,
  getChainTimestampSec,
  isSeaportOrderActiveAt,
} from "../orders/seaportOrderTime";
import {
  assertBuyerUsdcReadyForCriteriaBid,
  runTokenBidMatch,
  type MatchWriteContractAsync,
} from "./runCriteriaMatch";

type AcceptWriteContractAsync = MatchWriteContractAsync &
  ((args: {
    address: Address;
    abi: Abi;
    functionName: string;
    args: readonly unknown[];
    chainId: number;
    gas?: bigint;
  }) => Promise<Hash>);

async function ensureNftApprovedForSeaport(params: {
  publicClient: PublicClient;
  writeContractAsync: AcceptWriteContractAsync;
  owner: Address;
  nft: Address;
  chainId: number;
}): Promise<void> {
  const { publicClient, writeContractAsync, owner, nft, chainId } = params;
  const approved = await publicClient.readContract({
    address: nft,
    abi: TOKENABLE_RWA_APPROVE_ABI,
    functionName: "isApprovedForAll",
    args: [owner, SEAPORT_ADDRESS],
  });
  if (approved) return;

  const gas = await gasWithCapFast(
    publicClient,
    {
      address: nft,
      abi: TOKENABLE_RWA_APPROVE_ABI,
      functionName: "setApprovalForAll",
      args: [SEAPORT_ADDRESS, true],
      account: owner,
    },
    GAS_FALLBACK.setApprovalForAll,
  );
  const hash = await writeContractAsync({
    address: nft,
    abi: TOKENABLE_RWA_APPROVE_ABI as Abi,
    functionName: "setApprovalForAll",
    args: [SEAPORT_ADDRESS, true],
    chainId,
    gas,
  });
  const receipt = await waitForUserTxReceipt(publicClient, hash);
  if (receipt.status === "reverted") {
    throw new Error("NFT approval for Seaport was reverted. Try again.");
  }
}

/**
 * Seller accepts a card-level token offer **without** lowering/re-signing the ask.
 *
 * - If offer ≥ ask gross and an active ask is provided → `matchAdvancedOrders` (platform fee intact).
 * - If offer < ask (canonical 40 ask / 38 bid) → seller `fulfillOrder` on the bid only.
 *   Backend `fulfillOrder` then cancels leftover active asks for that tokenId.
 *
 * On any failure before/during the Seaport tx: the ask is never cancelled or replaced.
 */
export async function acceptTokenOffer(params: {
  address: Address;
  publicClient: PublicClient;
  writeContractAsync: AcceptWriteContractAsync;
  bid: Order;
  /** Active ask for the same token — left unchanged until a successful settle. */
  listing: Order | null;
  chainId: SupportedChainId;
}): Promise<{ mode: "match" | "fulfill_bid" }> {
  const { address, publicClient, writeContractAsync, bid, listing, chainId } =
    params;
  const { usdcAddress, rwaAddress } = getChainContracts(chainId);

  if (!isTokenBidOrder(bid)) {
    throw new Error("Only card-level token offers can be accepted this way.");
  }
  if (bid.status !== "active") {
    throw new Error("This offer is no longer active.");
  }

  const chainNow = await getChainTimestampSec(publicClient);
  if (!isSeaportOrderActiveAt(bid, chainNow)) {
    throw new Error(explainSeaportOrderInactive(bid, chainNow, "bid"));
  }

  const bidTokenId = String(bid.tokenId ?? "").trim();
  if (!bidTokenId || bidTokenId === "0") {
    throw new Error("Offer is missing tokenId.");
  }

  if (listing) {
    if (listing.side !== "ask" || listing.status !== "active") {
      throw new Error("Your listing is not an active ask.");
    }
    if (
      String(listing.tokenId).trim() !== bidTokenId ||
      String(listing.offerer).toLowerCase() !== String(address).toLowerCase()
    ) {
      throw new Error("Your listing does not match this offer’s token.");
    }
    if (!isSeaportOrderActiveAt(listing, chainNow)) {
      throw new Error(explainSeaportOrderInactive(listing, chainNow, "listing"));
    }
  }

  await assertBuyerUsdcReadyForCriteriaBid(publicClient, bid, usdcAddress);
  await ensureNftApprovedForSeaport({
    publicClient,
    writeContractAsync,
    owner: address,
    nft: rwaAddress,
    chainId,
  });

  const bidAmt = bidUsdcAmount(bid);
  const askAmt = listing ? askGrossUsdcMicros(listing) : BigInt(0);
  const canMatch =
    listing != null && askAmt > BigInt(0) && bidAmt >= askAmt;

  try {
    if (canMatch && listing) {
      await runTokenBidMatch({
        address,
        publicClient,
        writeContractAsync,
        bid,
        listing,
        chainId,
      });
      return { mode: "match" };
    }

    const { settlementPolicy } = await getRwaSettlementPolicy(bidTokenId);
    if (settlementPolicy === "self_vault_hold") {
      throw new Error(
        "Self-vault cards cannot accept an offer below the ask. Match against your listing (offer ≥ ask) or lower the ask first.",
      );
    }

    const gas = await gasWithCapFast(
      publicClient,
      {
        address: SEAPORT_ADDRESS,
        abi: SEAPORT_ABI,
        functionName: "fulfillOrder",
        args: [fulfillSeaportOrderArgs(bid), FULFILL_EXTRA_DATA],
        account: address,
      },
      GAS_FALLBACK.fulfillOrder,
    );

    const hash = await writeContractAsync({
      address: SEAPORT_ADDRESS,
      abi: SEAPORT_ABI as Abi,
      functionName: "fulfillOrder",
      args: [fulfillSeaportOrderArgs(bid), FULFILL_EXTRA_DATA],
      chainId,
      gas,
    });
    const receipt = await waitForUserTxReceipt(publicClient, hash);
    if (receipt.status === "reverted") {
      throw new Error(
        `Seaport fulfill reverted (tx ${hash}). The buyer may lack USDC or Seaport allowance. Your listing was not changed.`,
      );
    }

    await fulfillOrderApi(bid.orderHash, bid.offerer);
    return { mode: "fulfill_bid" };
  } catch (e) {
    const raw =
      mapWalletError(e).message ||
      (e instanceof Error ? e.message : String(e));
    if (/listing was not changed/i.test(raw)) {
      throw e instanceof Error ? e : new Error(raw);
    }
    const offerHint =
      bidAmt > BigInt(0) ? ` Offer was ${formatUnits(bidAmt, 6)} USDC.` : "";
    throw new Error(`${raw}${offerHint} Your ask listing was not changed.`);
  }
}
