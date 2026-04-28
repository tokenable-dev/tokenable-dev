const LS_KEY = "tokenable.rwa-metadata-cache.v2";
const MAX_ENTRIES = 400;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

type Entry = { savedAt: number; metadata: unknown; imageUrl?: string | null };

function readMap(): Record<string, Entry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Entry>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(m: Record<string, Entry>): void {
  if (typeof window === "undefined") return;
  try {
    const keys = Object.keys(m);
    if (keys.length <= MAX_ENTRIES) {
      localStorage.setItem(LS_KEY, JSON.stringify(m));
      return;
    }
    const sorted = keys
      .map((k) => ({ k, t: m[k]?.savedAt ?? 0 }))
      .sort((a, b) => a.t - b.t);
    const drop = sorted.length - MAX_ENTRIES;
    const next = { ...m };
    for (let i = 0; i < drop; i++) delete next[sorted[i].k];
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch {
    /* quota */
  }
}

export function getCachedRwaMetadata(tokenId: number): unknown | null {
  const m = readMap();
  const e = m[String(tokenId)];
  if (!e || Date.now() - e.savedAt > TTL_MS) return null;
  return e.metadata;
}

export function getCachedRwaImageUrl(tokenId: number): string | null {
  const m = readMap();
  const e = m[String(tokenId)];
  if (!e || Date.now() - e.savedAt > TTL_MS) return null;
  const u = e.imageUrl;
  return typeof u === "string" && u.trim() ? u.trim() : null;
}

export function primeRwaMetadataCache(
  items: Array<{
    tokenId: number;
    metadata: unknown | null;
    imageUrl?: string | null;
  }>,
): void {
  const m = readMap();
  const now = Date.now();
  for (const it of items) {
    if (it.metadata == null) continue;
    const img =
      it.imageUrl != null && String(it.imageUrl).trim()
        ? String(it.imageUrl).trim()
        : null;
    m[String(it.tokenId)] = { savedAt: now, metadata: it.metadata, imageUrl: img };
  }
  writeMap(m);
}
