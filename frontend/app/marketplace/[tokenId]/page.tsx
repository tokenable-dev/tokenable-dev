"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useReadContract, usePublicClient, useWriteContract, useConnect } from "wagmi";
import type { Address } from "viem";
import { sepolia } from "@/config/wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useShallow } from "zustand/react/shallow";
import {
  getActiveOrderForToken,
  getResolvedRwaAsset,
  getMarketplaceCollectionDetailOrNull,
  postMarketplaceCollectionSnapshotsBatched,
  rq,
  marketplaceRqPolicy,
  type CollectionListMarketSnapshot,
} from "@/lib/core";
import {
  parseGradeScoreNumber,
  representativeGradeUsd,
  formatUsdCompact,
} from "@/lib/market";
import {
  RwaDetailAssetPanel,
  buildRwaDetailStatRows,
  formatRwaSetHeadline,
  type RwaDetailMetadata,
} from "@/components/marketplace/RwaDetailAssetPanel";
import { displayAssetNameFromMetadata } from "@/lib/marketplace/rwaDisplayTitle";
import {
  TOKENABLE_RWA_ADDRESS,
  TOKENABLE_RWA_DISPLAY_NAME,
  TOKENABLE_RWA_READ_ABI,
} from "@/constants/contracts";
import {
  TradeCelebrationModal,
  type TradeCelebrationKind,
} from "@/components/marketplace/TradeCelebrationModal";

/** Huge modal (Seaport/wagmi) — load only when opened to shrink initial `[tokenId]` compile + main-thread work */
const ListRwaModal = dynamic(
  () =>
    import("@/components/marketplace/ListRwaModal").then((m) => ({
      default: m.ListRwaModal,
    })),
  { ssr: false },
);
import {
  computeMarketBucketKey,
  extractBucketComponentsFromMetadata,
} from "@/lib/marketplace/bucketKey";
import { useAppStore, selectWallet } from "@/store";
import { IBM_Plex_Sans } from "next/font/google";
import { fulfillAskListingOrder } from "@/lib/seaport/orders/fulfillAskListing";
import { mapWalletError } from "@/lib/network";

const rwaDetailRightFont = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

const DETAIL_CTA_RIM =
  "linear-gradient(99.67deg, #7AE838 2%, #B4FF72 42%, #87FF48 68%, #5BC420 100%)";

const DETAIL_CTA_RIM_BRIGHT =
  "linear-gradient(99.67deg, #9AFF5C 0%, #D4FF8A 38%, #87FF48 68%, #6FE832 100%)";

function DetailGradientButton({
  children,
  onClick,
  disabled,
  className = "",
  bright = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  /** Brighter rim + glow — used for Connect wallet CTA */
  bright?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{ background: bright ? DETAIL_CTA_RIM_BRIGHT : DETAIL_CTA_RIM }}
      className={`group/cta relative z-[1] box-border flex h-[60px] w-full min-w-0 max-w-full items-center justify-center rounded-full p-[3px] text-center transition-[transform,box-shadow,opacity] duration-200 ease-out [-webkit-tap-highlight-color:transparent] enabled:hover:-translate-y-px enabled:active:translate-y-0 enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none sm:h-[68px] sm:p-1 ${
        bright
          ? "shadow-[0_10px_28px_-10px_rgba(0,0,0,0.75),0_0_40px_-4px_rgba(135,255,72,0.58)] enabled:hover:shadow-[0_12px_32px_-10px_rgba(0,0,0,0.82),0_0_48px_-2px_rgba(167,255,96,0.65)]"
          : "shadow-[0_8px_24px_-10px_rgba(0,0,0,0.75),0_0_24px_-8px_rgba(135,255,72,0.35)] enabled:hover:shadow-[0_10px_28px_-10px_rgba(0,0,0,0.8),0_0_28px_-6px_rgba(135,255,72,0.45)]"
      } ${className}`}
    >
      <span
        className={`${rwaDetailRightFont.className} flex h-full min-h-0 w-full min-w-0 items-center justify-center rounded-full px-6 text-[18px] font-bold leading-none tracking-normal text-white transition-[background-color] duration-200 sm:px-10 sm:text-[20px] ${
          bright
            ? "bg-[#0d100c] group-hover/cta:bg-[#111612]"
            : "bg-[#0b0d10] group-hover/cta:bg-[#101318]"
        }`}
      >
        {children}
      </span>
    </button>
  );
}

function connectMetaMaskWallet(
  connect: ReturnType<typeof useConnect>["connect"],
  connectors: ReturnType<typeof useConnect>["connectors"],
) {
  const metaMaskConnector = connectors.find((c) => c.name === "MetaMask");
  if (metaMaskConnector) connect({ connector: metaMaskConnector });
}

/** Full-width market context when there is no Tokenable list price to anchor the page. */
function MarketContextStrip({
  externalRefUsd,
  marketChangePct,
}: {
  externalRefUsd: number | null;
  marketChangePct: number | null;
}) {
  if (externalRefUsd == null && marketChangePct == null) return null;
  const changeUp = marketChangePct != null && marketChangePct > 0;
  const changeDown = marketChangePct != null && marketChangePct < 0;
  const showRef = externalRefUsd != null;
  const showChange = marketChangePct != null && Number.isFinite(marketChangePct);

  return (
    <div
      className={`grid gap-3 rounded-xl border border-zinc-700/55 bg-gradient-to-br from-zinc-900/80 to-[#0a0c0f] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_24px_-16px_rgba(0,0,0,0.65)] sm:gap-4 sm:p-4 ${
        showRef && showChange ? "grid-cols-2" : "grid-cols-1"
      }`}
    >
      {showRef ? (
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500 sm:text-[11px]">
            eBay reference
          </p>
          <p
            className={`${rwaDetailRightFont.className} mt-2 text-[1.35rem] font-bold leading-none tabular-nums text-[#87FF48] sm:mt-2.5 sm:text-2xl`}
          >
            {formatUsdCompact(externalRefUsd)}
          </p>
        </div>
      ) : null}
      {showChange ? (
        <div
          className={`min-w-0 ${showRef ? "border-l border-zinc-700/60 pl-3 sm:pl-4" : ""}`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500 sm:text-[11px]">
            1yr change
          </p>
          <p
            className={`${rwaDetailRightFont.className} mt-2 text-[1.35rem] font-bold leading-none tabular-nums sm:mt-2.5 sm:text-2xl ${
              changeUp ? "text-mint" : changeDown ? "text-rose-400" : "text-zinc-200"
            }`}
          >
            {marketChangePct! > 0 ? "+" : ""}
            {marketChangePct!.toFixed(1)}%
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ListPriceDisplay({ priceUsd }: { priceUsd: number }) {
  const priceStr = priceUsd.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  return (
    <p
      className={`${rwaDetailRightFont.className} text-[clamp(2.25rem,8vw,3.25rem)] font-bold leading-none tracking-tight text-white tabular-nums sm:text-[3.25rem]`}
    >
      ${priceStr}
    </p>
  );
}

type BuyerTradingPanelProps = {
  isConnected: boolean;
  buyBusy: boolean;
  listingPriceUsd: number | null;
  buyErr: string | null;
  onFulfill: () => void | Promise<void>;
};

function BuyerTradingPanel({
  isConnected,
  buyBusy,
  listingPriceUsd,
  buyErr,
  onFulfill,
}: BuyerTradingPanelProps) {
  const { connect, connectors, isPending: connectPending } = useConnect();

  const cta = !isConnected
    ? connectPending
      ? "Connecting…"
      : "Connect wallet"
    : buyBusy
      ? "Buying…"
      : "Buy";

  return (
    <div className="space-y-5 sm:space-y-6">
      {listingPriceUsd != null && Number.isFinite(listingPriceUsd) ? (
        <ListPriceDisplay priceUsd={listingPriceUsd} />
      ) : null}

      <DetailGradientButton
        bright={!isConnected}
        onClick={() => {
          if (!isConnected) {
            connectMetaMaskWallet(connect, connectors);
            return;
          }
          void onFulfill();
        }}
        disabled={connectPending || buyBusy}
      >
        {cta}
      </DetailGradientButton>

      {buyErr ? (
        <p className="text-xs text-red-400 leading-snug">{buyErr}</p>
      ) : null}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RwaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenId = Number(params.tokenId);

  const { address, isConnected } = useAppStore(useShallow(selectWallet));
  const { connect, connectors, isPending: connectPending } = useConnect();
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const { writeContractAsync } = useWriteContract();

  const queryClient = useQueryClient();

  const [listModalOpen, setListModalOpen] = useState(false);
  const [listModalInitialPrice, setListModalInitialPrice] = useState<string | null>(null);
  const [tradeCelebration, setTradeCelebration] = useState<TradeCelebrationKind | null>(null);
  const [buyBusy, setBuyBusy] = useState(false);
  const [buyErr, setBuyErr] = useState<string | null>(null);

  const tokenIdOk = Number.isFinite(tokenId) && tokenId >= 0;

  // ── Data fetching ──────────────────────────────────────────────────────────

  const {
    data: listing,
    isError: listingError,
  } = useQuery({
    queryKey: ["orders", "by-token-active", tokenId],
    queryFn: () => getActiveOrderForToken(tokenId),
    retry: 1,
    enabled: tokenIdOk,
  });

  const fromCollectionParam = searchParams.get("fromCollection")?.trim() ?? "";

  // Metadata + image via backend only (shared query key with collection cards).
  const { data: metaBundle, isLoading: metaLoading } = useQuery({
    queryKey: ["marketplace-detail-metadata", tokenId],
    queryFn: () => getResolvedRwaAsset(tokenId),
    enabled: tokenIdOk,
    staleTime: 60_000,
  });

  const metadataEarly = metaBundle?.metadata ?? null;

  const { data: metadataDerivedCollectionKey } = useQuery({
    queryKey: ["metadata-bucket-key", tokenId, metaBundle?.tokenURI],
    queryFn: async () => {
      const meta = metaBundle?.metadata;
      if (!meta) return null;
      const c = extractBucketComponentsFromMetadata(meta as Record<string, unknown>);
      if (!c) return null;
      return await computeMarketBucketKey(c);
    },
    enabled: tokenIdOk && !!metaBundle?.metadata,
    staleTime: 60_000,
  });

  const collectionKeyForMatch = useMemo(() => {
    const fromListing = listing?.collectionKey?.trim();
    if (fromListing) return fromListing;
    if (fromCollectionParam) return fromCollectionParam;
    return metadataDerivedCollectionKey ?? null;
  }, [listing?.collectionKey, fromCollectionParam, metadataDerivedCollectionKey]);

  const collectionKeyForRedirect = useMemo(() => {
    if (fromCollectionParam) return fromCollectionParam;
    if (listing?.collectionKey) return listing.collectionKey;
    return metadataDerivedCollectionKey ?? null;
  }, [fromCollectionParam, listing?.collectionKey, metadataDerivedCollectionKey]);

  const { data: collectionDetail } = useQuery({
    queryKey: ["marketplace-collection", collectionKeyForMatch],
    queryFn: () => getMarketplaceCollectionDetailOrNull(collectionKeyForMatch!),
    enabled: !!collectionKeyForMatch && tokenIdOk,
    staleTime: 15_000,
  });

  const collectionSnapshotKey = collectionKeyForMatch?.toLowerCase() ?? null;
  const { data: detailSnapshotPack } = useQuery({
    queryKey: rq.collectionSnapshots(
      collectionSnapshotKey ? [collectionSnapshotKey] : [],
      "365d",
    ),
    queryFn: () =>
      postMarketplaceCollectionSnapshotsBatched([collectionSnapshotKey!], "365d"),
    enabled: Boolean(collectionSnapshotKey && tokenIdOk),
    staleTime: marketplaceRqPolicy.snapshotsStaleMs,
  });

  const collectionSnapshot: CollectionListMarketSnapshot | undefined = useMemo(() => {
    if (!collectionSnapshotKey) return undefined;
    return detailSnapshotPack?.items?.find(
      (it) => it.collectionKey.toLowerCase() === collectionSnapshotKey,
    );
  }, [detailSnapshotPack?.items, collectionSnapshotKey]);

  const externalRefUsd = useMemo(() => {
    const comp = collectionDetail?.collection?.components as
      | { gradeScore?: string }
      | undefined;
    const usd = representativeGradeUsd(
      collectionSnapshot?.gradePrices ?? null,
      parseGradeScoreNumber(comp?.gradeScore),
      comp?.gradeScore,
    );
    return usd != null && Number.isFinite(usd) && usd > 0 ? usd : null;
  }, [collectionDetail?.collection?.components, collectionSnapshot?.gradePrices]);

  const marketChangePct = useMemo(() => {
    const pct = collectionSnapshot?.marketChangePct;
    return pct != null && Number.isFinite(pct) ? pct : null;
  }, [collectionSnapshot?.marketChangePct]);

  const navigateToCollectionAfterTrade = useCallback(() => {
    if (collectionKeyForRedirect) {
      router.replace(
        `/marketplace/collections/${encodeURIComponent(collectionKeyForRedirect)}`,
        { scroll: true },
      );
    } else {
      router.replace("/?tab=marketplace", { scroll: true });
    }
  }, [router, collectionKeyForRedirect]);

  const {
    data: ownerOnChain,
    isLoading: ownerLoading,
    isError: ownerError,
  } = useReadContract({
    address: TOKENABLE_RWA_ADDRESS,
    abi: TOKENABLE_RWA_READ_ABI,
    functionName: "ownerOf",
    args: [BigInt(Math.max(0, Math.floor(tokenId)))],
    chainId: sepolia.id,
    query: {
      enabled: tokenIdOk,
      retry: 2,
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      refetchInterval: false,
    },
  });

  const metadata = metadataEarly;

  const detailTitle = useMemo(
    () =>
      displayAssetNameFromMetadata(
        metadata as RwaDetailMetadata | null,
        `${TOKENABLE_RWA_DISPLAY_NAME} #${tokenId}`,
      ),
    [metadata, tokenId],
  );
  const detailSetHeadline = useMemo(
    () => formatRwaSetHeadline(metadata as RwaDetailMetadata | null),
    [metadata],
  );
  const detailTitlePulse =
    Boolean(metaLoading) && !metadata?.name?.trim();

  const rwaDetailStatRows = useMemo(
    () => buildRwaDetailStatRows(metadata as RwaDetailMetadata | null),
    [metadata],
  );

  // ── Buy (ask listing) ─────────────────────────────────────────────────────

  const isListingSeller =
    address?.toLowerCase() === listing?.offerer.toLowerCase();
  const collectionBids = collectionDetail?.collectionBids ?? [];

  const activeAskListing = useMemo(() => {
    if (!listing || listing.side === "bid") return null;
    return listing;
  }, [listing]);

  const listingBuyPriceUsdc = useMemo(() => {
    const raw = activeAskListing?.considerationAmount;
    if (raw == null || String(raw).trim() === "") return null;
    const n = Number(raw) / 1_000_000;
    return Number.isFinite(n) ? n : null;
  }, [activeAskListing?.considerationAmount]);

  const ownerAddr =
    typeof ownerOnChain === "string" ? ownerOnChain.toLowerCase() : "";
  const isOwner = !!(address && ownerAddr && address.toLowerCase() === ownerAddr);

  /** 컬렉션 카드에서 ?list=1 로 진입 시 판매 모달 자동 오픈 (소유자만). fromCollection 유지 */
  useEffect(() => {
    if (searchParams.get("list") !== "1") return;
    if (!tokenIdOk || ownerLoading) return;
    if (isOwner && isConnected) {
      setListModalInitialPrice(null);
      setListModalOpen(true);
    }
    const fc = searchParams.get("fromCollection");
    const next =
      fc && fc.trim()
        ? `/marketplace/${tokenId}?fromCollection=${encodeURIComponent(fc.trim())}`
        : `/marketplace/${tokenId}`;
    router.replace(next, { scroll: false });
  }, [
    searchParams,
    tokenIdOk,
    ownerLoading,
    isOwner,
    isConnected,
    tokenId,
    router,
  ]);

  async function invalidateMarketplaceQueries() {
    await queryClient.invalidateQueries({ queryKey: ["orders"] });
    await queryClient.invalidateQueries({ queryKey: ["orders", "by-token-active", tokenId] });
    await queryClient.invalidateQueries({
      queryKey: ["marketplace-detail-metadata", tokenId],
    });
    await queryClient.invalidateQueries({ queryKey: ["rwa-activity", tokenId] });
    /** 모든 지갑의 My Assets 목록·메타 (거래 후 판매자/구매자 캐시 동기화) */
    await queryClient.invalidateQueries({ queryKey: ["rwa-tokens"] });
    await queryClient.invalidateQueries({ queryKey: ["rwa-metadata-batch"] });
    await queryClient.invalidateQueries({ queryKey: ["marketplace-collection"] });
    if (collectionKeyForMatch) {
      await queryClient.invalidateQueries({
        queryKey: ["marketplace-collection", collectionKeyForMatch],
      });
      await queryClient.invalidateQueries({
        queryKey: ["collection-market-series", collectionKeyForMatch],
      });
      await queryClient.invalidateQueries({
        queryKey: ["collection-snapshots"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["portfolio-market-batch"],
      });
    }
  }

  async function handleFulfillAsk() {
    if (!activeAskListing || !address || !publicClient) return;
    setBuyErr(null);
    setBuyBusy(true);
    try {
      await fulfillAskListingOrder({
        ask: activeAskListing,
        address: address as Address,
        publicClient,
        writeContractAsync: writeContractAsync as Parameters<
          typeof fulfillAskListingOrder
        >[0]["writeContractAsync"],
        chainId: sepolia.id,
      });
      setTradeCelebration("purchase");
      await invalidateMarketplaceQueries();
      navigateToCollectionAfterTrade();
    } catch (e: unknown) {
      setBuyErr(mapWalletError(e).message);
    } finally {
      setBuyBusy(false);
    }
  }

  useEffect(() => {
    setBuyErr(null);
  }, [activeAskListing?.orderHash, address]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const imageUrl = metaBundle?.imageUrl ?? null;
  const isPageLoading = ownerLoading;
  const showMain = tokenIdOk && !ownerLoading && !ownerError && ownerOnChain != null;

  return (
    <div className="min-h-screen bg-[#07090c] text-white">
      <main className="mx-auto max-w-6xl px-3 py-6 max-[380px]:px-2.5 sm:px-5 sm:py-8 lg:px-6">
        {/* Loading */}
        {tokenIdOk && isPageLoading && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_minmax(280px,0.62fr)] lg:gap-x-10 items-start">
            <div className="space-y-4">
              <div className="aspect-[3/4] max-h-[min(76vh,700px)] sm:max-h-[min(78vh,760px)] w-full bg-gray-800/90 rounded-2xl animate-pulse" />
              <div className="h-8 w-3/4 bg-gray-800 rounded animate-pulse" />
              <div className="grid grid-cols-2 gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-14 bg-gray-800/80 rounded-xl animate-pulse" />
                ))}
              </div>
            </div>
            <div className="space-y-4">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-7 bg-gray-800 rounded animate-pulse"
                  style={{ width: `${80 - i * 8}%` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Invalid token */}
        {!tokenIdOk && (
          <div className="text-center py-24">
            <p className="text-xl font-semibold text-white mb-2">Invalid token</p>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              ← Back
            </button>
          </div>
        )}

        {/* Not minted / ownerOf reverted */}
        {tokenIdOk && !ownerLoading && ownerError && (
          <div className="text-center py-24">
            <p className="text-5xl mb-4">🔍</p>
            <p className="text-xl font-semibold text-white mb-2">Asset not found</p>
            <p className="text-gray-500 text-sm mb-6">
              This token ID does not exist on the current contract.
            </p>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              ← Back to Markets
            </button>
          </div>
        )}

        {/* Main content */}
        {showMain && (
          <>
            <div className="grid grid-cols-1 gap-y-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.62fr)] lg:gap-x-10 lg:gap-y-10 xl:gap-x-12 items-start">
              <div className="min-w-0 lg:col-start-1">
                <RwaDetailAssetPanel
                  metadata={metadata as RwaDetailMetadata | null}
                  imageUrl={imageUrl}
                  tokenId={tokenId}
                  collectionLabel={TOKENABLE_RWA_DISPLAY_NAME}
                  metaLoading={metaLoading}
                  hideHeaderOnXl
                />
              </div>

              {activeAskListing && !isOwner ? (
                <div className="min-w-0 lg:hidden">
                  <BuyerTradingPanel
                    isConnected={isConnected}
                    buyBusy={buyBusy}
                    listingPriceUsd={listingBuyPriceUsdc}
                    buyErr={buyErr}
                    onFulfill={handleFulfillAsk}
                  />
                </div>
              ) : null}

              <div className="flex w-full min-w-0 flex-col gap-6 sm:gap-7 lg:sticky lg:top-6 lg:col-start-2 lg:max-w-[400px] lg:justify-self-end lg:self-start">
                <div className="hidden lg:block space-y-2.5 min-w-0">
                  {detailTitlePulse ? (
                    <div
                      className="h-9 w-[min(100%,20rem)] max-w-full animate-pulse rounded-lg bg-gray-800/85"
                      aria-hidden
                    />
                  ) : (
                    <h1
                      className={`${rwaDetailRightFont.className} min-w-0 break-words text-[clamp(1.375rem,2.8vw,1.75rem)] font-bold leading-snug tracking-tight text-white [overflow-wrap:anywhere]`}
                    >
                      {detailTitle}
                    </h1>
                  )}
                  {detailSetHeadline ? (
                    <p
                      className={`${rwaDetailRightFont.className} text-[14px] font-normal leading-snug text-zinc-500`}
                    >
                      {detailSetHeadline}
                    </p>
                  ) : null}
                </div>

                {listingError ? (
                  <p className="text-xs text-orange-400">Could not load listing.</p>
                ) : null}

                {activeAskListing && !isOwner ? (
                  <div className="hidden lg:block">
                    <BuyerTradingPanel
                      isConnected={isConnected}
                      buyBusy={buyBusy}
                      listingPriceUsd={listingBuyPriceUsdc}
                      buyErr={buyErr}
                      onFulfill={handleFulfillAsk}
                    />
                  </div>
                ) : null}

                {isOwner ? (
                  <div className="w-full max-w-full space-y-5 sm:space-y-6">
                    {listing && listingBuyPriceUsdc != null ? (
                      <ListPriceDisplay priceUsd={listingBuyPriceUsdc} />
                    ) : null}
                    <DetailGradientButton
                      bright={!isConnected}
                      disabled={connectPending}
                      onClick={() => {
                        if (!isConnected) {
                          connectMetaMaskWallet(connect, connectors);
                          return;
                        }
                        setListModalInitialPrice(null);
                        setListModalOpen(true);
                      }}
                    >
                      {!isConnected
                        ? connectPending
                          ? "Connecting…"
                          : "Connect wallet"
                        : listing
                          ? "Manage listing"
                          : "List for sale"}
                    </DetailGradientButton>
                    {!listing ? (
                      <MarketContextStrip
                        externalRefUsd={externalRefUsd}
                        marketChangePct={marketChangePct}
                      />
                    ) : null}
                  </div>
                ) : null}

                {!activeAskListing && !isOwner ? (
                  <div className="space-y-5 sm:space-y-6">
                    <p className={`${rwaDetailRightFont.className} text-xl font-semibold text-zinc-400`}>
                      Not for sale
                    </p>
                    <MarketContextStrip
                      externalRefUsd={externalRefUsd}
                      marketChangePct={marketChangePct}
                    />
                  </div>
                ) : null}

                {rwaDetailStatRows.length > 0 ? (
                  <div
                    className={`hidden lg:block mt-10 border-t border-[rgba(38,39,45,1)] pt-8 ${rwaDetailRightFont.className}`}
                  >
                    <h2 className="text-[18px] font-bold leading-[140%] tracking-normal text-white">
                      Details
                    </h2>
                    <dl className="mt-5 flex flex-col gap-4">
                      {rwaDetailStatRows.map((row) => (
                        <div
                          key={row.label}
                          className="flex gap-4 items-baseline justify-between min-w-0"
                        >
                          <dt className="shrink-0 text-[15px] font-normal leading-[140%] text-[#a0a0a0]">
                            {row.label}
                          </dt>
                          <dd className="min-w-0 text-right text-[15px] font-medium leading-[140%] break-words text-white">
                            {row.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ) : null}
              </div>
            </div>

            <TradeCelebrationModal
              open={tradeCelebration != null}
              kind={tradeCelebration ?? "purchase"}
              onClose={() => setTradeCelebration(null)}
            />

            {listModalOpen && (
              <ListRwaModal
                tokenId={tokenId}
                collectionKey={collectionKeyForMatch ?? undefined}
                collectionBids={collectionBids}
                existingAskOrder={
                  listing && isListingSeller ? listing : undefined
                }
                initialPriceUsdc={listModalInitialPrice}
                onMatchedSale={() => setTradeCelebration("sale")}
                onClose={() => {
                  setListModalOpen(false);
                  setListModalInitialPrice(null);
                }}
                onListed={() => {
                  setListModalOpen(false);
                  setListModalInitialPrice(null);
                  void invalidateMarketplaceQueries();
                  navigateToCollectionAfterTrade();
                }}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
