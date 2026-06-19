import { backendFetch, getApiUrl } from "./client";
import type { RwaMetadata } from "./rwa-types";

/** Must match backend `RwaMetadataBatchDto` `@ArrayMaxSize(80)`. */
export const RWA_METADATA_BATCH_MAX = 80;

export type RwaMetadataBatchItem = {
  tokenId: number;
  tokenURI: string | null;
  metadata: RwaMetadata | null;
  imageUrl: string | null;
};

export async function getRwaTokensByOwner(address: string): Promise<number[]> {
  const res = await backendFetch(`${getApiUrl()}/blockchain/rwa/tokens/${address}`);
  if (!res.ok) throw new Error("Failed to fetch owned assets");
  return res.json() as Promise<number[]>;
}

/** 서버에서 tokenURI + metadata JSON + 브라우저용 imageUrl(https)까지 일괄 처리 (클라이언트는 IPFS에 직접 접속하지 않음) */
export async function postRwaMetadataBatch(body: {
  tokenIds: number[];
}): Promise<{ items: RwaMetadataBatchItem[] }> {
  const res = await backendFetch(`${getApiUrl()}/blockchain/rwa/metadata/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to batch-load RWA metadata");
  return res.json() as Promise<{ items: RwaMetadataBatchItem[] }>;
}

/** Chunks tokenIds — portfolio can own 80+ cards; single POST >80 is rejected by Nest validation. */
export async function postRwaMetadataBatchBatched(
  tokenIds: number[],
): Promise<{ items: RwaMetadataBatchItem[] }> {
  const unique = [
    ...new Set((tokenIds ?? []).map((n) => Math.floor(Number(n)))),
  ].filter((n) => Number.isFinite(n) && n >= 0);
  if (unique.length === 0) return { items: [] };

  const items: RwaMetadataBatchItem[] = [];
  for (let i = 0; i < unique.length; i += RWA_METADATA_BATCH_MAX) {
    const chunk = unique.slice(i, i + RWA_METADATA_BATCH_MAX);
    const pack = await postRwaMetadataBatch({ tokenIds: chunk });
    items.push(...pack.items);
  }
  items.sort((a, b) => a.tokenId - b.tokenId);
  return { items };
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
 * @deprecated Import {@link bootstrapRwaMintMarketData} from `@/lib/core` instead.
 */
export { bootstrapRwaMintMarketData, notifyRwaMint, syncRwaTokenAfterMint } from "../rwa-mint-bootstrap";
export type { RwaMintSyncResult as RwaMintBootstrapResult } from "../rwa-mint-bootstrap";

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
