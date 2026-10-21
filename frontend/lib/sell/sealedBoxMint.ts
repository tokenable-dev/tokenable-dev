import { backendFetch, getApiUrl } from "@/lib/core/api/client";
import type { SupportedChainId } from "@/lib/chains/types";

export type SealedBoxMintResult = {
  id: string;
  status: "minted";
  tokenId: string;
  tokenURI: string;
  displayImageUrl: string;
  txHash: string;
  chainId: number;
  productName: string;
};

async function parseError(res: Response, fallback: string): Promise<never> {
  const err = await res.json().catch(() => ({}));
  const body = err as { message?: string | string[] };
  const msg = Array.isArray(body.message)
    ? body.message.join(", ")
    : body.message;
  throw new Error(msg ?? fallback);
}

export async function mintSealedBox(input: {
  pricechartingProductId: string;
  clientRequestId: string;
  image: File;
  chainId: SupportedChainId;
  recipientAddress?: string;
}): Promise<SealedBoxMintResult> {
  const body = new FormData();
  body.set("pricechartingProductId", input.pricechartingProductId);
  body.set("clientRequestId", input.clientRequestId);
  if (input.recipientAddress) body.set("recipientAddress", input.recipientAddress);
  body.set("image", input.image);
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/partners/me/sealed-box-mints`,
    {
      method: "POST",
      headers: { "x-tokenable-chain-id": String(input.chainId) },
      body,
      timeoutMs: 120_000,
    },
  );
  if (!res.ok) await parseError(res, "Sealed box mint failed");
  return res.json() as Promise<SealedBoxMintResult>;
}
