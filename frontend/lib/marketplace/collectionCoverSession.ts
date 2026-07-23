/**
 * Remember the cover URL shown on a collection card so collection detail
 * can show the same image after navigation (list → detail).
 */
const STORAGE_KEY = "tokenable.collectionCoverByKey.v1";
const MAX_AGE_MS = 30 * 60 * 1000;

type CoverStore = Record<string, { url: string; savedAt: number }>;

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
): void {
  const key = collectionKey.trim().toLowerCase();
  const url = imageUrl?.trim();
  if (!key || !url) return;
  const store = readStore();
  store[key] = { url, savedAt: Date.now() };
  writeStore(store);
}

export function readRememberedCollectionCoverImage(
  collectionKey: string,
): string | null {
  const key = collectionKey.trim().toLowerCase();
  if (!key) return null;
  const store = readStore();
  const entry = store[key];
  if (!entry?.url?.trim()) return null;
  if (Date.now() - entry.savedAt > MAX_AGE_MS) {
    delete store[key];
    writeStore(store);
    return null;
  }
  return entry.url.trim();
}
