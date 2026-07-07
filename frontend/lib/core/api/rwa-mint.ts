import { backendFetch, getApiUrl } from "./client";

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
}): Promise<MintRwaResult> {
  const res = await backendFetch(`${getApiUrl()}/rwa/mint`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
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
