import type { QueryClient } from "@tanstack/react-query";
import {
  rq,
  marketplaceRqPolicy,
  type CollectionMarketPreview,
  type OrderListItem,
  type PortfolioDailySnapshotItem,
  type PortfolioHoldingBatchItem,
  type PortfolioMarketBatchItem,
  type RwaMetadata,
} from "@/lib/core";
import type { PortfolioAssetsPageResponse } from "@/lib/core/api/portfolio-assets-page";
import { activeRqChainId } from "@/lib/chains";

/** Bump when persisted shape changes. */
const SCHEMA = 1;
/** Paint-time cache TTL — matches marketplace list persistence. */
const TTL_MS = 24 * 60 * 60 * 1000;
const LS_PREFIX = "tokenable.rq.portfolio.v1.";

export type PersistedPortfolioBundle = {
  v: number;
  savedAt: number;
  address: string;
  chainId: number;
  tokenIds: number[];
  bffLoadedCount: number;
  fetchedTokenIds: number[];
  metadataItems: Array<{
    tokenId: number;
    metadata: RwaMetadata | null;
    imageUrl: string | null;
  }>;
  collectionKeys: Record<number, string>;
  marketItems: PortfolioMarketBatchItem[];
  holdings: PortfolioHoldingBatchItem[];
  mintPreviews: Record<number, CollectionMarketPreview>;
  unmatchedMintTokenIds: number[];
  dailySnapshots?: {
    items: PortfolioDailySnapshotItem[];
    latest24h: { pnlUsd: number | null; pnlPct: number | null };
  };
  ordersAsk?: OrderListItem[];
};

function lsKey(address: string, chainId: number): string {
  return `${LS_PREFIX}${chainId}.${address.trim().toLowerCase()}`;
}

export function isPortfolioBundleFresh(savedAt: number): boolean {
  return Date.now() - savedAt < TTL_MS;
}

export function readPortfolioBundle(
  address: string,
  chainId: number,
): PersistedPortfolioBundle | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(lsKey(address, chainId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedPortfolioBundle;
    if (parsed?.v !== SCHEMA || !isPortfolioBundleFresh(parsed.savedAt)) {
      localStorage.removeItem(lsKey(address, chainId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writePortfolioBundle(
  bundle: Omit<PersistedPortfolioBundle, "v" | "savedAt">,
): void {
  if (typeof window === "undefined") return;
  const address = bundle.address.trim().toLowerCase();
  if (!address) return;
  try {
    localStorage.setItem(
      lsKey(address, bundle.chainId),
      JSON.stringify({
        v: SCHEMA,
        savedAt: Date.now(),
        ...bundle,
        address,
      }),
    );
  } catch {
    /* quota / private mode */
  }
}

function readAllPortfolioBundles(): PersistedPortfolioBundle[] {
  if (typeof window === "undefined") return [];
  const out: PersistedPortfolioBundle[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(LS_PREFIX)) continue;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as PersistedPortfolioBundle;
      if (parsed?.v !== SCHEMA) {
        localStorage.removeItem(key);
        continue;
      }
      if (!isPortfolioBundleFresh(parsed.savedAt)) {
        localStorage.removeItem(key);
        continue;
      }
      out.push(parsed);
    } catch {
      localStorage.removeItem(key!);
    }
  }
  return out;
}

function bundleToAssetsPageResponse(
  bundle: PersistedPortfolioBundle,
): PortfolioAssetsPageResponse {
  return {
    ownedTokenIds: bundle.tokenIds,
    metadataItems: bundle.fetchedTokenIds.map((tokenId) => {
      const row = bundle.metadataItems.find((m) => m.tokenId === tokenId);
      return {
        tokenId,
        tokenURI: null,
        metadata: row?.metadata ?? null,
        imageUrl: row?.imageUrl ?? null,
        imageBackUrl: null,
      };
    }),
    collectionKeys: bundle.collectionKeys,
    marketItems: bundle.marketItems,
    mintPreviews: {},
    holdings: bundle.holdings.filter((h) =>
      bundle.fetchedTokenIds.includes(h.tokenId),
    ),
  };
}

function hydrateBundle(queryClient: QueryClient, bundle: PersistedPortfolioBundle): void {
  const address = bundle.address.trim().toLowerCase();
  const chainId = bundle.chainId;

  if (bundle.tokenIds.length > 0) {
    queryClient.setQueryData(rq.rwaTokens(address, chainId), bundle.tokenIds);
    queryClient.setQueryData(
      rq.portfolioAssetsPageBootstrap(address, chainId),
      bundleToAssetsPageResponse(bundle),
    );
  }

  if (bundle.dailySnapshots) {
    queryClient.setQueryData(
      rq.portfolioDailySnapshots(address, chainId),
      bundle.dailySnapshots,
    );
  }

  if (bundle.ordersAsk) {
    queryClient.setQueryData(
      rq.ordersByOfferer(address, "ask", chainId),
      bundle.ordersAsk,
    );
  }

  if (bundle.fetchedTokenIds.length > 0) {
    queryClient.setQueryData(
      rq.portfolioAssetsPage(address, bundle.fetchedTokenIds, chainId),
      bundleToAssetsPageResponse(bundle),
    );
  }

  if (bundle.unmatchedMintTokenIds.length > 0 && bundle.mintPreviews) {
    queryClient.setQueryData(
      rq.marketMintPreviews(address, bundle.unmatchedMintTokenIds, chainId),
      bundle.mintPreviews,
    );
  }
}

function configurePortfolioQueryDefaults(queryClient: QueryClient): void {
  const oneDay = 24 * 60 * 60 * 1000;
  const portfolioDefaults = {
    staleTime: marketplaceRqPolicy.portfolioDailyStaleMs,
    gcTime: oneDay,
    refetchOnMount: false as const,
    refetchOnWindowFocus: false as const,
    refetchOnReconnect: false as const,
  };
  queryClient.setQueryDefaults(["rwa-tokens"], {
    staleTime: marketplaceRqPolicy.rwaTokensStaleMs,
    gcTime: oneDay,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
  queryClient.setQueryDefaults(["portfolio-assets-page"], portfolioDefaults);
  queryClient.setQueryDefaults(["portfolio-daily-snapshots"], portfolioDefaults);
  queryClient.setQueryDefaults(["portfolio-activity"], portfolioDefaults);
  queryClient.setQueryDefaults(["orders", "by-offerer"], {
    staleTime: marketplaceRqPolicy.ordersStaleMs,
    gcTime: oneDay,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * Restore portfolio React Query cache from localStorage after mount.
 * Stale bundles trigger a background refetch without blocking paint.
 */
export function hydratePortfolioQueries(queryClient: QueryClient): void {
  if (typeof window === "undefined") return;
  configurePortfolioQueryDefaults(queryClient);

  const bundles = readAllPortfolioBundles();
  for (const bundle of bundles) {
    hydrateBundle(queryClient, bundle);
    const address = bundle.address.trim().toLowerCase();
    const chainId = bundle.chainId;
    const ageMs = Date.now() - bundle.savedAt;
    if (ageMs > marketplaceRqPolicy.rwaTokensStaleMs) {
      void queryClient.invalidateQueries({
        queryKey: rq.rwaTokens(address, chainId),
      });
    }
    if (ageMs > marketplaceRqPolicy.portfolioDailyStaleMs) {
      void queryClient.invalidateQueries({
        queryKey: rq.portfolioDailySnapshots(address, chainId),
      });
      void queryClient.invalidateQueries({
        queryKey: ["portfolio-assets-page", address, chainId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["cardhedger-mint-previews", chainId, address],
      });
    }
    if (ageMs > marketplaceRqPolicy.ordersStaleMs) {
      void queryClient.invalidateQueries({
        queryKey: rq.ordersByOfferer(address, "ask", chainId),
      });
    }
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function collectPortfolioWallets(
  queryClient: QueryClient,
): Array<{ address: string; chainId: number }> {
  const seen = new Set<string>();
  const wallets: Array<{ address: string; chainId: number }> = [];

  const add = (chainId: number, address: string) => {
    const normalized = address.trim().toLowerCase();
    if (!normalized || !Number.isFinite(chainId)) return;
    const key = `${chainId}:${normalized}`;
    if (seen.has(key)) return;
    seen.add(key);
    wallets.push({ address: normalized, chainId });
  };

  for (const [queryKey] of queryClient.getQueriesData<number[]>({
    queryKey: ["rwa-tokens"],
  })) {
    if (!Array.isArray(queryKey) || queryKey.length < 3) continue;
    add(Number(queryKey[1]), String(queryKey[2] ?? ""));
  }

  for (const [queryKey] of queryClient.getQueriesData<PortfolioAssetsPageResponse>({
    queryKey: ["portfolio-assets-page-bootstrap"],
  })) {
    if (!Array.isArray(queryKey) || queryKey.length < 3) continue;
    add(Number(queryKey[2]), String(queryKey[1] ?? ""));
  }

  return wallets;
}

function flushPortfolioWallet(
  queryClient: QueryClient,
  address: string,
  chainId: number,
): void {
  const tokenIds =
    queryClient.getQueryData<number[]>(rq.rwaTokens(address, chainId)) ?? [];

  const daily = queryClient.getQueryData<{
    items: PortfolioDailySnapshotItem[];
    latest24h: { pnlUsd: number | null; pnlPct: number | null };
  }>(rq.portfolioDailySnapshots(address, chainId));

  const ordersAsk = queryClient.getQueryData<OrderListItem[]>(
    rq.ordersByOfferer(address, "ask", chainId),
  );

  const bootstrapPage = queryClient.getQueryData<PortfolioAssetsPageResponse>(
    rq.portfolioAssetsPageBootstrap(address, chainId),
  );

  const assetsPageRows = queryClient.getQueriesData<PortfolioAssetsPageResponse>({
    queryKey: ["portfolio-assets-page", address, chainId],
  });

  const metadataItems: PersistedPortfolioBundle["metadataItems"] = [];
  const collectionKeys: Record<number, string> = {};
  const marketByKey = new Map<string, PortfolioMarketBatchItem>();
  const holdings: PortfolioHoldingBatchItem[] = [];
  const fetchedSet = new Set<number>();

  const mergeAssetsPage = (page: PortfolioAssetsPageResponse | undefined) => {
    if (!page) return;
    for (const it of page.metadataItems) {
      fetchedSet.add(it.tokenId);
      metadataItems.push({
        tokenId: it.tokenId,
        metadata: it.metadata,
        imageUrl: it.imageUrl,
      });
    }
    Object.assign(collectionKeys, page.collectionKeys);
    for (const m of page.marketItems) {
      marketByKey.set(m.collectionKey.toLowerCase(), m);
    }
    for (const h of page.holdings) {
      holdings.push(h);
    }
  };

  mergeAssetsPage(bootstrapPage);

  for (const [, page] of assetsPageRows) {
    mergeAssetsPage(page);
  }

  const fetchedTokenIds = [...fetchedSet].sort((a, b) => a - b);
  const existing = readPortfolioBundle(address, chainId);

  const resolvedTokenIds =
    bootstrapPage?.ownedTokenIds?.length
      ? bootstrapPage.ownedTokenIds
      : tokenIds.length > 0
        ? tokenIds
        : (existing?.tokenIds ?? []);

  let mintPreviews: Record<number, CollectionMarketPreview> =
    existing?.mintPreviews ?? {};
  let unmatchedMintTokenIds = existing?.unmatchedMintTokenIds ?? [];

  const mintRows = queryClient.getQueriesData<Record<number, CollectionMarketPreview>>({
    queryKey: ["cardhedger-mint-previews", chainId, address],
  });
  for (const [, previews] of mintRows) {
    if (!previews) continue;
    mintPreviews = { ...mintPreviews, ...previews };
    unmatchedMintTokenIds = [
      ...new Set([
        ...unmatchedMintTokenIds,
        ...Object.keys(previews).map((k) => Number(k)),
      ]),
    ].filter((n) => Number.isFinite(n));
  }

  const bffLoadedCount =
    existing?.bffLoadedCount ??
    Math.max(fetchedTokenIds.length, 0);

  writePortfolioBundle({
    address,
    chainId,
    tokenIds: resolvedTokenIds,
    bffLoadedCount,
    fetchedTokenIds,
    metadataItems,
    collectionKeys,
    marketItems: [...marketByKey.values()],
    holdings,
    mintPreviews,
    unmatchedMintTokenIds,
    dailySnapshots: daily ?? existing?.dailySnapshots,
    ordersAsk: ordersAsk ?? existing?.ordersAsk,
  });
}

function flushPortfolioFromQueryClient(queryClient: QueryClient): void {
  for (const { address, chainId } of collectPortfolioWallets(queryClient)) {
    flushPortfolioWallet(queryClient, address, chainId);
  }
}

function schedulePortfolioPersist(queryClient: QueryClient): void {
  if (persistTimer != null) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    flushPortfolioFromQueryClient(queryClient);
  }, 1400);
}

/** Subscribe to portfolio-related query updates; debounced writes to localStorage. */
export function subscribePortfolioPersistence(
  queryClient: QueryClient,
): () => void {
  return queryClient.getQueryCache().subscribe((event) => {
    const key = event.query?.queryKey;
    if (!Array.isArray(key)) return;
    const root = key[0];
    if (
      root === "rwa-tokens" ||
      root === "portfolio-assets-page" ||
      root === "portfolio-assets-page-bootstrap" ||
      root === "portfolio-daily-snapshots" ||
      root === "portfolio-activity" ||
      root === "cardhedger-mint-previews" ||
      (root === "orders" && key[1] === "by-offerer")
    ) {
      schedulePortfolioPersist(queryClient);
    }
  });
}

let persistAccumulatedTimer: ReturnType<typeof setTimeout> | null = null;

/** Merge hook-local accumulated state into the persisted bundle (mint previews, page size). */
export function persistPortfolioAccumulated(input: {
  address: string;
  chainId: number;
  tokenIds: number[];
  bffLoadedCount: number;
  fetchedTokenIds: number[];
  metadataItems: PersistedPortfolioBundle["metadataItems"];
  collectionKeys: Record<number, string>;
  marketItems: PortfolioMarketBatchItem[];
  holdings: PortfolioHoldingBatchItem[];
  mintPreviews: Record<number, CollectionMarketPreview>;
  unmatchedMintTokenIds: number[];
}): void {
  if (persistAccumulatedTimer != null) clearTimeout(persistAccumulatedTimer);
  persistAccumulatedTimer = setTimeout(() => {
    persistAccumulatedTimer = null;
    const address = input.address.trim().toLowerCase();
    const existing = readPortfolioBundle(address, input.chainId);
    writePortfolioBundle({
      address,
      chainId: input.chainId,
      tokenIds: input.tokenIds,
      bffLoadedCount: input.bffLoadedCount,
      fetchedTokenIds: input.fetchedTokenIds,
      metadataItems: input.metadataItems,
      collectionKeys: input.collectionKeys,
      marketItems: input.marketItems,
      holdings: input.holdings,
      mintPreviews: input.mintPreviews,
      unmatchedMintTokenIds: input.unmatchedMintTokenIds,
      dailySnapshots: existing?.dailySnapshots,
      ordersAsk: existing?.ordersAsk,
    });
  }, 400);
}

export function readPortfolioBffLoadedCount(
  address: string | undefined,
  chainId: number,
  pageSize: number,
): number {
  if (!address?.trim()) return pageSize;
  const bundle = readPortfolioBundle(address, chainId);
  if (!bundle) return pageSize;
  return Math.max(pageSize, bundle.bffLoadedCount, bundle.fetchedTokenIds.length);
}

export function accumulatedFromPortfolioBundle(
  bundle: PersistedPortfolioBundle,
): {
  fetchedTokenIds: number[];
  metadataByToken: Map<
    number,
    { tokenId: number; metadata: RwaMetadata | null; imageUrl: string | null }
  >;
  collectionKeys: Record<number, string>;
  marketItems: PortfolioMarketBatchItem[];
  holdingsByToken: Map<number, PortfolioHoldingBatchItem>;
  mintPreviews: Record<number, CollectionMarketPreview>;
} {
  const metadataByToken = new Map<
    number,
    { tokenId: number; metadata: RwaMetadata | null; imageUrl: string | null }
  >();
  for (const it of bundle.metadataItems) {
    metadataByToken.set(it.tokenId, {
      tokenId: it.tokenId,
      metadata: it.metadata,
      imageUrl: it.imageUrl,
    });
  }
  const holdingsByToken = new Map<number, PortfolioHoldingBatchItem>();
  for (const h of bundle.holdings) {
    holdingsByToken.set(h.tokenId, h);
  }
  return {
    fetchedTokenIds: [...bundle.fetchedTokenIds],
    metadataByToken,
    collectionKeys: { ...bundle.collectionKeys },
    marketItems: [...bundle.marketItems],
    holdingsByToken,
    mintPreviews: { ...bundle.mintPreviews },
  };
}

/** Active chain helper for hooks that run before AppChain hydrates. */
export function portfolioPersistenceChainId(): number {
  return activeRqChainId();
}
