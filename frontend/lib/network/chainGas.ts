import { parseGwei } from "viem";
import type { Hash, PublicClient, TransactionReceipt } from "viem";
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
const ESTIMATE_BUDGET_MS = 200;

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

/**
 * Alchemy / publicnode suggest a 0 tip on mainnet and Privy sends it as-is, so
 * approves waited several blocks (1min+). Same floor as backend `MIN_PRIORITY_FEE_WEI`.
 */
const MIN_PRIORITY_FEE_WEI = parseGwei("0.2");
const FEE_ESTIMATE_BUDGET_MS = 1_500;

export type UserTxFees = { maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint };

/**
 * EIP-1559 fees for a user tx with a minimum tip. Resolves `{}` (wallet decides)
 * if estimation fails or exceeds the budget, so the wallet prompt is never blocked.
 */
export async function userTxFees(publicClient: PublicClient): Promise<UserTxFees> {
  const estimate = publicClient
    .estimateFeesPerGas()
    .then((fees): UserTxFees => {
      const tip =
        fees.maxPriorityFeePerGas > MIN_PRIORITY_FEE_WEI
          ? fees.maxPriorityFeePerGas
          : MIN_PRIORITY_FEE_WEI;
      // viem's maxFee is ~1.2× base; 2× keeps the tx valid if base fee rises for a few blocks.
      const base = fees.maxFeePerGas - fees.maxPriorityFeePerGas;
      return { maxFeePerGas: base * BigInt(2) + tip, maxPriorityFeePerGas: tip };
    })
    .catch((): UserTxFees => ({}));
  const timeout = new Promise<UserTxFees>((resolve) =>
    setTimeout(() => resolve({}), FEE_ESTIMATE_BUDGET_MS),
  );
  return Promise.race([estimate, timeout]);
}

/**
 * Receipt poll sized to block time (Ethereum / Sepolia ~12s, Polygon ~2s).
 * Polling far faster than blocks only burns RPC quota and triggers 429 retries.
 */
function txReceiptPollMs(chainId: number | undefined): number {
  return chainId === 137 ? 1_000 : 2_000;
}
const USER_TX_RECEIPT_TIMEOUT_MS = 180_000;

export async function waitForUserTxReceipt(
  publicClient: PublicClient,
  hash: Hash,
): Promise<TransactionReceipt> {
  const pollingInterval = txReceiptPollMs(publicClient.chain?.id);
  try {
    return await publicClient.waitForTransactionReceipt({
      hash,
      pollingInterval,
      timeout: USER_TX_RECEIPT_TIMEOUT_MS,
    });
  } catch (e: unknown) {
    const receipt = await publicClient
      .getTransactionReceipt({ hash })
      .catch(() => null);
    if (receipt) return receipt;
    throw e;
  }
}
