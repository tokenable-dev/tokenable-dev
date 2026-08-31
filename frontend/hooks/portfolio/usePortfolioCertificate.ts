"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getActiveOrderForToken,
  getRwaSettlementPolicy,
  getRwaTokenTrades,
  getRwaTokensByOwner,
  marketplaceRqPolicy,
  postPortfolioCollectionMarketBatch,
  postPortfolioHoldingsBatch,
  postResolveMediaUrls,
  postTokenCollectionKeysByTokenIds,
  postBatchMintMarketPreviews,
  rq,
  type CollectionPlatformTapeFill,
  type RwaMetadata,
} from "@/lib/core";
import {
  SUPPORTED_CHAIN_IDS,
  activeRqChainId,
  getChainContracts,
  getChainDefinition,
  type SupportedChainId,
} from "@/lib/chains";
import { useLinkedPortfolioWallet } from "@/hooks/auth/useLinkedPortfolioWallet";
import { useRwaDetailMetadata } from "@/hooks/rwa-detail/useRwaDetailMetadata";
import {
  marketHistoryTierFromRwaMetadata,
  marketTierDisplayLabel,
  resolveExternalMarketUsd,
} from "@/lib/market";
import { countableTapeFills } from "@/lib/market/tradesVolume";
import {
  buildRwaAssetDetailHeadlineParts,
  formatAssetDetailHeadlineText,
} from "@/lib/marketplace/assetDetailHeadline";
import { displayAssetNameFromMetadata, stripGradeQualifierFromDisplayName } from "@/lib/marketplace/rwaDisplayTitle";
import {
  buildRwaDetailMobileTrustView,
  extractGradedSlabBackCandidate,
  formatRwaDetailCardIdLine,
  formatRwaDetailSetDescription,
} from "@/lib/marketplace/rwa-detail";
import {
  formatPortfolioGradeLabel,
  formatPortfolioGradeSubtitle,
  gradeScoreFromMetadata,
  marketTierComponentsFromMetadata,
  pickPortfolioMarketPreview,
} from "@/lib/portfolio/portfolioAssetMeta";
import {
  certNumberFromMetadata,
  isRedeemInFlight,
  redeemSurfaceBadge,
} from "@/lib/portfolio/redeemDraft";
import { useMyRedemptions } from "@/hooks/portfolio/useMyRedemptions";
import { PORTFOLIO_USDC_DECIMALS } from "@/lib/portfolio/buildPortfolioPricedRows";

export type CertHistoryNode = {
  id: string;
  label: string;
  detail: string;
  amount: string | null;
  highlight: boolean;
  you: boolean;
};

/** Join fragments with `·`, dropping any already visible on the lines above. */
function dedupeSubjectFragments(
  fragments: (string | null | undefined)[],
  alreadyShown: (string | null | undefined)[],
): string {
  const shown = alreadyShown
    .map((s) => s?.trim().toLowerCase())
    .filter(Boolean)
    .join(" · ");
  const out: string[] = [];
  for (const raw of fragments) {
    const value = raw?.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (shown.includes(key)) continue;
    if (out.some((prev) => prev.toLowerCase() === key)) continue;
    out.push(value);
  }
  return out.join(" · ");
}

export function usePortfolioCertificate(tokenId: number, tokenIdOk: boolean) {
  const wallet = useLinkedPortfolioWallet();
  const chainId = activeRqChainId();
  const { metadata, imageUrl, metaLoading } = useRwaDetailMetadata(tokenId, tokenIdOk);

  const ownedQuery = useQuery({
    queryKey: rq.rwaTokens(wallet.portfolioAddress ?? "", chainId),
    queryFn: () => getRwaTokensByOwner(wallet.portfolioAddress!),
    enabled: tokenIdOk && Boolean(wallet.portfolioAddress),
    staleTime: marketplaceRqPolicy.metadataBatchStaleMs,
  });

  const isOwner = Boolean(
    ownedQuery.data?.some((id) => Number(id) === tokenId),
  );

  const holdingsQuery = useQuery({
    queryKey: rq.portfolioHoldings(
      wallet.portfolioAddress ?? "",
      [tokenId],
      chainId,
    ),
    queryFn: () => postPortfolioHoldingsBatch(wallet.portfolioAddress!, [tokenId]),
    enabled: tokenIdOk && Boolean(wallet.portfolioAddress),
    staleTime: marketplaceRqPolicy.metadataBatchStaleMs,
  });

  const holding = holdingsQuery.data?.items?.[0] ?? null;

  const vaultQuery = useQuery({
    queryKey: ["rwa-settlement-policy", chainId, tokenId],
    queryFn: () => getRwaSettlementPolicy(tokenId),
    enabled: tokenIdOk,
    staleTime: 60_000,
  });

  const keysQuery = useQuery({
    queryKey: ["token-collection-key", chainId, tokenId],
    queryFn: async () => {
      const map = await postTokenCollectionKeysByTokenIds([tokenId]);
      return map[tokenId]?.trim().toLowerCase() || null;
    },
    enabled: tokenIdOk,
    staleTime: 60_000,
  });

  const collectionKey = keysQuery.data ?? null;

  const marketQuery = useQuery({
    queryKey: ["portfolio-cert-market", chainId, collectionKey],
    queryFn: () =>
      postPortfolioCollectionMarketBatch({
        collectionKeys: [collectionKey!],
        priceHistoryDuration: "365d",
      }),
    enabled: Boolean(collectionKey),
    staleTime: marketplaceRqPolicy.snapshotsStaleMs,
  });

  const series = marketQuery.data?.items?.[0]?.series ?? null;
  const snapshotMatched = Boolean(
    series?.cardhedgerPreview?.matched && series.cardhedgerPreview.card,
  );

  const mintPreviewQuery = useQuery({
    queryKey: rq.marketMintPreviews(wallet.portfolioAddress, [tokenId], chainId),
    queryFn: () => postBatchMintMarketPreviews([tokenId]),
    enabled:
      tokenIdOk &&
      keysQuery.isFetched &&
      (!collectionKey || (marketQuery.isFetched && !snapshotMatched)),
    staleTime: marketplaceRqPolicy.cardhedgerStaleMs,
  });

  const mintPreview = mintPreviewQuery.data?.[tokenId] ?? null;

  const ordersQuery = useQuery({
    queryKey: rq.orderByToken(tokenId),
    queryFn: () => getActiveOrderForToken(tokenId),
    enabled: tokenIdOk,
    staleTime: marketplaceRqPolicy.ordersStaleMs,
  });

  const listing = useMemo(() => {
    const addr = wallet.portfolioAddress?.toLowerCase() ?? "";
    const found = ordersQuery.data;
    if (
      !found ||
      found.status !== "active" ||
      (found.side ?? "ask") !== "ask" ||
      (found.offerer?.trim().toLowerCase() ?? "") !== addr
    ) {
      return null;
    }
    return {
      priceUsd: Number(found.considerationAmount) / PORTFOLIO_USDC_DECIMALS,
      orderHash: found.orderHash,
    };
  }, [ordersQuery.data, wallet.portfolioAddress]);

  const gradeLabel = useMemo(() => {
    if (!metadata) return undefined;
    return marketTierDisplayLabel(marketHistoryTierFromRwaMetadata(metadata));
  }, [metadata]);

  const tradesQuery = useQuery({
    queryKey: rq.rwaTokenTrades(tokenId, chainId, gradeLabel),
    queryFn: () => getRwaTokenTrades(tokenId, { grade: gradeLabel }),
    enabled: tokenIdOk,
    staleTime: marketplaceRqPolicy.snapshotsStaleMs,
  });

  const backCandidate = useMemo(() => resolveSlabBackCandidate(metadata), [metadata]);
  const backNeedsGateway = Boolean(
    backCandidate?.startsWith("ipfs://") || backCandidate?.startsWith("ipfs:/"),
  );
  const backResolved = useQuery({
    queryKey: rq.rwaSlabBack(backCandidate ?? ""),
    queryFn: () => postResolveMediaUrls([backCandidate!]),
    enabled: Boolean(backCandidate && backNeedsGateway),
    staleTime: marketplaceRqPolicy.mediaStaleMs,
  });

  const backUrl = useMemo(() => {
    if (!backCandidate) return null;
    if (backCandidate.startsWith("//")) return `https:${backCandidate}`;
    if (/^https?:\/\//i.test(backCandidate)) return backCandidate;
    if (!backNeedsGateway) return null;
    return backResolved.data?.items?.[0]?.httpsUrl ?? null;
  }, [backCandidate, backNeedsGateway, backResolved.data?.items]);

  const chain = useMemo(() => {
    const id = chainId as SupportedChainId;
    if (!SUPPORTED_CHAIN_IDS.includes(id)) return null;
    try {
      return {
        def: getChainDefinition(id),
        contracts: getChainContracts(id),
      };
    } catch {
      return null;
    }
  }, [chainId]);

  const headlineParts = useMemo(
    () => buildRwaAssetDetailHeadlineParts(metadata, `RWA #${tokenId}`),
    [metadata, tokenId],
  );
  /** Modal / redeem-draft title — same `name · number` form as portfolio rows. */
  const displayName = stripGradeQualifierFromDisplayName(
    formatAssetDetailHeadlineText(headlineParts) ||
      displayAssetNameFromMetadata(metadata, `RWA #${tokenId}`),
  );

  /**
   * Subject block = character heading, then one meta line joining `year set`
   * with `variety · number`. Each fragment appears once, so the card number
   * lives on the meta line instead of repeating in the heading.
   */
  const nameLine = stripGradeQualifierFromDisplayName(
    headlineParts.cardName?.trim() ||
      displayAssetNameFromMetadata(metadata, `RWA #${tokenId}`),
  );
  const setLine =
    formatRwaDetailSetDescription(metadata) ||
    [headlineParts.year, headlineParts.setName]
      .map((s) => s?.trim())
      .filter(Boolean)
      .join(" · ") ||
    null;
  const idLine = dedupeSubjectFragments(
    [headlineParts.variety, formatRwaDetailCardIdLine(metadata)],
    [nameLine, setLine],
  );

  const trust = buildRwaDetailMobileTrustView(metadata);
  const gradeChip = formatPortfolioGradeLabel(metadata);
  const gradeSub = formatPortfolioGradeSubtitle(metadata);
  const certNumber = certNumberFromMetadata(metadata) ?? trust.certNumber;
  const psaVerifyUrl =
    trust.certVerifyUrl ||
    (certNumber ? `https://www.psacard.com/cert/${encodeURIComponent(certNumber)}` : null);

  const preview = pickPortfolioMarketPreview(series, mintPreview);
  const resolvedMkt = resolveExternalMarketUsd({
    marketPreview: preview,
    gradePrices: series?.gradePrices ?? null,
    gradeScore: gradeScoreFromMetadata(metadata),
    components: marketTierComponentsFromMetadata(metadata),
    spotPriceBasis: series?.spotPriceBasis ?? preview?.card?.spotPriceBasis ?? null,
  });
  const marketUsd =
    resolvedMkt.usd != null && Number.isFinite(resolvedMkt.usd) && resolvedMkt.usd > 0
      ? resolvedMkt.usd
      : null;
  const mintChange =
    preview?.card?.gainPct30d ?? preview?.card?.gainPct7d ?? null;
  const marketChangePct =
    series?.marketChangePct ??
    (typeof mintChange === "number" && Number.isFinite(mintChange)
      ? mintChange
      : null);

  const vaultLabel = vaultQuery.data?.vaultLabel ?? "PSA Vault";
  const listed = listing != null;

  const redemptions = useMyRedemptions(tokenIdOk);
  const redeemStatus = redemptions.redeemStatusByTokenId.get(tokenId) ?? null;
  const redeemBadge = redeemSurfaceBadge(
    redeemStatus,
    redemptions.redeemTrackingByTokenId.get(tokenId),
    redemptions.redeemCarrierDeliveredByTokenId.get(tokenId),
  );
  /** Custody holds the NFT while a redemption runs, so the wallet check alone under-reports. */
  const redeemInFlight = isRedeemInFlight(redeemStatus);

  const statusLine = ownedQuery.isLoading
    ? "…"
    : redeemBadge
      ? `● ${redeemBadge.label}`
      : isOwner
        ? listed
          ? "● Owned · listed"
          : "● Owned · in vault"
        : wallet.portfolioAddress
          ? "Not in this wallet"
          : "Connect wallet";

  const explorerUrl = useMemo(() => {
    if (!chain) return null;
    const rwa = chain.contracts.rwaAddress;
    const base = chain.def.explorerBaseUrl.replace(/\/$/, "");
    return `${base}/token/${rwa}?a=${tokenId}`;
  }, [chain, tokenId]);

  const chainLine = chain
    ? `${chain.def.shortLabel} · ${formatExplorerShort(chain.contracts.rwaAddress)} · token #${tokenId}`
    : `token #${tokenId}`;

  const trades = useMemo((): CollectionPlatformTapeFill[] => {
    return [...countableTapeFills(tradesQuery.data?.trades ?? [])]
      .filter((t) => t.source !== "cardhedger")
      .sort((a, b) => a.t - b.t);
  }, [tradesQuery.data?.trades, tokenId]);

  const history: CertHistoryNode[] = useMemo(() => {
    const nodes: CertHistoryNode[] = [];
    if (holding?.acquiredAt) {
      const buy = holding.costBasisSource === "marketplace_buy";
      nodes.push({
        id: "acquired",
        label: buy ? "You bought it" : "Acquired",
        detail: formatHistDate(holding.acquiredAt),
        amount:
          holding.costBasisUsd != null
            ? `$${Math.round(holding.costBasisUsd).toLocaleString("en-US")}`
            : null,
        highlight: buy,
        you: buy,
      });
    }
    for (const t of trades) {
      if (t.source === "cardhedger") continue;
      const d = new Date(t.t * 1000);
      nodes.push({
        id: t.orderHash || String(t.t),
        label: t.tapeAggressor === "buy" ? "Sold on Tokenable" : "Matched on Tokenable",
        detail: formatHistDate(d.toISOString()),
        amount: `$${Math.round(t.priceUsdc).toLocaleString("en-US")}`,
        highlight: false,
        you: false,
      });
    }
    return nodes;
  }, [holding, trades]);

  return {
    tokenId,
    tokenIdOk,
    metaLoading,
    metadata: metadata as RwaMetadata | null,
    imageUrl,
    backUrl,
    displayName,
    nameLine,
    setLine,
    idLine,
    gradeChip,
    gradeSub,
    certNumber,
    psaVerifyUrl,
    isOwner,
    ownerLoading: ownedQuery.isLoading,
    walletAddress: wallet.portfolioAddress,
    holding,
    vaultLabel,
    listed,
    listing,
    redeemBadge,
    redeemInFlight,
    statusLine,
    collectionKey,
    marketUsd,
    marketChangePct,
    chainLine,
    explorerUrl,
    chainLabel: chain?.def.shortLabel ?? null,
    history,
    tradesLoading: tradesQuery.isLoading,
    canSign: wallet.canSign,
    assetMissing: Boolean(
      tokenIdOk && !metaLoading && !imageUrl && !metadata,
    ),
  };
}

export type PortfolioCertificateModel = ReturnType<typeof usePortfolioCertificate>;

/**
 * Mint JSON keeps `graded` under `properties`, but older uploads and the
 * sell-flow payload put it at the root — check both before giving up.
 */
function resolveSlabBackCandidate(meta: RwaMetadata | null): string | null {
  if (!meta) return null;
  const fromProperties = extractGradedSlabBackCandidate(meta);
  if (fromProperties) return fromProperties;
  const rootGraded = (meta as RwaMetadata & { graded?: unknown }).graded;
  if (!rootGraded || typeof rootGraded !== "object") return null;
  return extractGradedSlabBackCandidate({ properties: { graded: rootGraded } });
}

function formatExplorerShort(addr: string): string {
  const a = addr.trim();
  if (a.length < 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function formatHistDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
