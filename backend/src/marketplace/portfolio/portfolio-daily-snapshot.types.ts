import type { CollectionMarketBundle } from '../collections/collection-market.service';
import type { MarketCollectionPreview } from '../utils/market-reference.types';

/** On-chain owner → token ids held at scan time. */
export type HolderIndex = Map<string, number[]>;

/** Shared Cardhedger + metadata cache for one daily capture run. */
export type PortfolioPricingContext = {
  metaByToken: Map<number, Record<string, unknown>>;
  tokenToCollection: Map<number, string>;
  seriesByKey: Map<string, CollectionMarketBundle | null>;
  mintPreviews: Record<number, MarketCollectionPreview>;
};

export type PortfolioDailyCaptureChainResult = {
  chainId: number;
  totalMinted: number;
  onChainHolders: number;
  additionalZeroOrHistoricalWallets: number;
  walletsTargeted: number;
  snapshotsWritten: number;
  failed: number;
  pricingBatchKeys: number;
};

export type PortfolioDailyCaptureRunResult = {
  slotDateKst: string;
  slotAtIso: string;
  chains: PortfolioDailyCaptureChainResult[];
  snapshotsWritten: number;
  failed: number;
  durationMs: number;
};

/** Postgres advisory lock id for portfolio daily snapshot cron (single-flight). */
export const PORTFOLIO_SNAPSHOT_ADVISORY_LOCK_KEY = 73_482_901;
