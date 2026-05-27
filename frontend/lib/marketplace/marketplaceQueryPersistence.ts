import type { InfiniteData } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { rq, marketplaceRqPolicy } from "@/lib/core";
import type { MarketplaceCollectionSummary } from "@/lib/core";

/** Bump when persisted shape changes or to drop stale browser caches (e.g. after DB resets). */
const SCHEMA = 4;
/** Cached list + snapshots stay usable for 24h; after that next visit refetches. */
const TTL_MS = 24 * 60 * 60 * 1000;
const LS_COLLECTIONS = "tokenable.rq.collections-marketplace.v2";
const LS_SNAPSHOTS_MAP = "tokenable.rq.collection-snapshots-map.v2";

function isFresh(savedAt: number): boolean {
  return Date.now() - savedAt < TTL_MS;
}

function isValidCollectionsInfiniteCache(
  data: unknown,
): data is InfiniteData<{
  items: MarketplaceCollectionSummary[];
  nextCursor: string | null;
}> {
  if (!data || typeof data !== "object") return false;
  const pages = (data as { pages?: unknown }).pages;
  if (!Array.isArray(pages)) return false;
  return pages.every(
    (p) =>
      p &&
      typeof p === "object" &&
      Array.isArray((p as { items?: unknown }).items),
  );
}

function configureMarketplaceDefaults(queryClient: QueryClient): void {
  const oneDay = 24 * 60 * 60 * 1000;
  queryClient.setQueryDefaults(rq.collectionsMarketplace(), {
    staleTime: marketplaceRqPolicy.collectionsStaleMs,
    gcTime: oneDay,
    refetchOnWindowFocus: false,
  });
  queryClient.setQueryDefaults(["collection-snapshots"], {
    staleTime: marketplaceRqPolicy.snapshotsStaleMs,
    gcTime: oneDay,
    refetchOnWindowFocus: false,
  });
}

/**
 * Restore marketplace list + batched snapshot bundle from localStorage before first paint
 * (paired with {@link subscribeMarketplacePersistence}).
 */
export function hydrateMarketplaceQueries(queryClient: QueryClient): void {
  if (typeof window === "undefined") return;
  configureMarketplaceDefaults(queryClient);

  try {
    const rawCol = localStorage.getItem(LS_COLLECTIONS);
    if (rawCol) {
      let parsed: { v?: number; savedAt?: number; data?: unknown };
      try {
        parsed = JSON.parse(rawCol) as { v?: number; savedAt?: number; data?: unknown };
      } catch {
        parsed = {};
      }
      if (parsed.v != null && parsed.v !== SCHEMA) {
        localStorage.removeItem(LS_COLLECTIONS);
      } else if (
        parsed.v === SCHEMA &&
        typeof parsed.savedAt === "number" &&
        isFresh(parsed.savedAt) &&
        parsed.data != null &&
        isValidCollectionsInfiniteCache(parsed.data)
      ) {
        queryClient.setQueryData(rq.collectionsMarketplace(), parsed.data);
      } else if (parsed.data != null && !isValidCollectionsInfiniteCache(parsed.data)) {
        localStorage.removeItem(LS_COLLECTIONS);
      }
    }

    const rawSnap = localStorage.getItem(LS_SNAPSHOTS_MAP);
    if (rawSnap) {
      let parsed: { v?: number; savedAt?: number; map?: Record<string, unknown> };
      try {
        parsed = JSON.parse(rawSnap) as {
          v?: number;
          savedAt?: number;
          map?: Record<string, unknown>;
        };
      } catch {
        parsed = {};
      }
      if (parsed.v != null && parsed.v !== SCHEMA) {
        localStorage.removeItem(LS_SNAPSHOTS_MAP);
      } else if (
        parsed.v === SCHEMA &&
        typeof parsed.savedAt === "number" &&
        isFresh(parsed.savedAt) &&
        parsed.map &&
        typeof parsed.map === "object"
      ) {
        for (const k of Object.keys(parsed.map)) {
          let keys: string[];
          let duration: "7d" | "30d" | "90d" | "180d" | "365d" | "max" = "max";
          try {
            const raw = JSON.parse(k) as unknown;
            if (Array.isArray(raw) && raw.length >= 1) {
              if (Array.isArray(raw[0])) {
                keys = raw[0] as string[];
                const d = raw[1];
                if (
                  d === "7d" ||
                  d === "30d" ||
                  d === "90d" ||
                  d === "180d" ||
                  d === "365d" ||
                  d === "max"
                ) {
                  duration = d;
                }
              } else {
                keys = raw as string[];
              }
            } else continue;
            if (!Array.isArray(keys) || keys.length === 0) continue;
          } catch {
            continue;
          }
          queryClient.setQueryData(rq.collectionSnapshots(keys, duration), parsed.map[k]);
        }
      }
    }
  } catch {
    /* ignore corrupt storage */
  }

  /**
   * LS is only a paint-time cache; always prefer the server after hydration so an empty
   * or reset DB is not masked for the full collections stale window.
   */
  void queryClient.invalidateQueries({ queryKey: rq.collectionsMarketplace() });
  void queryClient.invalidateQueries({ queryKey: ["collection-snapshots"] });
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function flushMarketplaceToStorage(queryClient: QueryClient): void {
  if (typeof window === "undefined") return;
  try {
    const col = queryClient.getQueryData(rq.collectionsMarketplace());
    if (col != null) {
      localStorage.setItem(
        LS_COLLECTIONS,
        JSON.stringify({
          v: SCHEMA,
          savedAt: Date.now(),
          data: col,
        }),
      );
    }

    const rows = queryClient.getQueriesData({
      queryKey: ["collection-snapshots"],
    });
    const map: Record<string, unknown> = {};
    for (const [queryKey, data] of rows) {
      if (!Array.isArray(queryKey) || queryKey.length < 2) continue;
      const sub = queryKey[1];
      const durationRaw = queryKey[2];
      const duration =
        durationRaw === "7d" ||
        durationRaw === "30d" ||
        durationRaw === "90d" ||
        durationRaw === "180d" ||
        durationRaw === "365d" ||
        durationRaw === "max"
          ? durationRaw
          : "max";
      if (Array.isArray(sub) && sub.length > 0 && data != null) {
        const sorted = [...(sub as string[])].slice().sort();
        map[JSON.stringify([sorted, duration])] = data;
      }
    }
    if (Object.keys(map).length > 0) {
      localStorage.setItem(
        LS_SNAPSHOTS_MAP,
        JSON.stringify({
          v: SCHEMA,
          savedAt: Date.now(),
          map,
        }),
      );
    }
  } catch {
    /* quota / private mode */
  }
}

function schedulePersist(queryClient: QueryClient): void {
  if (persistTimer != null) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    flushMarketplaceToStorage(queryClient);
  }, 1400);
}

/** Subscribe to cache updates; debounced writes to localStorage. */
export function subscribeMarketplacePersistence(
  queryClient: QueryClient,
): () => void {
  return queryClient.getQueryCache().subscribe(() => {
    schedulePersist(queryClient);
  });
}
