import { backendFetch, getApiUrl } from "./client";
import { CHAIN_ID_HEADER } from "@/lib/chains/apiHeader";
import type { SupportedChainId } from "@/lib/chains/types";

/** IPFS + optional S3 slab cache — often > default 25s API timeout. */
const RWA_UPLOAD_TIMEOUT_MS = 120_000;

export interface UploadRwaResult {
  tokenURI: string;
  imageURI: string;
  metadataCID: string;
  /** Platform S3 slab URL when configured at upload time; pass to mint. */
  displayImageUrl?: string | null;
  displayImageBackUrl?: string | null;
}

export async function uploadRwaMetadata(
  formData: FormData,
  chainId: SupportedChainId,
): Promise<UploadRwaResult> {
  const res = await backendFetch(`${getApiUrl()}/rwa/upload`, {
    method: "POST",
    headers: { [CHAIN_ID_HEADER]: String(chainId) },
    body: formData,
    timeoutMs: RWA_UPLOAD_TIMEOUT_MS,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Upload failed" }));
    throw new Error((error as { message: string }).message ?? "Asset upload failed");
  }
  return res.json() as Promise<UploadRwaResult>;
}
