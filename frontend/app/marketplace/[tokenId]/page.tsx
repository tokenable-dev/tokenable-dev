"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useReadContract, usePublicClient, useWriteContract } from "wagmi";
import type { Address } from "viem";
import { sepolia } from "@/config/wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useShallow } from "zustand/react/shallow";
import {
  getActiveOrderForToken,
  getResolvedRwaAsset,
  getMarketplaceCollectionDetailOrNull,
} from "@/lib/core";
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

type BuyerTradingPanelProps = {
  isConnected: boolean;
  buyBusy: boolean;
  listingPriceUsd: number | null;
  collectionPageHref: string | null;
  collectionLinkTitle: string | null;
  buyErr: string | null;
  onFulfill: () => void | Promise<void>;
  /** When false, omits collection / order-book row (desktop hero match). */
  showCollectionLink?: boolean;
};

const DETAIL_BUY_RIM =
  "linear-gradient(99.67deg, #529e22 3.64%, #87FF48 54%, #284214 112.88%)";

function BuyerTradingPanel({
  isConnected,
  buyBusy,
  listingPriceUsd,
  collectionPageHref,
  collectionLinkTitle,
  buyErr,
  onFulfill,
  showCollectionLink = true,
}: BuyerTradingPanelProps) {
  const priceStr =
    listingPriceUsd != null && Number.isFinite(listingPriceUsd)
      ? listingPriceUsd.toLocaleString("en-US", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })
      : null;
  const cta =
    !isConnected ? "Connect wallet" : buyBusy ? "Buying…" : "Buy";

  return (
    <div className="space-y-4">
      {priceStr != null ? (
        <p
          className={`${rwaDetailRightFont.className} mt-2 text-[clamp(2rem,11vw,54px)] font-semibold leading-[150%] tracking-normal text-white tabular-nums [overflow-wrap:anywhere] xl:mt-3 xl:text-[54px]`}
        >
          ${priceStr}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void onFulfill()}
        disabled={!isConnected || buyBusy}
        style={{ background: DETAIL_BUY_RIM }}
        className="group/cta relative z-[1] box-border flex h-[72px] w-full min-w-0 max-w-full items-center justify-center rounded-[44px] p-[2px] text-center shadow-[0_10px_28px_-10px_rgba(0,0,0,0.8)] transition-[transform,box-shadow,opacity] duration-200 ease-out [-webkit-tap-highlight-color:transparent] enabled:hover:-translate-y-0.5 enabled:hover:scale-[1.01] enabled:hover:shadow-[0_14px_36px_-12px_rgba(0,0,0,0.88),0_0_28px_-2px_rgba(135,255,72,0.28)] enabled:active:translate-y-0 enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none motion-reduce:enabled:hover:scale-100 motion-reduce:enabled:hover:translate-y-0"
      >
        <span
          className={`${rwaDetailRightFont.className} flex h-full min-h-0 w-full min-w-0 items-center justify-center gap-[10px] rounded-[42px] bg-[rgba(11,13,16,1)] px-12 py-4 text-[17px] font-bold leading-[140%] tracking-normal text-white transition-[background-color,box-shadow] duration-200 group-hover/cta:bg-[rgba(16,18,22,1)] group-hover/cta:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] group-active/cta:bg-[rgba(11,13,16,1)]`}
        >
          {cta}
        </span>
      </button>
      {collectionPageHref && showCollectionLink ? (
        <Link
          href={collectionPageHref}
          title={
            collectionLinkTitle
              ? `${collectionLinkTitle} — marketplace`
              : "Open marketplace collection"
          }
          className="group flex w-full max-w-full items-center gap-3 rounded-xl border border-[rgba(38,39,45,1)] bg-[rgba(20,20,21,0.65)] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all hover:border-white/20 hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/25"
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.05] text-zinc-300 transition-colors group-hover:border-white/15 group-hover:bg-white/[0.08]"
            aria-hidden
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block text-[13px] font-semibold tracking-tight text-white truncate">
              {collectionLinkTitle ?? "This collection"}
            </span>
            <span className="mt-0.5 block text-[11px] font-medium uppercase tracking-wide text-[#a0a0a0] group-hover:text-zinc-300">
              Open order book
            </span>
          </span>
          <span
            className="shrink-0 text-xs font-semibold text-zinc-400 transition-transform group-hover:translate-x-0.5 group-hover:text-white"
            aria-hidden
          >
            →
          </span>
        </Link>
      ) : null}
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

  const rwaDetailStatRows = useMemo(
    () => buildRwaDetailStatRows(metadata as RwaDetailMetadata | null),
    [metadata],
  );

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
    }
    await queryClient.invalidateQueries({ queryKey: ["collection-market-stats"] });
    await queryClient.invalidateQueries({ queryKey: ["collection-market"] });
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

  const collectionPageHref = collectionKeyForRedirect
    ? `/marketplace/collections/${encodeURIComponent(collectionKeyForRedirect)}`
    : null;
  const collectionLinkTitle =
    collectionDetail?.collection?.displayLabel?.trim() ?? null;

  const imageUrl = metaBundle?.imageUrl ?? null;
  const isPageLoading = ownerLoading;
  const showMain = tokenIdOk && !ownerLoading && !ownerError && ownerOnChain != null;

  return (
    <div className="min-h-screen bg-[#07090c] text-white">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-10">
        {/* Loading */}
        {tokenIdOk && isPageLoading && (
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(260px,16fr)_minmax(240px,10fr)] gap-8 xl:gap-x-9 items-start">
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
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(260px,16fr)_minmax(240px,10fr)] gap-y-8 gap-x-0 xl:gap-x-9 xl:gap-y-10 items-start">
              {/* Left — slab · title · badges · metrics (narrow) */}
              <div className="min-w-0 xl:col-start-1 xl:row-start-1">
                <RwaDetailAssetPanel
                  metadata={metadata as RwaDetailMetadata | null}
                  imageUrl={imageUrl}
                  tokenId={tokenId}
                  collectionLabel={TOKENABLE_RWA_DISPLAY_NAME}
                  metaLoading={metaLoading}
                  hideHeaderOnXl
                />
              </div>

              {activeAskListing && !isOwner && (
                <div className="min-w-0 xl:hidden">
                  <BuyerTradingPanel
                    isConnected={isConnected}
                    buyBusy={buyBusy}
                    listingPriceUsd={listingBuyPriceUsdc}
                    collectionPageHref={collectionPageHref}
                    collectionLinkTitle={collectionLinkTitle}
                    buyErr={buyErr}
                    onFulfill={handleFulfillAsk}
                  />
                </div>
              )}

              <div className="flex w-full min-w-0 flex-col gap-0 xl:sticky xl:top-6 xl:col-start-2 xl:row-start-1 xl:max-w-[428px] xl:justify-self-start xl:self-start">
                <div className="hidden xl:block space-y-2 min-w-0">
                  {detailTitlePulse ? (
                    <div
                      className="h-12 w-[min(100%,24rem)] max-w-full animate-pulse rounded-lg bg-gray-800/85"
                      aria-hidden
                    />
                  ) : (
                    <h1
                      className={`${rwaDetailRightFont.className} min-w-0 break-words text-[34px] font-bold leading-[140%] tracking-normal text-white [overflow-wrap:anywhere]`}
                    >
                      {detailTitle}
                    </h1>
                  )}
                  {detailSetHeadline ? (
                    <p
                      className={`${rwaDetailRightFont.className} text-[16px] font-normal leading-[140%] tracking-normal text-[#a0a0a0]`}
                    >
                      {detailSetHeadline}
                    </p>
                  ) : null}
                </div>

                {listingError && (
                  <p className="text-xs text-orange-400 px-1 xl:mt-6">Could not load listing.</p>
                )}

                {activeAskListing && !isOwner ? (
                  <div className="hidden xl:block xl:mt-10">
                    <BuyerTradingPanel
                      isConnected={isConnected}
                      buyBusy={buyBusy}
                      listingPriceUsd={listingBuyPriceUsdc}
                      collectionPageHref={collectionPageHref}
                      collectionLinkTitle={collectionLinkTitle}
                      buyErr={buyErr}
                      onFulfill={handleFulfillAsk}
                      showCollectionLink={false}
                    />
                  </div>
                ) : null}

                {isOwner ? (
                  <div className="w-full max-w-full rounded-2xl border border-[rgba(38,39,45,1)] bg-[rgba(20,20,21,0.72)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] xl:mt-10">
                    <button
                      type="button"
                      onClick={() => {
                        setListModalInitialPrice(null);
                        setListModalOpen(true);
                      }}
                      disabled={!isConnected}
                      className="w-full inline-flex min-w-0 justify-center items-center rounded-[22px] border border-white/[0.12] bg-white/[0.05] px-4 py-3.5 text-[17px] font-semibold text-white transition-colors hover:border-white/20 hover:bg-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {listing ? "Manage listing" : "List for sale"}
                    </button>
                  </div>
                ) : null}

                {rwaDetailStatRows.length > 0 ? (
                  <div
                    className={`hidden xl:block mt-10 border-t border-[rgba(38,39,45,1)] pt-8 ${rwaDetailRightFont.className}`}
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
