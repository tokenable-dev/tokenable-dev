import { maxUint256, type Address, type PublicClient } from "viem";
import type { SupportedChainId } from "@/lib/chains";
import { getChainContracts } from "@/lib/chains";
import { SEAPORT_ADDRESS, USDC_ABI } from "@/constants/contracts";
import { GAS_FALLBACK, gasWithCapFast, userTxFees } from "@/lib/network";
import { pauseAfterWalletPrompt } from "@/lib/privy/wallet";
import { runWalletFlow } from "@/lib/privy/session";
import type { BidUsdcSeaportApproveWrite } from "./bidUsdcApproveWrite";

export async function readUsdcSeaportAllowance(
  publicClient: PublicClient,
  chainId: SupportedChainId,
  owner: Address,
  cachedAllowance?: bigint,
): Promise<bigint> {
  if (cachedAllowance !== undefined) return cachedAllowance;
  const { usdcAddress } = getChainContracts(chainId);
  return publicClient.readContract({
    address: usdcAddress,
    abi: USDC_ABI,
    functionName: "allowance",
    args: [owner, SEAPORT_ADDRESS],
  });
}

export function bidNeedsUsdcSeaportApprove(
  allowance: bigint,
  bidUnits: bigint,
): boolean {
  return allowance < bidUnits;
}

/**
 * After Seaport sign: USDC → Seaport approve in its own wallet phase (Privy-safe).
 */
export async function ensureUsdcSeaportBidApprovalAfterSign(params: {
  address: Address;
  publicClient: PublicClient;
  chainId: SupportedChainId;
  bidUnits: bigint;
  needsUsdcApprove: boolean;
  writeContractAsync: BidUsdcSeaportApproveWrite;
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
