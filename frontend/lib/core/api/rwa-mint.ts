import { backendFetch, getApiUrl } from "./client";
import { readNestErrorMessage } from "./nestErrorMessage";
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

export type RwaCertAvailability = {
  available: boolean;
  certNumber: string;
  message: string | null;
};

export type RwaCertMintOutcome = {
  certNumber: string;
  outcome: "available" | "in_progress" | "minted";
  tokenId?: number;
  txHash?: string | null;
};

const MINT_OUTCOME_POLL_MS = 3_000;
const MINT_OUTCOME_POLL_ATTEMPTS = 40;

export async function getRwaCertMintOutcome(
  certNumber: string,
  chainId: SupportedChainId,
): Promise<RwaCertMintOutcome> {
  const cert = certNumber.trim();
  const res = await backendFetch(
    `${getApiUrl()}/rwa/cert-mint-outcome/${encodeURIComponent(cert)}`,
    {
      method: "GET",
      headers: { [CHAIN_ID_HEADER]: String(chainId) },
      credentials: "include",
    },
  );
  if (!res.ok) {
    const { message } = await readNestErrorMessage(
      res,
      "Could not resolve mint outcome",
    );
    throw new Error(message);
  }
  return res.json() as Promise<RwaCertMintOutcome>;
}

function isAmbiguousMintTransportError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("[http 504]") ||
    msg.includes("timed out") ||
    msg.includes("fetch failed") ||
    msg.includes("socket hang") ||
    msg.includes("cannot reach api") ||
    msg.includes("econnreset")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Poll when POST /rwa/mint dropped but Nest may still have minted. */
export async function pollRwaCertMintOutcomeAfterAmbiguousError(
  certNumber: string,
  chainId: SupportedChainId,
  err: unknown,
): Promise<{ tokenId: number; txHash?: string | null } | null> {
  if (!isAmbiguousMintTransportError(err)) return null;
  for (let i = 0; i < MINT_OUTCOME_POLL_ATTEMPTS; i++) {
    const outcome = await getRwaCertMintOutcome(certNumber, chainId);
    if (outcome.outcome === "minted" && outcome.tokenId != null) {
      return { tokenId: outcome.tokenId, txHash: outcome.txHash };
    }
    if (outcome.outcome === "available") return null;
    await sleep(MINT_OUTCOME_POLL_MS);
  }
  return null;
}

export async function getRwaCertAvailability(
  certNumber: string,
  chainId: SupportedChainId,
): Promise<RwaCertAvailability> {
  const cert = certNumber.trim();
  const res = await backendFetch(
    `${getApiUrl()}/rwa/cert-availability/${encodeURIComponent(cert)}`,
    {
      method: "GET",
      headers: { [CHAIN_ID_HEADER]: String(chainId) },
      credentials: "include",
    },
  );
  if (!res.ok) {
    const { message } = await readNestErrorMessage(
      res,
      "Could not check cert availability",
    );
    throw new Error(message);
  }
  return res.json() as Promise<RwaCertAvailability>;
}

/** Returns a block reason when the cert already has an active mint on this chain. */
export async function certMintBlockReason(
  certNumber: string,
  chainId: SupportedChainId,
): Promise<string | null> {
  const check = await getRwaCertAvailability(certNumber, chainId);
  if (check.available) return null;
  return (
    check.message ??
    `PSA cert #${check.certNumber || certNumber} is already minted on this network.`
  );
}

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
  /** List title — persisted on rwa_tokens.display_name at mint. */
  displayName?: string | null;
  /** Marketplace bucket from upload — persisted on rwa_tokens.collection_key. */
  collectionKey?: string | null;
  /** From POST /rwa/upload when S3 slab cache succeeded. */
  displayImageUrl?: string | null;
  displayImageBackUrl?: string | null;
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
    const { message, code } = await readNestErrorMessage(
      res,
      "On-chain mint failed",
    );
    if (code === "COMPANY_ADDRESS_REQUIRED") {
      throw new Error(
        message.includes("company vault")
          ? message
          : `${message} — set company vault address in Settings → Addresses`,
      );
    }
    if (code === "SELF_VAULT_PARTNER_ONLY") {
      throw new Error(
        message.includes("partner")
          ? message
          : `${message} — contracted Tokenable partners only`,
      );
    }
    throw new Error(message);
  }
  return res.json() as Promise<MintRwaResult>;
}
