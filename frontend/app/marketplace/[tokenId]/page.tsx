"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  resolveIpfsImage,
  fulfillOrderApi,
  type Order,
} from "@/lib/api";
import { NftImageZoom, GradedMetadataPanel } from "@/components/common";
import {
  TOKENABLE_RWA_ADDRESS,
  TOKENABLE_RWA_DISPLAY_NAME,
  TOKENABLE_RWA_READ_ABI,
  USDC_ADDRESS,
  SEAPORT_ADDRESS,
  USDC_ABI,
  SEAPORT_ABI,
} from "@/constants/contracts";
import { ASSETS } from "@/constants/assets";
import { useAppStore, selectWallet, selectUsdcBalance, selectRefresh } from "@/store";

// ─── Types ────────────────────────────────────────────────────────────────────

type BuyStep = "idle" | "approving" | "buying" | "success" | "error";

// ─── Activity history (DB 기반) ───────────────────────────────────────────────

function useActivityHistory(tokenId: number) {
  return useQuery({
    queryKey: ["nft-activity", tokenId],
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

export default function NftDetailPage() {
  const params = useParams();
  const router = useRouter();
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

  useWaitForTransactionReceipt({ hash: approveTxHash, chainId: sepolia.id });

  // ── Data fetching ──────────────────────────────────────────────────────────

  const {
    data: order,
    isLoading: orderLoading,
    isError: orderError,
  } = useQuery({
    queryKey: ["marketplace-order-by-token", tokenId],
    queryFn: () => getOrderByTokenId(tokenId),
    retry: 1,
  });

  const { data: metaBundle, isLoading: metaLoading } = useQuery({
    queryKey: ["nft-metadata", tokenId],
    queryFn: async () => {
      if (!order?.parameters?.offer?.[0]?.token) return null;
      const base =
        process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
      const uriRes = await fetch(`${base}/blockchain/nft/token-uri/${tokenId}`);
      if (!uriRes.ok) return null;
      const rawText = await uriRes.text();
      let tokenURI = rawText.trim();
      try {
        const parsed = JSON.parse(rawText);
        tokenURI =
          typeof parsed === "string"
            ? parsed
            : parsed?.tokenURI ?? String(parsed);
      } catch {
        // use rawText
      }
      if (!tokenURI) return null;
      const metadata = await fetchIpfsMetadata(tokenURI).catch(() => null);
      return { metadata, tokenURI };
    },
    enabled: !!order,
  });

  const { data: ownerOnChain } = useReadContract({
    address: TOKENABLE_RWA_ADDRESS,
    abi: TOKENABLE_RWA_READ_ABI,
    functionName: "ownerOf",
    args: [BigInt(Math.max(0, Math.floor(tokenId)))],
    chainId: sepolia.id,
    query: {
      enabled:
        Number.isFinite(tokenId) &&
        tokenId >= 0 &&
        !orderLoading &&
        !!order,
    },
  });

  const metadata = metaBundle?.metadata ?? null;
  const tokenURIOnChain = metaBundle?.tokenURI ?? null;

  const {
    data: activity,
    isLoading: activityLoading,
    isError: activityError,
    refetch: refetchActivity,
  } = useActivityHistory(tokenId);

  // ── Buy logic ──────────────────────────────────────────────────────────────

  const isSelf = address?.toLowerCase() === order?.offerer.toLowerCase();
  // considerationAmount is already in USDC smallest unit (e.g. 20000 = 0.02 USDC)
  const priceInUnits = order ? BigInt(order.considerationAmount) : BigInt(0);
  const hasEnoughUsdc = isSelf || usdcBalance >= priceInUnits;
  const isBuying = buyStep === "approving" || buyStep === "buying";

  async function handleBuy() {
    if (!address || !order) return;
    setBuyStep("approving");
    setErrorMsg("");

    try {
      // Step 1: Approve USDC to Seaport
      const approveTx = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: "approve",
        args: [SEAPORT_ADDRESS, priceInUnits],
        chainId: sepolia.id,
      });
      setApproveTxHash(approveTx);
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: approveTx });
      }

      // Step 2: Seaport.fulfillOrder
      setBuyStep("buying");
      const params = order.parameters;

      const fulfillTx = await writeContractAsync({
        address: SEAPORT_ADDRESS,
        abi: SEAPORT_ABI,
        functionName: "fulfillOrder",
        args: [
          {
            parameters: {
              offerer: params.offerer as `0x${string}`,
              zone: params.zone as `0x${string}`,
              offer: params.offer.map((item) => ({
                itemType: item.itemType,
                token: item.token as `0x${string}`,
                identifierOrCriteria: BigInt(item.identifierOrCriteria),
                startAmount: BigInt(item.startAmount),
                endAmount: BigInt(item.endAmount),
              })),
              consideration: params.consideration.map((item) => ({
                itemType: item.itemType,
                token: item.token as `0x${string}`,
                identifierOrCriteria: BigInt(item.identifierOrCriteria),
                startAmount: BigInt(item.startAmount),
                endAmount: BigInt(item.endAmount),
                recipient: item.recipient as `0x${string}`,
              })),
              orderType: params.orderType,
              startTime: BigInt(params.startTime),
              endTime: BigInt(params.endTime),
              zoneHash: params.zoneHash as `0x${string}`,
              salt: BigInt(params.salt),
              conduitKey: params.conduitKey as `0x${string}`,
              totalOriginalConsiderationItems: BigInt(
                params.totalOriginalConsiderationItems
              ),
            },
            signature: order.signature as `0x${string}`,
          },
          "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
        ],
        chainId: sepolia.id,
        gas: BigInt(400000),
      });

      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash: fulfillTx });
        if (receipt.status === "reverted") {
          throw new Error(
            `Transaction was reverted on-chain (tx: ${fulfillTx}).\n` +
            "Please ensure your account has enough Sepolia USDC and try again."
          );
        }
      }

      // Step 3: Update backend status — only after confirmed on-chain success
      await fulfillOrderApi(order.orderHash);

      setBuyStep("success");
      refresh();
      await queryClient.invalidateQueries({ queryKey: ["marketplace-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["marketplace-order-by-token", tokenId] });
      await queryClient.invalidateQueries({ queryKey: ["nft-activity", tokenId] });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Transaction failed");
      setBuyStep("error");
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const imageUrl = metadata?.image ? resolveIpfsImage(metadata.image) : null;
  const isPageLoading = orderLoading || metaLoading;
  const priceDisplay = order
    ? (Number(order.considerationAmount) / 1_000_000).toLocaleString()
    : "0";

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* ── Header ── */}
      <header className="border-b border-gray-800/60 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-10">
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
          <span className="text-gray-500">Marketplace</span>
          <span className="text-gray-700">/</span>
          <span className="text-white font-medium">NFT #{tokenId}</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Loading */}
        {isPageLoading && (
          <div className="grid grid-cols-1 md:grid-cols-[1fr_420px] gap-8">
            <div className="aspect-square bg-gray-800 rounded-2xl animate-pulse" />
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

        {/* Not found */}
        {!orderLoading && (order === null || orderError) && (
          <div className="text-center py-24">
            <p className="text-5xl mb-4">🔍</p>
            <p className="text-xl font-semibold text-white mb-2">
              Listing not found
            </p>
            <p className="text-gray-500 text-sm mb-6">
              This NFT may have been sold or delisted.
            </p>
            <button
              onClick={() => router.back()}
              className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              ← Back to Marketplace
            </button>
          </div>
        )}

        {/* Main content */}
        {!isPageLoading && order && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_420px] gap-8 items-start">
              {/* Left — Image */}
              <div className="space-y-3">
                <div className="rounded-2xl overflow-hidden bg-gray-900 border border-gray-800 aspect-square">
                  {imageUrl ? (
                    <NftImageZoom
                      src={imageUrl}
                      alt={metadata?.name ?? `NFT #${tokenId}`}
                      className="w-full h-full"
                      zoomFactor={3}
                      lensSize={180}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">
                      No Image
                    </div>
                  )}
                </div>

                {metadata?.attributes && metadata.attributes.length > 0 && (
                  <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Traits
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {metadata.attributes.map((attr) => (
                        <span
                          key={attr.trait_type}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-800/90 border border-gray-700/80 rounded-full text-[11px] leading-tight"
                        >
                          <span className="text-gray-500">{attr.trait_type}</span>
                          <span className="text-white font-medium">{attr.value}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right — Info & Buy */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-900/40 border border-blue-700/40 text-blue-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
                    Listed for Sale
                  </span>
                  <span className="text-xs text-gray-600">
                    {TOKENABLE_RWA_DISPLAY_NAME} #{tokenId}
                  </span>
                </div>

                <div>
                  <h1 className="text-3xl font-extrabold text-white leading-tight">
                    {metadata?.name ?? `${TOKENABLE_RWA_DISPLAY_NAME} #${tokenId}`}
                  </h1>
                  {metadata?.description && (
                    <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                      {metadata.description}
                    </p>
                  )}
                  {metadata?.external_url && (
                    <a
                      href={metadata.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-amber-400/90 hover:text-amber-300 mt-3"
                    >
                      View certification link ↗
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">Owned by</span>
                  <span className="font-mono text-blue-400 font-medium">
                    {shortAddr(order.offerer)}
                    {isSelf && (
                      <span className="ml-1.5 text-xs text-yellow-500">(You)</span>
                    )}
                  </span>
                </div>

                <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Price</p>
                  <p className="text-4xl font-extrabold text-white">
                    {priceDisplay}
                    <span className="text-xl text-gray-400 ml-2">USDC</span>
                  </p>
                  {isConnected && address && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Your balance</span>
                      <span className={hasEnoughUsdc ? "text-gray-300" : "text-orange-400"}>
                        {parseFloat(usdcBalanceFormatted).toLocaleString()} USDC
                      </span>
                    </div>
                  )}
                </div>

                {buyStep === "success" ? (
                  <div className="bg-emerald-900/30 border border-emerald-700/40 rounded-2xl p-6 text-center">
                    <div className="text-4xl mb-2">🎉</div>
                    <p className="text-lg font-bold text-emerald-400">Purchase Complete!</p>
                    <p className="text-sm text-gray-400 mt-1">NFT #{tokenId} is now yours.</p>
                    <button
                      onClick={() => router.push("/?tab=my-nfts")}
                      className="mt-4 w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-xl transition-colors"
                    >
                      View My NFTs →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {isBuying && (
                      <div className="flex gap-2">
                        {[
                          { label: "1. Approve USDC", active: buyStep === "approving" },
                          { label: "2. Buy via Seaport", active: buyStep === "buying" },
                        ].map(({ label, active }) => (
                          <div
                            key={label}
                            className={`flex-1 text-center text-xs py-1.5 rounded-lg ${
                              active
                                ? "bg-blue-600 text-white animate-pulse"
                                : "bg-gray-800 text-gray-500"
                            }`}
                          >
                            {label}
                          </div>
                        ))}
                      </div>
                    )}

                    {!isConnected ? (
                      <p className="text-center text-sm text-gray-500 py-4 bg-gray-900/50 rounded-2xl border border-gray-800">
                        Connect your wallet to purchase
                      </p>
                    ) : isSelf ? (
                      <p className="text-center text-sm text-gray-500 py-4 bg-gray-900/50 rounded-2xl border border-gray-800">
                        This is your own listing
                      </p>
                    ) : !hasEnoughUsdc ? (
                      <div className="px-4 py-3 text-sm text-orange-400 bg-orange-900/20 border border-orange-800/40 rounded-2xl">
                        Insufficient USDC.{" "}
                        <a
                          href="https://faucet.circle.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-orange-300"
                        >
                          Get Sepolia USDC →
                        </a>
                      </div>
                    ) : (
                      <button
                        onClick={() => void handleBuy()}
                        disabled={isBuying}
                        className="w-full py-4 text-base font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl transition-all shadow-lg shadow-emerald-900/30"
                      >
                        {isBuying
                          ? "Processing…"
                          : `Buy Now · ${priceDisplay} USDC`}
                      </button>
                    )}

                    {buyStep === "error" && errorMsg && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                        <p className="text-xs text-red-400 break-all">{errorMsg}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Details — 블록체인 표준 정보 (마켓플레이스 참고 레이아웃) */}
                <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-white mb-4">Details</h3>
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
                          className="text-sm font-mono text-blue-400 hover:text-blue-300"
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
                            typeof ownerOnChain === "string"
                              ? ownerOnChain
                              : order?.offerer;
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
                              className="text-sm font-mono text-blue-400 hover:text-blue-300"
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
                        <p className="text-xs text-gray-500">Marketplace protocol</p>
                        <p className="mt-0.5">
                          <a
                            href={`https://sepolia.etherscan.io/address/${SEAPORT_ADDRESS}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 text-sm"
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
            <div className="rounded-2xl border border-gray-800/90 bg-[#0c0c0c] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-800/90">
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
                        if (otherRecipient) {
                          metaLine = `From ${shortAddr(order.offerer)} → ${shortAddr(otherRecipient)}`;
                        } else {
                          metaLine = `From ${shortAddr(order.offerer)}`;
                        }
                      } else if (order.status === "active") {
                        metaLine = `Listed by ${shortAddr(order.offerer)}`;
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
                              {meta.label}
                            </span>
                            <a
                              href={explorerSeller}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 p-1 rounded-md text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
                              title="View seller on Etherscan"
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
          </>
        )}
      </main>
    </div>
  );
}
