import { backendFetch, getApiUrl } from "./client";
import { CHAIN_ID_HEADER } from "@/lib/chains/apiHeader";
import type { SupportedChainId } from "@/lib/chains/types";

/**
 * On-chain mint + receipt wait often exceeds the default 25s API timeout.
 * Client abort does not cancel the backend tx — users saw false timeouts while mint succeeded.
 */
const RWA_MINT_TIMEOUT_MS = 180_000;

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
  /** From POST /rwa/upload when S3 slab cache succeeded. */
  displayImageUrl?: string | null;
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
    timeoutMs: RWA_MINT_TIMEOUT_MS,
  });
  if (!res.ok) {
    const error = (await res.json().catch(() => ({}))) as {
      message?: string | string[];
      code?: string;
    };
    const msg = Array.isArray(error.message)
      ? error.message.join(", ")
      : error.message;
    if (error.code === "COMPANY_ADDRESS_REQUIRED") {
      throw new Error(
        msg ??
          "Partner vault requires a company vault address — set it in Settings → Addresses",
      );
    }
    if (error.code === "SELF_VAULT_PARTNER_ONLY") {
      throw new Error(
        msg ??
          "Partner vault is available only to contracted Tokenable partners",
      );
    }
    throw new Error(msg ?? "On-chain mint failed");
  }
  return res.json() as Promise<MintRwaResult>;
}
