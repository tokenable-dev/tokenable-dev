import type { Address, Hash } from "viem";
import { formatUnits, maxUint256 } from "viem";
import type { Order } from "@/lib/core";
import { fulfillOrderApi, invalidateUnownedAskApi } from "@/lib/core";
import {
  SEAPORT_ADDRESS,
  SEAPORT_ABI,
  USDC_ABI,
  TOKENABLE_RWA_APPROVE_ABI,
} from "@/constants/contracts";
import { getChainContracts, type SupportedChainId } from "@/lib/chains";
import type { UserTxFees } from "@/lib/network";
import {
  GAS_FALLBACK,
  gasWithCapFast,
  userTxFees,
  waitForUserTxReceipt,
} from "@/lib/network";
import type { PrivyAwareWriteContractInput } from "@/hooks/wallet/usePrivyAwareWriteContract";
import { buyFulfillAskPrivyUi, buyUsdcSeaportApprovalPrivyUi } from "@/lib/privy/redeemTxUi";
import {
  FULFILL_EXTRA_DATA,
  fulfillSeaportOrderArgs,
  requireSeaportOrderFilled,
} from "@/lib/seaport/orders/fulfillOrderArgs";
import {
  buildUsdcSeaportApproveWrite,
  type UsdcSeaportApproveWrite,
} from "@/lib/seaport/bid/bidUsdcApproveWrite";
import { runWalletFlow } from "@/lib/privy/session";
import { pauseAfterWalletPrompt } from "@/lib/privy/wallet";
import type { PublicClient } from "viem";

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

function isTimeoutError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === "AbortError") return true;
  if (e instanceof Error && e.name === "TimeoutError") return true;
  const msg = e instanceof Error ? e.message : String(e ?? "");
  return /timed out|timeout|time out|deadline/i.test(msg);
}

export type BuyFulfillAskWrite = (args: {
  ask: Order;
  chainId: number;
  priceUsdcLabel: string;
  gas?: bigint;
} & UserTxFees) => Promise<Hash>;

export type BuyAskWrites = {
  approveUsdcForSeaport: UsdcSeaportApproveWrite;
  fulfillAsk: BuyFulfillAskWrite;
};

export function buildBuyFulfillAskWrite(
  writeContractWithPrivyUi: (
    input: PrivyAwareWriteContractInput,
  ) => Promise<Hash>,
): BuyFulfillAskWrite {
  return async ({ ask, chainId, priceUsdcLabel, gas, maxFeePerGas, maxPriorityFeePerGas }) =>
    writeContractWithPrivyUi({
      chainId,
      address: SEAPORT_ADDRESS,
      abi: SEAPORT_ABI,
      functionName: "fulfillOrder",
      args: [fulfillSeaportOrderArgs(ask), FULFILL_EXTRA_DATA],
      gas,
      maxFeePerGas,
      maxPriorityFeePerGas,
      privyUi: buyFulfillAskPrivyUi(priceUsdcLabel),
    });
}

export function buildBuyAskWrites(
  writeContractWithPrivyUi: (
    input: PrivyAwareWriteContractInput,
  ) => Promise<Hash>,
): BuyAskWrites {
  return {
    approveUsdcForSeaport: buildUsdcSeaportApproveWrite(
      writeContractWithPrivyUi,
      buyUsdcSeaportApprovalPrivyUi,
    ),
    fulfillAsk: buildBuyFulfillAskWrite(writeContractWithPrivyUi),
  };
}

/**
 * Fulfill an active ask (Buy now). USDC approve first only when allowance is low.
 */
export async function fulfillAskListingOrder(params: {
  ask: Order;
  address: Address;
  publicClient: PublicClient;
  writes: BuyAskWrites;
  chainId: number;
}): Promise<void> {
  const { ask, address, publicClient, writes, chainId } = params;
  const { usdcAddress, rwaAddress } = getChainContracts(chainId as SupportedChainId);
  const payUnits = askPriceMicros(ask);
  const priceUsdcLabel = formatUnits(payUnits, 6);
  const tokenIdBn = BigInt(String(ask.tokenId ?? "0"));

  const onChainOwner = await publicClient.readContract({
    address: rwaAddress,
    abi: TOKENABLE_RWA_APPROVE_ABI,
    functionName: "ownerOf",
    args: [tokenIdBn],
  });
  if (onChainOwner.toLowerCase() !== String(ask.offerer).toLowerCase()) {
    try {
      await invalidateUnownedAskApi(ask.orderHash, address);
    } catch {
      /* book cleanup is best-effort */
    }
    if (onChainOwner.toLowerCase() === address.toLowerCase()) {
      throw new Error(
        "You already own this card in the connected wallet. The other wallet’s listing was removed because it could not be filled.",
      );
    }
    throw new Error(
      "This listing is no longer valid — the seller no longer holds the card. It was removed from the book. Refresh and try again.",
    );
  }

  const allowance = await publicClient.readContract({
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
    await runWalletFlow(async () => {
      const [gasApprove, approveFees] = await Promise.all([
        gasApprovePromise,
        userTxFees(publicClient),
      ]);
      const approveTx = await writes.approveUsdcForSeaport({
        address: usdcAddress,
        abi: USDC_ABI,
        functionName: "approve",
        args: [SEAPORT_ADDRESS, maxUint256],
        chainId,
        gas: gasApprove,
        ...approveFees,
      });
      const approveReceipt = await waitForUserTxReceipt(publicClient, approveTx);
      if (approveReceipt.status === "reverted") {
        throw new Error("USDC approval was reverted on-chain. Try again.");
      }
      await pauseAfterWalletPrompt();
    });
  }

  const fulfillTx = await runWalletFlow(async () => {
    const [gasFulfill, fulfillFees] = await Promise.all([
      gasFulfillPromise,
      userTxFees(publicClient),
    ]);
    return writes.fulfillAsk({
      ask,
      chainId,
      priceUsdcLabel,
      gas: gasFulfill,
      ...fulfillFees,
    });
  });

  const receipt = await waitForUserTxReceipt(publicClient, fulfillTx);
  if (receipt.status === "reverted") {
    throw new Error("Purchase was reverted on-chain. Check USDC balance and try again.");
  }
  try {
    await requireSeaportOrderFilled(publicClient, ask.orderHash);
  } catch (e) {
    console.warn(
      "[fulfillAskListing] getOrderStatus not filled after a successful receipt — still settling the book",
      ask.orderHash,
      e,
    );
  }

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
