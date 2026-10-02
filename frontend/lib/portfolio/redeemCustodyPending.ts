import type { SupportedChainId } from "@/lib/chains/types";

const CUSTODY_PENDING_KEY = "tk_redeem_custody_pending_v1";

/** After USDC + redeem-batch succeed, resume NFT → custody without re-paying. */
export type RedeemCustodyPending = {
  chainId: SupportedChainId;
  paymentBatchId: string;
  custodyWalletAddress: string;
  paymentTxHash: string;
  tokenIds: number[];
  savedAt: number;
};

export function readRedeemCustodyPending(): RedeemCustodyPending | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CUSTODY_PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RedeemCustodyPending;
    if (
      !parsed ||
      typeof parsed.chainId !== "number" ||
      !parsed.paymentBatchId ||
      !parsed.custodyWalletAddress ||
      !Array.isArray(parsed.tokenIds) ||
      parsed.tokenIds.length === 0
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeRedeemCustodyPending(
  pending: RedeemCustodyPending,
): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(CUSTODY_PENDING_KEY, JSON.stringify(pending));
}

export function clearRedeemCustodyPending(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(CUSTODY_PENDING_KEY);
}
