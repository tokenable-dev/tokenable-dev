import { maxUint256, type Address, type PublicClient } from "viem";
import type { SupportedChainId } from "@/lib/chains";
import { getChainContracts } from "@/lib/chains";
import { SEAPORT_ADDRESS, USDC_ABI } from "@/constants/contracts";
import { GAS_FALLBACK, gasWithCapFast, userTxFees } from "@/lib/network";
import { pauseAfterWalletPrompt } from "@/lib/privy/wallet";
import { runWalletFlow } from "@/lib/privy/session";
import type { BidUsdcSeaportApproveWrite } from "./bidUsdcApproveWrite";
import { readUsdcSeaportAllowance } from "./bidChainPreflight";

/**
 * After Seaport sign: USDC → Seaport approve in its own wallet phase (Privy-safe).
 * Does not wait for receipt (same as legacy bid path).
 */
export async function ensureUsdcSeaportBidApprovalAfterSign(params: {
  address: Address;
  publicClient: PublicClient;
  chainId: SupportedChainId;
  bidUnits: bigint;
  /** From pre-sign allowance check; skips work when false. */
  needsUsdcApprove: boolean;
  writeContractAsync: BidUsdcSeaportApproveWrite;
  /** Optional gas estimate started before sign. */
  usdcApproveGasPromise?: Promise<bigint | null>;
}): Promise<void> {
  const {
    address,
    publicClient,
    chainId,
    bidUnits,
    needsUsdcApprove,
    writeContractAsync,
    usdcApproveGasPromise,
  } = params;

  if (!needsUsdcApprove) return;

  const { usdcAddress } = getChainContracts(chainId);
  const allowanceAfterSign = await readUsdcSeaportAllowance(
    publicClient,
    chainId,
    address,
  );
  if (allowanceAfterSign >= bidUnits) return;

  await runWalletFlow(async () => {
    const gasApprove =
      (await usdcApproveGasPromise) ??
      (await gasWithCapFast(
        publicClient,
        {
          address: usdcAddress,
          abi: USDC_ABI,
          functionName: "approve",
          args: [SEAPORT_ADDRESS, maxUint256],
          account: address,
        },
        GAS_FALLBACK.erc20Approve,
      ));
    const fees = await userTxFees(publicClient);
    await writeContractAsync({
      address: usdcAddress,
      abi: USDC_ABI,
      functionName: "approve",
      args: [SEAPORT_ADDRESS, maxUint256],
      chainId,
      gas: gasApprove,
      ...fees,
    });
    await pauseAfterWalletPrompt();
  });
}
