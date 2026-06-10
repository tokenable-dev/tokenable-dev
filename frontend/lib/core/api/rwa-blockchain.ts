import { backendFetch, getApiUrl } from "./client";
import type { RwaMetadata } from "./rwa-types";

export async function getRwaTokensByOwner(address: string): Promise<number[]> {
  const res = await backendFetch(`${getApiUrl()}/blockchain/rwa/tokens/${address}`);
  if (!res.ok) throw new Error("Failed to fetch owned assets");
  return res.json() as Promise<number[]>;
}

/** 서버에서 tokenURI + metadata JSON + 브라우저용 imageUrl(https)까지 일괄 처리 (클라이언트는 IPFS에 직접 접속하지 않음) */
export async function postRwaMetadataBatch(body: {
  tokenIds: number[];
}): Promise<{
  items: Array<{
    tokenId: number;
    tokenURI: string | null;
    metadata: RwaMetadata | null;
    imageUrl: string | null;
  }>;
}> {
  const res = await backendFetch(`${getApiUrl()}/blockchain/rwa/metadata/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to batch-load RWA metadata");
  return res.json() as Promise<{
    items: Array<{
      tokenId: number;
      tokenURI: string | null;
      metadata: RwaMetadata | null;
      imageUrl: string | null;
    }>;
  }>;
}

export type ResolvedRwaAsset = {
  tokenId: number;
  tokenURI: string;
  metadata: RwaMetadata | null;
  imageUrl: string | null;
};

/** 단일 토큰: tokenURI → metadata → imageUrl 전부 서버 게이트웨이·캐시 */
export async function getResolvedRwaAsset(tokenId: number): Promise<ResolvedRwaAsset> {
  const res = await backendFetch(`${getApiUrl()}/blockchain/rwa/asset/${tokenId}`);
  if (res.status === 404) {
    return { tokenId, tokenURI: "", metadata: null, imageUrl: null };
  }
  if (!res.ok) throw new Error("Failed to load resolved RWA asset");
  return res.json() as Promise<ResolvedRwaAsset>;
}

/**
 * Notify the backend that a new RWA token was minted.
 * The backend will bootstrap the marketplace_collections row and rwa_tokens registry
 * so that Cardhedger comps and trades data are available before the first listing.
 * Fire-and-forget: never throws.
 */
export async function notifyRwaMint(tokenId: number): Promise<void> {
  try {
    await backendFetch(`${getApiUrl()}/marketplace/collections/on-mint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokenId }),
    });
  } catch {
    // best-effort — do not block the mint success UX
  }
}

/** 컬렉션 커버 등 임의 URI → 서버가 선택한 https URL (게이트웨이 폴백) */
export async function postResolveMediaUrls(uris: string[]): Promise<{
  items: Array<{ uri: string; httpsUrl: string | null }>;
}> {
  const res = await backendFetch(`${getApiUrl()}/blockchain/media/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uris }),
  });
  if (!res.ok) throw new Error("Failed to resolve media URLs");
  return res.json() as Promise<{ items: Array<{ uri: string; httpsUrl: string | null }> }>;
}
