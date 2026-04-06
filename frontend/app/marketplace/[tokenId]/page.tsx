"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  usePublicClient,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { sepolia } from "@/config/wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useShallow } from "zustand/react/shallow";
import {
  getOrderByTokenId,
  getOrderHistoryByTokenId,
  fetchIpfsMetadata,
  getMarketplaceCollectionDetail,
  resolveIpfsImage,
  resolveRwaTokenUri,
  fulfillOrderApi,
  type Order,
} from "@/lib/api";
import { mapWalletError } from "@/lib/walletError";
import { GradedMetadataPanel } from "@/components/common";
import {
  RwaDetailAssetPanel,
  type RwaDetailMetadata,
} from "@/components/marketplace/RwaDetailAssetPanel";
import {
  TOKENABLE_RWA_ADDRESS,
  TOKENABLE_RWA_DISPLAY_NAME,
  TOKENABLE_RWA_READ_ABI,
  USDC_ADDRESS,
  SEAPORT_ADDRESS,
  USDC_ABI,
  SEAPORT_ABI,
} from "@/constants/contracts";
import { ListRwaModal } from "@/components/marketplace/ListRwaModal";
import { RwaOrderBook } from "@/components/marketplace/RwaOrderBook";
import { TokenCriteriaMatchPanel } from "@/components/marketplace/TokenCriteriaMatchPanel";
import { ASSETS } from "@/constants/assets";
import { useAppStore, selectWallet, selectUsdcBalance, selectRefresh } from "@/store";
import { GAS_FALLBACK, gasWithCapFast } from "@/lib/chainGas";
import { maxUint256 } from "viem";
import {
  FULFILL_EXTRA_DATA,
  fulfillSeaportOrderArgs,
} from "@/lib/seaportFulfillOrderArgs";

// ─── Types ────────────────────────────────────────────────────────────────────

type BuyStep = "idle" | "approving" | "buying" | "success" | "error";

// ─── Activity history (DB 기반) ───────────────────────────────────────────────

function useActivityHistory(tokenId: number) {
  return useQuery({
    queryKey: ["rwa-activity", tokenId],
    queryFn: () => getOrderHistoryByTokenId(tokenId),
    staleTime: 15_000,
    retry: 1,
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortAddr(addr?: string) {
  if (!addr) return "—";
  const a = addr.startsWith("0x") ? addr : `0x${addr}`;
  if (a.length <= 14) return a;
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

/** 긴 숫자형 Token ID를 중간 말줄임 (예: 110660…7983) */
function formatTokenIdDisplay(id: number): string {
  if (!Number.isFinite(id)) return "—";
  const s = String(Math.trunc(id));
  if (s.length <= 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

/**
 * API/DB는 UTC인데 `Z` 없이 오면 `new Date(str)`이 로컬(예: 한국)로 해석되어
 * 약 9시간 어긋날 수 있음 → 오프셋 없으면 UTC로 고정.
 */
function parseApiUtcMs(raw: string | undefined | null): number {
  if (raw == null || raw === "") return 0;
  let s = String(raw).trim();
  const hasOffset =
    /Z$/i.test(s) ||
    /[+-]\d{2}:\d{2}$/.test(s) ||
    /[+-]\d{4}$/.test(s);
  if (hasOffset) {
    const t = new Date(s).getTime();
    return Number.isFinite(t) ? t : 0;
  }
  s = s.includes("T") ? s : s.replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
    const t = new Date(`${s}Z`).getTime();
    return Number.isFinite(t) ? t : 0;
  }
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : 0;
}

function timeAgo(ts?: number): string {
  if (ts == null || !Number.isFinite(ts) || ts <= 0) return "";
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60)
    return `${diff} second${diff === 1 ? "" : "s"} ago`;
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return `${m} minute${m === 1 ? "" : "s"} ago`;
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  const d = Math.floor(diff / 86400);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

const SEPOLIA_ETHERSCAN = "https://sepolia.etherscan.io";

function explorerAddrPath(addr: string): string {
  return `${SEPOLIA_ETHERSCAN}/address/${addr}`;
}

/** Seaport consideration 중 offerer가 아닌 수령인(수수료·구매자 힌트 등) */
function firstNonOffererRecipient(order: Order): string | undefined {
  const o = order.offerer.toLowerCase();
  for (const c of order.parameters.consideration ?? []) {
    const r = c.recipient?.toLowerCase();
    if (r && r !== o) return c.recipient;
  }
  return undefined;
}

function IconExternalLink({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function IconTag({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RwaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenId = Number(params.tokenId);

  const { address, isConnected } = useAppStore(useShallow(selectWallet));
  const { usdcBalance, usdcBalanceFormatted } = useAppStore(useShallow(selectUsdcBalance));
  const refresh = useAppStore(selectRefresh);

  const publicClient = usePublicClient({ chainId: sepolia.id });
  const queryClient = useQueryClient();
  const { writeContractAsync } = useWriteContract();

  const [buyStep, setBuyStep] = useState<BuyStep>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | undefined>();
  const [detailsExtraOpen, setDetailsExtraOpen] = useState(false);
  const [listModalOpen, setListModalOpen] = useState(false);
  const [listModalInitialPrice, setListModalInitialPrice] = useState<string | null>(null);

  useWaitForTransactionReceipt({ hash: approveTxHash, chainId: sepolia.id });

  const tokenIdOk = Number.isFinite(tokenId) && tokenId >= 0;

  // ── Data fetching ──────────────────────────────────────────────────────────

  const {
    data: listing,
    isError: listingError,
  } = useQuery({
    queryKey: ["marketplace-order-by-token", tokenId],
    queryFn: () => getOrderByTokenId(tokenId),
    retry: 1,
    enabled: tokenIdOk,
  });

  const fromCollectionParam = searchParams.get("fromCollection")?.trim() ?? "";

  const collectionKeyForRedirect = useMemo(() => {
    if (fromCollectionParam) return fromCollectionParam;
    if (listing?.collectionKey) return listing.collectionKey;
    return null;
  }, [fromCollectionParam, listing?.collectionKey]);

  const collectionKeyForMatch =
    (listing?.collectionKey?.trim() || fromCollectionParam || null) as string | null;

  const { data: collectionDetail } = useQuery({
    queryKey: ["marketplace-collection", collectionKeyForMatch],
    queryFn: () => getMarketplaceCollectionDetail(collectionKeyForMatch!),
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

  // 키를 목록 카드(Marketplace OrderCard)의 ["rwa-metadata", tokenId]와 분리해야 함.
  const { data: metaBundle, isLoading: metaLoading } = useQuery({
    queryKey: ["marketplace-detail-metadata", tokenId, publicClient?.chain?.id],
    queryFn: async () => {
      const tokenURI = await resolveRwaTokenUri(tokenId, publicClient ?? undefined);
      if (!tokenURI) return null;
      const metadata = await fetchIpfsMetadata(tokenURI).catch(() => null);
      return { metadata, tokenURI };
    },
    enabled: tokenIdOk,
    staleTime: 60_000,
  });

  const {
    data: ownerOnChain,
    isLoading: ownerLoading,
    isError: ownerError,
    refetch: refetchOwner,
  } = useReadContract({
    address: TOKENABLE_RWA_ADDRESS,
    abi: TOKENABLE_RWA_READ_ABI,
    functionName: "ownerOf",
    args: [BigInt(Math.max(0, Math.floor(tokenId)))],
    chainId: sepolia.id,
    query: {
      enabled: tokenIdOk,
    },
  });

  const { data: usdcAllowanceBuy } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "allowance",
    args: address ? [address, SEAPORT_ADDRESS] : undefined,
    chainId: sepolia.id,
    query: { enabled: !!address },
  });

  const metadata = metaBundle?.metadata ?? null;
  const tokenURIOnChain = metaBundle?.tokenURI ?? null;

  const {
    data: activity,
    isLoading: activityLoading,
    isError: activityError,
    refetch: refetchActivity,
  } = useActivityHistory(tokenId);

  // ── Buy (ask listing) ─────────────────────────────────────────────────────

  const isListingSeller =
    address?.toLowerCase() === listing?.offerer.toLowerCase();
  const priceInUnits = listing ? BigInt(listing.considerationAmount) : BigInt(0);
  const hasEnoughUsdc = isListingSeller || usdcBalance >= priceInUnits;
  const isBuying = buyStep === "approving" || buyStep === "buying";
  const collectionBids = collectionDetail?.collectionBids ?? [];

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
    await queryClient.invalidateQueries({ queryKey: ["marketplace-orders"] });
    await queryClient.invalidateQueries({ queryKey: ["marketplace-order-by-token", tokenId] });
    await queryClient.invalidateQueries({
      queryKey: ["marketplace-detail-metadata", tokenId],
    });
    await queryClient.invalidateQueries({ queryKey: ["rwa-activity", tokenId] });
    /** 모든 지갑의 My Assets 목록·메타 (거래 후 판매자/구매자 캐시 동기화) */
    await queryClient.invalidateQueries({ queryKey: ["my-rwa-ids"] });
    await queryClient.invalidateQueries({ queryKey: ["my-rwas"] });
    await queryClient.invalidateQueries({ queryKey: ["marketplace-collection"] });
    if (collectionKeyForMatch) {
      await queryClient.invalidateQueries({
        queryKey: ["marketplace-collection", collectionKeyForMatch],
      });
    }
  }

  /** wagmi readContract 캐시 (ownerOf 등) */
  async function invalidateWagmiReads() {
    await queryClient.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) && q.queryKey[0] === "readContract",
    });
  }

  async function handleBuy() {
    if (!address || !listing || !publicClient) return;
    setBuyStep("approving");
    setErrorMsg("");

    try {
      let allowance = usdcAllowanceBuy as bigint | undefined;
      if (allowance === undefined) {
        allowance = await publicClient.readContract({
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: "allowance",
          args: [address, SEAPORT_ADDRESS],
        });
      }

      const gasFulfillPromise = gasWithCapFast(
        publicClient,
        {
          address: SEAPORT_ADDRESS,
          abi: SEAPORT_ABI,
          functionName: "fulfillOrder",
          args: [fulfillSeaportOrderArgs(listing), FULFILL_EXTRA_DATA],
          account: address,
        },
        GAS_FALLBACK.fulfillOrder,
      );

      const needsUsdcApprove = allowance < priceInUnits;

      if (needsUsdcApprove) {
        const gasApprove = await gasWithCapFast(
          publicClient,
          {
            address: USDC_ADDRESS,
            abi: USDC_ABI,
            functionName: "approve",
            args: [SEAPORT_ADDRESS, maxUint256],
            account: address,
          },
          GAS_FALLBACK.erc20Approve,
        );
        const approveTx = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: "approve",
          args: [SEAPORT_ADDRESS, maxUint256],
          chainId: sepolia.id,
          gas: gasApprove,
        });
        setApproveTxHash(approveTx);
        await publicClient.waitForTransactionReceipt({ hash: approveTx });
      } else {
        setApproveTxHash(undefined);
      }

      setBuyStep("buying");

      const gasFulfill = await gasFulfillPromise;
      const fulfillTx = await writeContractAsync({
        address: SEAPORT_ADDRESS,
        abi: SEAPORT_ABI,
        functionName: "fulfillOrder",
        args: [fulfillSeaportOrderArgs(listing), FULFILL_EXTRA_DATA],
        chainId: sepolia.id,
        gas: gasFulfill,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: fulfillTx });
      if (receipt.status === "reverted") {
        throw new Error(
          `Transaction was reverted on-chain (tx: ${fulfillTx}).\n` +
            "Please ensure your account has enough Sepolia USDC and try again."
        );
      }

      await fulfillOrderApi(listing.orderHash);

      refresh();
      await invalidateMarketplaceQueries();
      await invalidateWagmiReads();
      await refetchOwner();
      setBuyStep("idle");
      navigateToCollectionAfterTrade();
    } catch (err: unknown) {
      setErrorMsg(mapWalletError(err).message);
      setBuyStep("error");
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const imageUrl = metadata?.image ? resolveIpfsImage(metadata.image) : null;
  const isPageLoading = ownerLoading;
  const priceDisplay = listing
    ? (Number(listing.considerationAmount) / 1_000_000).toLocaleString()
    : "—";

  const showMain = tokenIdOk && !ownerLoading && !ownerError && ownerOnChain != null;

  return (
    <div className="min-h-screen bg-[#07090c] text-white">
      {/* ── Header ── */}
      <header className="border-b border-mint-deep/15 bg-[#07090c]/95 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4 text-sm">
          <Link href="/" className="shrink-0">
            <img
              src={ASSETS.logo.tokenable}
              alt="Tokenable"
              width={112}
              height={22}
              className="h-5 w-auto invert"
            />
          </Link>
          <span className="text-gray-700">/</span>
          <button
            onClick={() => router.back()}
            className="text-gray-500 hover:text-white transition-colors"
          >
            ←
          </button>
          <span className="text-gray-700">/</span>
          <span className="text-gray-500">Exchange</span>
          <span className="text-gray-700">/</span>
          <span className="text-white font-medium">Asset #{tokenId}</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-10">
        {/* Loading */}
        {tokenIdOk && isPageLoading && (
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_min(420px,100%)] gap-8 items-start">
            <div className="space-y-4">
              <div className="aspect-[3/4] max-h-[520px] bg-gray-800/90 rounded-2xl animate-pulse" />
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
              ← Back to Exchange
            </button>
          </div>
        )}

        {/* Main content */}
        {showMain && (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_min(420px,100%)] gap-8 xl:gap-10 items-start">
              {/* Left — 슬랩 이미지 · 제목 · 배지 · 카드 메타 그리드 */}
              <RwaDetailAssetPanel
                metadata={metadata as RwaDetailMetadata | null}
                imageUrl={imageUrl}
                tokenId={tokenId}
                collectionLabel={TOKENABLE_RWA_DISPLAY_NAME}
                metaLoading={metaLoading}
              />

              {/* Right — 오더북 · 풀 · 매매 */}
              <div className="space-y-4 xl:sticky xl:top-20 xl:self-start min-w-0">
                <div className="rounded-2xl border border-gray-800/90 bg-[#0a0d11]/80 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {listing ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-mint/10 border border-mint-deep/35 text-mint">
                        <span className="w-1.5 h-1.5 rounded-full bg-mint inline-block" />
                        Ask listed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-gray-800/90 border border-gray-700/60 text-gray-400">
                        No ask
                      </span>
                    )}
                    <span className="text-[11px] text-gray-500 font-mono">
                      {TOKENABLE_RWA_DISPLAY_NAME} · #{tokenId}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500">Owner</span>
                    <span className="font-mono text-mint font-medium">
                      {shortAddr(typeof ownerOnChain === "string" ? ownerOnChain : undefined)}
                      {isOwner && (
                        <span className="ml-1 text-[10px] text-mint/80">(you)</span>
                      )}
                    </span>
                  </div>
                </div>

                {listingError && (
                  <p className="text-xs text-orange-400 px-1">
                    Could not load listing from API.
                  </p>
                )}

                {listing && collectionKeyForMatch && (
                  <TokenCriteriaMatchPanel
                    listing={listing}
                    collectionKey={collectionKeyForMatch}
                    tokenId={tokenId}
                    collectionBids={collectionBids}
                  />
                )}

                <RwaOrderBook
                  listing={listing ?? null}
                  bids={[]}
                  bidsLoading={false}
                  activity={activity}
                  activityLoading={activityLoading}
                  tokenId={tokenId}
                  address={address}
                  isOwner={isOwner}
                  isAccepting={false}
                  isBuying={isBuying}
                  acceptingBidHash={null}
                  cancelBidHash={null}
                />

                <div className="rounded-2xl border border-gray-800/90 bg-[#0a0d11]/90 p-3 space-y-3">
                    {isConnected && address && listing && (
                      <div className="flex items-center justify-between text-xs px-1 py-1.5 rounded-lg bg-gray-900/50 border border-gray-800/80">
                        <span className="text-gray-500">Your balance</span>
                        <span
                          className={
                            hasEnoughUsdc ? "text-gray-200 font-mono tabular-nums" : "text-orange-400 font-mono"
                          }
                        >
                          {parseFloat(usdcBalanceFormatted).toLocaleString()} USDC
                        </span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setListModalInitialPrice(null);
                          setListModalOpen(true);
                        }}
                        disabled={!isOwner || !isConnected}
                        className="py-3.5 rounded-xl text-sm font-bold text-white bg-[#e53935] hover:bg-[#c62828] disabled:opacity-35 disabled:cursor-not-allowed shadow-[0_8px_24px_-8px_rgba(229,57,53,0.45)] transition-colors"
                      >
                        Sell
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleBuy()}
                        disabled={
                          !listing ||
                          isOwner ||
                          !isConnected ||
                          isBuying ||
                          !hasEnoughUsdc
                        }
                        className="py-3.5 rounded-xl text-sm font-bold text-white bg-[#00c853] hover:bg-[#00a844] disabled:opacity-35 disabled:cursor-not-allowed shadow-[0_8px_24px_-8px_rgba(0,200,83,0.35)] transition-colors"
                      >
                        {isBuying ? "Processing…" : "Buy"}
                      </button>
                    </div>
                    <p className="text-[10px] text-center text-gray-600 leading-snug px-1">
                      Sell lists at USDC. Buy fulfills the ask. Collection bids are placed on the
                      collection page; match them above when price covers your listing.
                    </p>
                  </div>

                <div className="space-y-3">
                    {isBuying && listing && !isOwner && (
                      <div className="flex gap-2">
                        {[
                          { label: "1. Approve USDC", active: buyStep === "approving" },
                          { label: "2. Buy via Seaport", active: buyStep === "buying" },
                        ].map(({ label, active }) => (
                          <div
                            key={label}
                            className={`flex-1 text-center text-xs py-1.5 rounded-lg ${
                              active
                                ? "bg-mint-dim text-mint-ink animate-pulse"
                                : "bg-gray-800 text-gray-500"
                            }`}
                          >
                            {label}
                          </div>
                        ))}
                      </div>
                    )}

                    {!listing && (
                      <p className="text-center text-sm text-gray-500 py-3 px-2 bg-gray-900/40 rounded-xl border border-gray-800/80">
                        No ask yet — list from Sell or open the collection page for collection bids.
                      </p>
                    )}

                    {!isConnected && (
                      <p className="text-center text-sm text-gray-500 py-3 px-2 bg-gray-900/40 rounded-xl border border-gray-800/80">
                        Connect your wallet to trade.
                      </p>
                    )}

                    {isConnected && listing && isListingSeller && (
                      <p className="text-center text-sm text-gray-500 py-3 px-2 bg-gray-900/40 rounded-xl border border-gray-800/80">
                        This is your listing · ask ${priceDisplay} USDC
                      </p>
                    )}

                    {isConnected && listing && !isOwner && !hasEnoughUsdc && (
                      <div className="px-4 py-3 text-sm text-orange-400 bg-orange-900/20 border border-orange-800/40 rounded-xl">
                        Insufficient USDC for this ask.{" "}
                        <a
                          href="https://faucet.circle.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-orange-300"
                        >
                          Get Sepolia USDC →
                        </a>
                      </div>
                    )}

                    {buyStep === "error" && errorMsg && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                        <p className="text-xs text-red-300 leading-relaxed">{errorMsg}</p>
                      </div>
                    )}
                  </div>

                {/* Details — 블록체인 표준 정보 (마켓플레이스 참고 레이아웃) */}
                <div className="bg-[#0a0d11]/90 border border-mint-deep/20 rounded-2xl p-4">
                  <h3 className="text-sm font-semibold text-white mb-4">On-chain details</h3>
                  <dl className="space-y-4">
                    <div>
                      <dt className="text-xs text-gray-500">Standard</dt>
                      <dd className="text-sm text-gray-200 mt-0.5">
                        ERC-721 token on the blockchain
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">Chain</dt>
                      <dd className="text-sm text-gray-200 mt-0.5">Ethereum Sepolia</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">Token ID</dt>
                      <dd
                        className="text-sm text-gray-200 mt-0.5 font-mono"
                        title={String(tokenId)}
                      >
                        {formatTokenIdDisplay(tokenId)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">Contract address</dt>
                      <dd className="mt-0.5">
                        <a
                          href={`https://sepolia.etherscan.io/address/${TOKENABLE_RWA_ADDRESS}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-mono text-mint hover:text-mint-dim"
                          title={TOKENABLE_RWA_ADDRESS}
                        >
                          {shortAddr(TOKENABLE_RWA_ADDRESS)} ↗
                        </a>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">Owner address</dt>
                      <dd className="mt-0.5">
                        {(() => {
                          const o =
                            typeof ownerOnChain === "string" ? ownerOnChain : undefined;
                          if (!o) {
                            return (
                              <span className="text-sm text-gray-500">—</span>
                            );
                          }
                          return (
                            <a
                              href={`https://sepolia.etherscan.io/address/${o}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-mono text-mint hover:text-mint-dim"
                              title={o}
                            >
                              {shortAddr(o)} ↗
                            </a>
                          );
                        })()}
                      </dd>
                    </div>
                  </dl>

                  {detailsExtraOpen && (
                    <div className="mt-4 pt-4 border-t border-gray-800 space-y-3 text-sm">
                      <p className="text-[11px] text-gray-600 leading-relaxed">
                        The contract stores only a{" "}
                        <span className="text-gray-500">token URI</span> pointer; name,
                        image, and traits are in the JSON on IPFS.
                      </p>
                      {tokenURIOnChain && (
                        <div>
                          <p className="text-xs text-gray-500">Token URI</p>
                          <p
                            className="mt-1 font-mono text-[11px] text-gray-400 break-all"
                            title={tokenURIOnChain}
                          >
                            {tokenURIOnChain.length > 96
                              ? `${tokenURIOnChain.slice(0, 44)}…${tokenURIOnChain.slice(-36)}`
                              : tokenURIOnChain}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-gray-500">Exchange protocol</p>
                        <p className="mt-0.5">
                          <a
                            href={`https://sepolia.etherscan.io/address/${SEAPORT_ADDRESS}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-mint hover:text-mint-dim text-sm"
                          >
                            Seaport 1.6 ↗
                          </a>
                        </p>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setDetailsExtraOpen((v) => !v)}
                    className="mt-4 w-full text-left text-xs text-gray-500 hover:text-gray-300 transition-colors py-1"
                  >
                    {detailsExtraOpen ? "Show less" : "Show more"}
                  </button>
                </div>
              </div>
            </div>

            {metadata?.properties && (
              <GradedMetadataPanel
                properties={metadata.properties as Record<string, unknown>}
                attributes={metadata.attributes}
              />
            )}

            {/* Activity history — 참고: 배지 + 가격 강조 + From/To + 시간 */}
            <div className="rounded-2xl border border-mint-deep/20 bg-[#0a0d11]/90 overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-800/80">
                <h2 className="text-base font-semibold text-white tracking-tight">
                  Activity history
                </h2>
                {!activityLoading && (
                  <button
                    type="button"
                    onClick={() => void refetchActivity()}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
                  >
                    ↻ Refresh
                  </button>
                )}
              </div>

              {activityLoading && (
                <div className="divide-y divide-gray-800/90">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="h-24 bg-white/[0.02] animate-pulse" />
                  ))}
                </div>
              )}

              {!activityLoading && activityError && (
                <div className="flex items-center justify-between px-4 py-4 border-t border-gray-800/90">
                  <p className="text-sm text-red-400">Failed to load activity.</p>
                  <button
                    type="button"
                    onClick={() => void refetchActivity()}
                    className="text-xs text-red-400 hover:text-red-200 transition-colors shrink-0"
                  >
                    Retry
                  </button>
                </div>
              )}

              {!activityLoading && !activityError && (!activity || activity.length === 0) && (
                <div className="text-center py-10 px-4">
                  <p className="text-gray-500 text-sm">No marketplace activity yet</p>
                </div>
              )}

              {!activityLoading && !activityError && activity && activity.length > 0 && (
                <ul className="divide-y divide-gray-800/90">
                  {[...activity]
                    .sort(
                      (a, b) =>
                        parseApiUtcMs(b.updatedAt ?? b.createdAt) -
                        parseApiUtcMs(a.updatedAt ?? a.createdAt)
                    )
                    .map((order: Order) => {
                      const statusMeta: Record<
                        string,
                        { label: string; badgeClass: string }
                      > = {
                        active: {
                          label: "Listing",
                          badgeClass:
                            "bg-white/[0.06] text-gray-200 border border-white/[0.08]",
                        },
                        fulfilled: {
                          label: "Sale",
                          badgeClass:
                            "bg-white/[0.06] text-gray-200 border border-white/[0.08]",
                        },
                        cancelled: {
                          label: "Cancelled",
                          badgeClass:
                            "bg-white/[0.04] text-gray-400 border border-white/[0.06]",
                        },
                        expired: {
                          label: "Expired",
                          badgeClass:
                            "bg-white/[0.04] text-gray-400 border border-white/[0.06]",
                        },
                      };
                      const meta = statusMeta[order.status] ?? statusMeta["active"];
                      const side = order.side ?? "ask";
                      let badgeLabel = meta.label;
                      if (order.status === "active" && side === "bid") badgeLabel = "Bid";
                      if (order.status === "fulfilled" && side === "bid") badgeLabel = "Bid filled";
                      if (order.status === "active" && side === "ask") badgeLabel = "Ask";
                      const ts = Math.floor(
                        parseApiUtcMs(order.updatedAt ?? order.createdAt) / 1000
                      );
                      const priceNum = order.considerationAmount
                        ? Number(order.considerationAmount) / 1_000_000
                        : null;
                      const priceStr =
                        priceNum != null && !Number.isNaN(priceNum)
                          ? priceNum.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : null;
                      const otherRecipient = firstNonOffererRecipient(order);
                      const explorerSeller = explorerAddrPath(order.offerer);

                      let metaLine: string;
                      if (order.status === "fulfilled") {
                        if (side === "bid") {
                          metaLine = otherRecipient
                            ? `Bid ${shortAddr(order.offerer)} → ${shortAddr(otherRecipient)}`
                            : `Bid by ${shortAddr(order.offerer)}`;
                        } else if (otherRecipient) {
                          metaLine = `From ${shortAddr(order.offerer)} → ${shortAddr(otherRecipient)}`;
                        } else {
                          metaLine = `From ${shortAddr(order.offerer)}`;
                        }
                      } else if (order.status === "active") {
                        metaLine =
                          side === "bid"
                            ? `Bid by ${shortAddr(order.offerer)}`
                            : `Listed by ${shortAddr(order.offerer)}`;
                      } else {
                        metaLine = `By ${shortAddr(order.offerer)}`;
                      }

                      return (
                        <li key={order.orderHash} className="px-4 py-5">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full pl-2.5 pr-3 py-1 text-xs font-medium ${meta.badgeClass}`}
                            >
                              <IconTag className="opacity-70 shrink-0" />
                              {badgeLabel}
                            </span>
                            <a
                              href={explorerSeller}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 p-1 rounded-md text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
                              title="View offerer on Etherscan"
                            >
                              <IconExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                          <div className="mb-3">
                            {priceStr != null ? (
                              <p className="text-[1.65rem] leading-none font-bold text-white tracking-tight">
                                <span className="text-[0.95em] font-semibold text-gray-200">
                                  $
                                </span>
                                {priceStr}
                                <span className="text-base font-semibold text-gray-500 ml-1.5">
                                  USDC
                                </span>
                              </p>
                            ) : (
                              <p className="text-xl font-semibold text-gray-500">—</p>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 leading-relaxed">
                            <span className="text-gray-600">{metaLine}</span>
                            <span className="text-gray-600"> · </span>
                            <span>{timeAgo(ts)}</span>
                          </p>
                        </li>
                      );
                    })}
                </ul>
              )}
            </div>

            {listModalOpen && (
              <ListRwaModal
                tokenId={tokenId}
                initialPriceUsdc={listModalInitialPrice}
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
