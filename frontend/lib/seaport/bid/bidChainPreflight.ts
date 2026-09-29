import type { Address, PublicClient } from "viem";
import type { SupportedChainId } from "@/lib/chains";
import { getChainContracts } from "@/lib/chains";
import { SEAPORT_ADDRESS, USDC_ABI } from "@/constants/contracts";

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
