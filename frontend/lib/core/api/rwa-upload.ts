import { backendFetch, getApiUrl } from "./client";
import { CHAIN_ID_HEADER } from "@/lib/chains/apiHeader";
import type { SupportedChainId } from "@/lib/chains/types";

export interface UploadRwaResult {
  tokenURI: string;
  imageURI: string;
  metadataCID: string;
}

export async function uploadRwaMetadata(
  formData: FormData,
  chainId: SupportedChainId,
): Promise<UploadRwaResult> {
  const res = await backendFetch(`${getApiUrl()}/rwa/upload`, {
    method: "POST",
    headers: { [CHAIN_ID_HEADER]: String(chainId) },
    body: formData,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Upload failed" }));
    throw new Error((error as { message: string }).message ?? "Asset upload failed");
  }
  return res.json() as Promise<UploadRwaResult>;
}
