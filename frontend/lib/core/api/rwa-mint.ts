import { backendFetch, getApiUrl } from "./client";
import { CHAIN_ID_HEADER } from "@/lib/chains/apiHeader";
import type { SupportedChainId } from "@/lib/chains/types";

export type MintRwaResult = {
  tokenId: number;
  tokenURI: string;
  txHash: string;
  chainId: number;
};

export async function mintRwaViaBackend(input: {
  recipientAddress: string;
  tokenURI: string;
  /** PSA cert number — permanent physical-asset identity behind the on-chain vaultRef. */
  certNumber: string;
  chainId: SupportedChainId;
  /**
   * custody (default): mint to platform wallet; admin delivers.
   * direct: mint to recipientAddress (self vault).
   */
  deliveryMode?: "custody" | "direct";
}): Promise<MintRwaResult> {
  const { chainId, ...body } = input;
  const res = await backendFetch(`${getApiUrl()}/rwa/mint`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [CHAIN_ID_HEADER]: String(chainId),
    },
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Mint failed" }));
    throw new Error(
      (error as { message?: string }).message ?? "On-chain mint failed",
    );
  }
  return res.json() as Promise<MintRwaResult>;
}
