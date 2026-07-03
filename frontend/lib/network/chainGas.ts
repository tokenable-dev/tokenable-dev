import type { PublicClient } from "viem";
import type { EstimateContractGasParameters } from "viem";

/**
 * 일부 RPC(테스트넷 포함)는 블록/트랜잭션 가스 상한이 2^24(16777216) 근처.
 * MetaMask·viem 기본(~21M)이면 "transaction gas limit too high" 로 거절될 수 있음.
 */
const GAS_CEILING = BigInt(16000000);

/** `eth_estimateGas` 가 느릴 때 MetaMask 팝업을 빨리 띄우기 위한 보수적 기본값 */
export const GAS_FALLBACK = {
  erc20Approve: BigInt(120_000),
  erc721Approve: BigInt(100_000),
  setApprovalForAll: BigInt(85_000),
  fulfillOrder: BigInt(650_000),
  matchAdvancedOrders: BigInt(1_200_000),
  rwaMint: BigInt(350_000),
} as const;

/** RPC `estimateGas`가 느릴 때 지갑 팝업까지 지연되지 않도록 짧게 두고 fallback 사용 */
const ESTIMATE_BUDGET_MS = 400;

export async function gasWithCap(
  publicClient: PublicClient,
  params: EstimateContractGasParameters,
): Promise<bigint> {
  const estimated = await publicClient.estimateContractGas(params);
  const buffered = (estimated * BigInt(120)) / BigInt(100);
  return buffered > GAS_CEILING ? GAS_CEILING : buffered;
}

/**
 * 추정이 `ESTIMATE_BUDGET_MS` 안에 끝나면 그 값을 쓰고, 늦으면 `fallback`으로 즉시 지갑 프롬프트.
 */
export async function gasWithCapFast(
  publicClient: PublicClient,
  params: EstimateContractGasParameters,
  fallback: bigint,
  estimateBudgetMs: number = ESTIMATE_BUDGET_MS,
): Promise<bigint> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), estimateBudgetMs);
    gasWithCap(publicClient, params)
      .then((g) => {
        clearTimeout(timer);
        resolve(g);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(fallback);
      });
  });
}
