import type { Address, Hash, PublicClient } from "viem";
import { fulfillOrderApi, type Order } from "@/lib/core";
import {
  SEAPORT_ADDRESS,
  SEAPORT_ABI,
  USDC_ADDRESS,
  USDC_ABI,
} from "@/constants/contracts";
import { GAS_FALLBACK, gasWithCapFast } from "@/lib/network";
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
  address: typeof USDC_ADDRESS;
  abi: typeof USDC_ABI;
  functionName: "approve";
  args: readonly [`0x${string}`, bigint];
  chainId: number;
  gas?: bigint;
}) => Promise<Hash>;

/**
 * Fulfill an active ask listing (buy the listed RWA at the listing price).
 * Approves USDC if needed, then Seaport fulfillOrder, then notifies the API.
 */
export async function fulfillAskListingOrder(params: {
  ask: Order;
  address: Address;
  publicClient: PublicClient;
  writeContractAsync: FulfillWrite & ApproveWrite;
  chainId: number;
}): Promise<void> {
  const { ask, address, publicClient, writeContractAsync, chainId } = params;
  const payUnits = askPriceMicros(ask);

  let allowance = await publicClient.readContract({
    address: USDC_ADDRESS,
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
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: "approve",
        args: [SEAPORT_ADDRESS, payUnits],
        account: address,
      },
      GAS_FALLBACK.erc20Approve,
    );
    const gasApprove = await gasApprovePromise;
    const approveTx = await writeContractAsync({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: "approve",
      args: [SEAPORT_ADDRESS, payUnits],
      chainId,
      gas: gasApprove,
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx });
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
  const receipt = await publicClient.waitForTransactionReceipt({ hash: fulfillTx });
  if (receipt.status === "reverted") {
    throw new Error("Purchase was reverted on-chain. Check USDC balance and try again.");
  }

  await fulfillOrderApi(ask.orderHash, address);
}
