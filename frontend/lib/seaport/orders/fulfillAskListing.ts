import type { Address, Hash, PublicClient } from "viem";
import { maxUint256 } from "viem";
import { fulfillOrderApi, type Order } from "@/lib/core";
import {
  SEAPORT_ADDRESS,
  SEAPORT_ABI,
  USDC_ABI,
} from "@/constants/contracts";
import { getChainContracts, type SupportedChainId } from "@/lib/chains";
import { GAS_FALLBACK, gasWithCapFast, waitForUserTxReceipt } from "@/lib/network";
import { FULFILL_EXTRA_DATA, fulfillSeaportOrderArgs } from "./fulfillOrderArgs";

function askPriceMicros(o: Order): bigint {
  try {
    const raw = o.considerationAmount;
    const s = typeof raw === "bigint" ? String(raw) : String(raw ?? "").trim();
    if (!s) return BigInt(0);
    return BigInt(s);
  } catch {
    return BigInt(0);
  }
}

type FulfillWrite = (args: {
  address: typeof SEAPORT_ADDRESS;
  abi: typeof SEAPORT_ABI;
  functionName: "fulfillOrder";
  args: readonly [ReturnType<typeof fulfillSeaportOrderArgs>, typeof FULFILL_EXTRA_DATA];
  chainId: number;
  gas?: bigint;
}) => Promise<Hash>;

type ApproveWrite = (args: {
  address: `0x${string}`;
  abi: typeof USDC_ABI;
  functionName: "approve";
  args: readonly [`0x${string}`, bigint];
  chainId: number;
  gas?: bigint;
}) => Promise<Hash>;

function isTimeoutError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === "AbortError") return true;
  if (e instanceof Error && e.name === "TimeoutError") return true;
  const msg = e instanceof Error ? e.message : String(e ?? "");
  return /timed out|timeout|time out|deadline/i.test(msg);
}

/**
 * Fulfill an active ask listing (buy the listed RWA at the listing price).
 * Approves USDC to Seaport with maxUint256 if needed (same as bids), then fulfillOrder.
 */
export async function fulfillAskListingOrder(params: {
  ask: Order;
  address: Address;
  publicClient: PublicClient;
  writeContractAsync: FulfillWrite & ApproveWrite;
  chainId: number;
}): Promise<void> {
  const { ask, address, publicClient, writeContractAsync, chainId } = params;
  const { usdcAddress } = getChainContracts(chainId as SupportedChainId);
  const payUnits = askPriceMicros(ask);

  let allowance = await publicClient.readContract({
    address: usdcAddress,
    abi: USDC_ABI,
    functionName: "allowance",
    args: [address, SEAPORT_ADDRESS],
  });

  const gasFulfillPromise = gasWithCapFast(
    publicClient,
    {
      address: SEAPORT_ADDRESS,
      abi: SEAPORT_ABI,
      functionName: "fulfillOrder",
      args: [fulfillSeaportOrderArgs(ask), FULFILL_EXTRA_DATA],
      account: address,
    },
    GAS_FALLBACK.fulfillOrder,
  );

  if (allowance < payUnits) {
    const gasApprovePromise = gasWithCapFast(
      publicClient,
      {
        address: usdcAddress,
        abi: USDC_ABI,
        functionName: "approve",
        args: [SEAPORT_ADDRESS, maxUint256],
        account: address,
      },
      GAS_FALLBACK.erc20Approve,
    );
    const gasApprove = await gasApprovePromise;
    const approveTx = await writeContractAsync({
      address: usdcAddress,
      abi: USDC_ABI,
      functionName: "approve",
      args: [SEAPORT_ADDRESS, maxUint256],
      chainId,
      gas: gasApprove,
    });
    const approveReceipt = await waitForUserTxReceipt(publicClient, approveTx);
    if (approveReceipt.status === "reverted") {
      throw new Error("USDC approval was reverted on-chain. Try again.");
    }
  }

  const gasFulfill = await gasFulfillPromise;
  const fulfillTx = await writeContractAsync({
    address: SEAPORT_ADDRESS,
    abi: SEAPORT_ABI,
    functionName: "fulfillOrder",
    args: [fulfillSeaportOrderArgs(ask), FULFILL_EXTRA_DATA],
    chainId,
    gas: gasFulfill,
  });
  const receipt = await waitForUserTxReceipt(publicClient, fulfillTx);
  if (receipt.status === "reverted") {
    throw new Error("Purchase was reverted on-chain. Check USDC balance and try again.");
  }

  // On-chain buy already succeeded. Don't fail the UX if the indexer/API stalls
  // (same pattern as runCriteriaMatch after matchAdvancedOrders).
  try {
    await fulfillOrderApi(ask.orderHash, address);
  } catch (e: unknown) {
    if (isTimeoutError(e)) {
      console.warn(
        "[fulfillAskListing] fulfillOrderApi timed out after on-chain success — refresh Portfolio / collection.",
        ask.orderHash,
      );
      return;
    }
    throw e;
  }
}
