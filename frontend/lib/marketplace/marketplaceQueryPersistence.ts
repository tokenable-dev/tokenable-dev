import type { InfiniteData } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { rq, marketplaceRqPolicy } from "@/lib/core";
import {
  platformDefaultChainId,
  readPersistedAppChainId,
} from "@/lib/chains";
import type { MarketplaceCollectionSummary } from "@/lib/core";

/** Bump when persisted shape changes or to drop stale browser caches (e.g. after DB resets). */
const SCHEMA = 6;
/** Cached list + snapshots stay usable for 24h; after that next visit refetches. */
const TTL_MS = 24 * 60 * 60 * 1000;
const LS_COLLECTIONS_PREFIX = "tokenable.rq.collections-marketplace.v3.";
const LS_SNAPSHOTS_PREFIX = "tokenable.rq.collection-snapshots-map.v3.";

function collectionsLsKey(chainId: number): string {
  return `${LS_COLLECTIONS_PREFIX}${chainId}`;
}

function snapshotsLsKey(chainId: number): string {
  return `${LS_SNAPSHOTS_PREFIX}${chainId}`;
}

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
  queryClient.setQueryDefaults(["collections", "marketplace"], {
    staleTime: marketplaceRqPolicy.collectionsStaleMs,
    gcTime: oneDay,
    refetchOnWindowFocus: false,
  });
  queryClient.setQueryDefaults(["collections", "marketplace", "home-feed"], {
    staleTime: marketplaceRqPolicy.snapshotsStaleMs,
    gcTime: oneDay,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
  queryClient.setQueryDefaults(["collection-snapshots"], {
    staleTime: marketplaceRqPolicy.snapshotsStaleMs,
    gcTime: oneDay,
    refetchOnWindowFocus: false,
  });
}

function purgeLegacySnapshotStorage(): void {
  try {
    localStorage.removeItem("tokenable.rq.collection-snapshots-map.v2");
  } catch {
    /* ignore */
  }
}

/**
 * Restore marketplace list + batched snapshot bundle from localStorage after mount
 * (paired with {@link subscribeMarketplacePersistence}).
 */
export function hydrateMarketplaceQueries(queryClient: QueryClient): void {
  if (typeof window === "undefined") return;
  configureMarketplaceDefaults(queryClient);
  purgeLegacySnapshotStorage();
  const chainId = readPersistedAppChainId() ?? platformDefaultChainId();

  try {
    const lsKey = collectionsLsKey(chainId);
    const rawCol = localStorage.getItem(lsKey);
    if (rawCol) {
      let parsed: { v?: number; savedAt?: number; data?: unknown };
      try {
        parsed = JSON.parse(rawCol) as { v?: number; savedAt?: number; data?: unknown };
      } catch {
        parsed = {};
      }
      if (parsed.v != null && parsed.v !== SCHEMA) {
        localStorage.removeItem(lsKey);
      } else if (
        parsed.v === SCHEMA &&
        typeof parsed.savedAt === "number" &&
        isFresh(parsed.savedAt) &&
        parsed.data != null &&
        isValidCollectionsInfiniteCache(parsed.data)
      ) {
        queryClient.setQueryData(rq.collectionsMarketplace(chainId), parsed.data);
      } else if (parsed.data != null && !isValidCollectionsInfiniteCache(parsed.data)) {
        localStorage.removeItem(lsKey);
      }
    }

    const snapLsKey = snapshotsLsKey(chainId);
    const rawSnap = localStorage.getItem(snapLsKey);
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
        localStorage.removeItem(snapLsKey);
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
          queryClient.setQueryData(
            rq.collectionSnapshots(chainId, keys, duration),
            parsed.map[k],
          );
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
  void queryClient.invalidateQueries({
    queryKey: rq.collectionsMarketplace(chainId),
    exact: true,
  });
  void queryClient.invalidateQueries({ queryKey: ["collection-snapshots", chainId] });
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function flushMarketplaceToStorage(queryClient: QueryClient): void {
  if (typeof window === "undefined") return;
  try {
    const chainId = readPersistedAppChainId() ?? platformDefaultChainId();
    const col = queryClient.getQueryData(rq.collectionsMarketplace(chainId));
    if (col != null) {
      localStorage.setItem(
        collectionsLsKey(chainId),
        JSON.stringify({
          v: SCHEMA,
          savedAt: Date.now(),
          data: col,
        }),
      );
    }

    const rows = queryClient.getQueriesData({
      queryKey: ["collection-snapshots", chainId],
    });
    const map: Record<string, unknown> = {};
    for (const [queryKey, data] of rows) {
      if (!Array.isArray(queryKey) || queryKey.length < 4) continue;
      const sub = queryKey[2];
      const durationRaw = queryKey[3];
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
    const snapLsKey = snapshotsLsKey(chainId);
    if (Object.keys(map).length > 0) {
      localStorage.setItem(
        snapLsKey,
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

function shouldPersistMarketplaceQueryKey(key: readonly unknown[]): boolean {
  const root = key[0];
  if (root === "collection-snapshots") return true;
  // Infinite collections list only — not home-feed / search keys.
  return (
    root === "collections" &&
    key[1] === "marketplace" &&
    typeof key[2] === "number"
  );
}

/** Subscribe to cache updates; debounced writes to localStorage. */
export function subscribeMarketplacePersistence(
  queryClient: QueryClient,
): () => void {
  return queryClient.getQueryCache().subscribe((event) => {
    const key = event.query?.queryKey;
    if (!Array.isArray(key) || !shouldPersistMarketplaceQueryKey(key)) return;
    schedulePersist(queryClient);
  });
}
