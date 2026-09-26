import { activeRqChainId } from "@/lib/chains/activeChain";

/**
 * Remember the cover URL shown on a collection card so collection detail
 * can show the same image after navigation (list → detail).
 */
const STORAGE_KEY = "tokenable.collectionCoverByKey.v2";
const MAX_AGE_MS = 30 * 60 * 1000;

type CoverStore = Record<string, { url: string; savedAt: number; chainId?: number }>;

export function clearCollectionCoverSession(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem("tokenable.collectionCoverByKey.v1");
  } catch {
    /* ignore */
  }
}

function storeKey(chainId: number, collectionKey: string): string {
  return `${chainId}:${collectionKey.trim().toLowerCase()}`;
}

function readStore(): CoverStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CoverStore;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeStore(store: CoverStore): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode */
  }
}

export function rememberCollectionCoverImage(
  collectionKey: string,
  imageUrl: string | null | undefined,
  chainId: number = activeRqChainId(),
): void {
  const key = collectionKey.trim().toLowerCase();
  const url = imageUrl?.trim();
  if (!key || !url) return;
  const store = readStore();
  const sk = storeKey(chainId, key);
  store[sk] = { url, savedAt: Date.now(), chainId };
  writeStore(store);
}

export function readRememberedCollectionCoverImage(
  collectionKey: string,
  chainId: number = activeRqChainId(),
): string | null {
  const key = collectionKey.trim().toLowerCase();
  if (!key) return null;
  const store = readStore();
  const sk = storeKey(chainId, key);
  const entry = store[sk];
  if (!entry?.url?.trim() || entry.chainId !== chainId) return null;
  if (Date.now() - entry.savedAt > MAX_AGE_MS) {
    delete store[sk];
    writeStore(store);
    return null;
  }
  return entry.url.trim();
}
