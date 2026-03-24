import type { PublicClient } from "viem";
import type { EstimateContractGasParameters } from "viem";

/**
 * Sepolia·일부 RPC는 블록/트랜잭션 가스 상한이 2^24(16777216) 근처.
 * MetaMask·viem 기본(~21M)이면 "transaction gas limit too high" 로 거절될 수 있음.
 */
const GAS_CEILING = BigInt(16000000);

export async function gasWithCap(
  publicClient: PublicClient,
  params: EstimateContractGasParameters,
): Promise<bigint> {
  const estimated = await publicClient.estimateContractGas(params);
  const buffered = (estimated * BigInt(120)) / BigInt(100);
  return buffered > GAS_CEILING ? GAS_CEILING : buffered;
}
