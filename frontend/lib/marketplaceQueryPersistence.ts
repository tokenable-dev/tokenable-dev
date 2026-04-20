import type { QueryClient } from "@tanstack/react-query";

const SCHEMA = 1;
/** Cached list + snapshots stay usable for 24h; after that next visit refetches. */
const TTL_MS = 24 * 60 * 60 * 1000;
const LS_COLLECTIONS = "tokenable.rq.marketplace-collections.v1";
const LS_SNAPSHOTS_MAP = "tokenable.rq.marketplace-snapshots-map.v1";

function isFresh(savedAt: number): boolean {
  return Date.now() - savedAt < TTL_MS;
}

function configureMarketplaceDefaults(queryClient: QueryClient): void {
  const fiveMin = 5 * 60 * 1000;
  const oneDay = 24 * 60 * 60 * 1000;
  queryClient.setQueryDefaults(["marketplace-collections"], {
    staleTime: fiveMin,
    gcTime: oneDay,
    refetchOnWindowFocus: false,
  });
  queryClient.setQueryDefaults(["marketplace-collection-snapshots"], {
    staleTime: fiveMin,
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
      const parsed = JSON.parse(rawCol) as {
        v: number;
        savedAt: number;
        data: unknown;
      };
      if (
        parsed.v === SCHEMA &&
        isFresh(parsed.savedAt) &&
        parsed.data != null
      ) {
        queryClient.setQueryData(["marketplace-collections"], parsed.data);
      }
    }

    const rawSnap = localStorage.getItem(LS_SNAPSHOTS_MAP);
    if (rawSnap) {
      const parsed = JSON.parse(rawSnap) as {
        v: number;
        savedAt: number;
        map: Record<string, unknown> | undefined;
      };
      if (
        parsed.v === SCHEMA &&
        isFresh(parsed.savedAt) &&
        parsed.map &&
        typeof parsed.map === "object"
      ) {
        for (const k of Object.keys(parsed.map)) {
          queryClient.setQueryData(
            ["marketplace-collection-snapshots", k],
            parsed.map[k],
          );
        }
      }
    }
  } catch {
    /* ignore corrupt storage */
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function flushMarketplaceToStorage(queryClient: QueryClient): void {
  if (typeof window === "undefined") return;
  try {
    const col = queryClient.getQueryData(["marketplace-collections"]);
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
      queryKey: ["marketplace-collection-snapshots"],
    });
    const map: Record<string, unknown> = {};
    for (const [queryKey, data] of rows) {
      if (!Array.isArray(queryKey) || queryKey.length < 2) continue;
      const sub = queryKey[1];
      if (typeof sub === "string" && sub.length > 0 && data != null) {
        map[sub] = data;
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
