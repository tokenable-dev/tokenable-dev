"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  usePublicClient,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits, formatUnits, parseAbiItem } from "viem";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useShallow } from "zustand/react/shallow";
import {
  getMarketplaceListing,
  fetchIpfsMetadata,
  resolveIpfsImage,
} from "@/lib/api";
import { NftImageZoom } from "@/components/NftImageZoom";
import {
  SKY_NFT_ADDRESS,
  USDC_ADDRESS,
  MARKETPLACE_ADDRESS,
  USDC_ABI,
  MARKETPLACE_ABI,
} from "@/constants/contracts";

// ── Parsed event ABIs (more reliable than raw objects with viem getLogs) ──────
const EV_MINTED = parseAbiItem(
  "event Minted(address indexed to, uint256 indexed tokenId, string tokenURI)",
);
const EV_LISTED = parseAbiItem(
  "event Listed(uint256 indexed tokenId, address indexed seller, uint256 price)",
);
const EV_SOLD = parseAbiItem(
  "event Sold(uint256 indexed tokenId, address indexed buyer, uint256 price)",
);
const EV_CANCELLED = parseAbiItem("event Cancelled(uint256 indexed tokenId)");
import { besu } from "@/config/wagmi";
import {
  useAppStore,
  selectWallet,
  selectUsdcBalance,
  selectRefresh,
} from "@/store";

// ─── Types ────────────────────────────────────────────────────────────────────

type BuyStep = "idle" | "approving" | "buying" | "success" | "error";

type ActivityEventType = "Mint" | "Listed" | "Sold" | "Cancelled";

interface ActivityEvent {
  type: ActivityEventType;
  blockNumber: bigint;
  txHash: string;
  timestamp?: number;
  from?: string;
  to?: string;
  price?: string;
}

// ─── Activity history hook ────────────────────────────────────────────────────

/**
 * Safely call getLogs — returns [] and logs to console on failure.
 * This prevents one failing call from killing the whole activity fetch.
 */
async function safeGetLogs<T>(
  fn: () => Promise<T[]>,
  label: string,
): Promise<T[]> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[Activity] getLogs failed for ${label}:`, err);
    return [];
  }
}

/** Besu (and most nodes) limit eth_getLogs block range. Use a safe window. */
const ACTIVITY_BLOCK_RANGE = BigInt(3000);

function useActivityHistory(tokenId: number) {
  const publicClient = usePublicClient({ chainId: besu.id });

  return useQuery({
    queryKey: ["nft-activity", tokenId],
    queryFn: async (): Promise<ActivityEvent[]> => {
      if (!publicClient) return [];

      const tokenIdBig = BigInt(tokenId);

      // Get current block and compute a safe range (avoids "exceeds RPC range limit")
      const latestBlock = await publicClient.getBlockNumber();
      const fromBlock =
        latestBlock > ACTIVITY_BLOCK_RANGE
          ? latestBlock - ACTIVITY_BLOCK_RANGE
          : BigInt(0);

      const blockRange = { fromBlock, toBlock: "latest" as const };

      // Each call is isolated — a single failure won't block the others
      const [mintedLogs, listedLogs, soldLogs, cancelledLogs] =
        await Promise.all([
          safeGetLogs(
            () =>
              publicClient.getLogs({
                address: SKY_NFT_ADDRESS,
                event: EV_MINTED,
                args: { tokenId: tokenIdBig },
                ...blockRange,
              }),
            "Minted",
          ),
          safeGetLogs(
            () =>
              publicClient.getLogs({
                address: MARKETPLACE_ADDRESS,
                event: EV_LISTED,
                args: { tokenId: tokenIdBig },
                ...blockRange,
              }),
            "Listed",
          ),
          safeGetLogs(
            () =>
              publicClient.getLogs({
                address: MARKETPLACE_ADDRESS,
                event: EV_SOLD,
                args: { tokenId: tokenIdBig },
                ...blockRange,
              }),
            "Sold",
          ),
          safeGetLogs(
            () =>
              publicClient.getLogs({
                address: MARKETPLACE_ADDRESS,
                event: EV_CANCELLED,
                args: { tokenId: tokenIdBig },
                ...blockRange,
              }),
            "Cancelled",
          ),
        ]);

      // Collect unique block numbers to fetch timestamps in one batch
      const blockNums = new Set<bigint>();
      [...mintedLogs, ...listedLogs, ...soldLogs, ...cancelledLogs].forEach(
        (l) => l.blockNumber && blockNums.add(l.blockNumber),
      );

      const blockTimestamps = new Map<bigint, number>();
      await Promise.all(
        [...blockNums].map(async (bn) => {
          try {
            const block = await publicClient.getBlock({ blockNumber: bn });
            blockTimestamps.set(bn, Number(block.timestamp));
          } catch {
            // timestamp stays undefined — not a blocking failure
          }
        }),
      );

      const events: ActivityEvent[] = [];

      mintedLogs.forEach((log) => {
        const args = log.args as { to?: string };
        events.push({
          type: "Mint",
          blockNumber: log.blockNumber ?? BigInt(0),
          txHash: log.transactionHash ?? "",
          timestamp: log.blockNumber
            ? blockTimestamps.get(log.blockNumber)
            : undefined,
          to: args.to,
        });
      });

      listedLogs.forEach((log) => {
        const args = log.args as { seller?: string; price?: bigint };
        events.push({
          type: "Listed",
          blockNumber: log.blockNumber ?? BigInt(0),
          txHash: log.transactionHash ?? "",
          timestamp: log.blockNumber
            ? blockTimestamps.get(log.blockNumber)
            : undefined,
          from: args.seller,
          price: args.price ? formatUnits(args.price, 6) : undefined,
        });
      });

      soldLogs.forEach((log) => {
        const args = log.args as { buyer?: string; price?: bigint };
        events.push({
          type: "Sold",
          blockNumber: log.blockNumber ?? BigInt(0),
          txHash: log.transactionHash ?? "",
          timestamp: log.blockNumber
            ? blockTimestamps.get(log.blockNumber)
            : undefined,
          to: args.buyer,
          price: args.price ? formatUnits(args.price, 6) : undefined,
        });
      });

      cancelledLogs.forEach((log) => {
        events.push({
          type: "Cancelled",
          blockNumber: log.blockNumber ?? BigInt(0),
          txHash: log.transactionHash ?? "",
          timestamp: log.blockNumber
            ? blockTimestamps.get(log.blockNumber)
            : undefined,
        });
      });

      return events.sort((a, b) => Number(b.blockNumber - a.blockNumber));
    },
    enabled: !!publicClient,
    staleTime: 30_000,
    retry: 1,
  });
}

// ─── Helper components ────────────────────────────────────────────────────────

function shortAddr(addr?: string) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function timeAgo(ts?: number): string {
  if (!ts) return "";
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const EVENT_STYLES: Record<
  ActivityEventType,
  { bg: string; text: string; icon: string; label: string }
> = {
  Mint: {
    bg: "bg-purple-900/40 border-purple-700/40",
    text: "text-purple-300",
    icon: "✦",
    label: "Mint",
  },
  Listed: {
    bg: "bg-blue-900/40 border-blue-700/40",
    text: "text-blue-300",
    icon: "◈",
    label: "Listed",
  },
  Sold: {
    bg: "bg-green-900/40 border-green-700/40",
    text: "text-green-300",
    icon: "◆",
    label: "Sale",
  },
  Cancelled: {
    bg: "bg-gray-800/60 border-gray-700/40",
    text: "text-gray-400",
    icon: "✕",
    label: "Cancelled",
  },
};

function ActivityRow({ event }: { event: ActivityEvent }) {
  const style = EVENT_STYLES[event.type];
  return (
    <div
      className={`flex items-start gap-4 p-4 rounded-xl border ${style.bg} transition-colors`}
    >
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold ${style.text} bg-black/20`}
      >
        {style.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-semibold ${style.text}`}>
            {style.label}
          </span>
          {event.price && (
            <span className="text-sm font-bold text-white">
              {parseFloat(event.price).toLocaleString()} USDC
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
          {event.type === "Mint" && event.to && (
            <span>
              To{" "}
              <span className="font-mono text-gray-400">
                {shortAddr(event.to)}
              </span>
            </span>
          )}
          {event.type === "Listed" && event.from && (
            <span>
              From{" "}
              <span className="font-mono text-gray-400">
                {shortAddr(event.from)}
              </span>
            </span>
          )}
          {event.type === "Sold" && event.to && (
            <span>
              To{" "}
              <span className="font-mono text-gray-400">
                {shortAddr(event.to)}
              </span>
            </span>
          )}
          {event.timestamp && (
            <span className="text-gray-600">{timeAgo(event.timestamp)}</span>
          )}
        </div>
      </div>
      {event.txHash && (
        <span
          className="text-xs font-mono text-gray-700 truncate max-w-24 shrink-0 hidden sm:block"
          title={event.txHash}
        >
          {event.txHash.slice(0, 10)}…
        </span>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NftDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tokenId = Number(params.tokenId);

  const { address, isConnected } = useAppStore(useShallow(selectWallet));
  const { usdcBalance, usdcBalanceFormatted } = useAppStore(
    useShallow(selectUsdcBalance),
  );
  const refresh = useAppStore(selectRefresh);

  const publicClient = usePublicClient({ chainId: besu.id });
  const queryClient = useQueryClient();
  const { writeContractAsync } = useWriteContract();

  const [buyStep, setBuyStep] = useState<BuyStep>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [approveTxHash, setApproveTxHash] = useState<
    `0x${string}` | undefined
  >();

  useWaitForTransactionReceipt({ hash: approveTxHash, chainId: besu.id });

  // ── Data fetching ──────────────────────────────────────────────────────────

  const {
    data: listing,
    isLoading: listingLoading,
    isError: listingError,
  } = useQuery({
    queryKey: ["marketplace-listing", tokenId],
    queryFn: () => getMarketplaceListing(tokenId),
    retry: 1,
  });

  const { data: metadata, isLoading: metaLoading } = useQuery({
    queryKey: ["nft-metadata", tokenId],
    queryFn: () =>
      listing?.tokenURI
        ? fetchIpfsMetadata(listing.tokenURI)
        : Promise.resolve(null),
    enabled: !!listing?.tokenURI,
  });

  const {
    data: activity,
    isLoading: activityLoading,
    isError: activityError,
    refetch: refetchActivity,
  } = useActivityHistory(tokenId);

  // ── Buy logic ──────────────────────────────────────────────────────────────

  const isSelf = address?.toLowerCase() === listing?.seller.toLowerCase();
  const priceInUnits = listing ? parseUnits(listing.price, 6) : BigInt(0);
  const hasEnoughUsdc = isSelf || usdcBalance >= priceInUnits;
  const isBuying = buyStep === "approving" || buyStep === "buying";

  async function handleBuy() {
    if (!address || !listing) return;
    setBuyStep("approving");
    setErrorMsg("");
    try {
      const approveTx = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: "approve",
        args: [MARKETPLACE_ADDRESS, priceInUnits],
        chainId: besu.id,
      });
      setApproveTxHash(approveTx);

      setBuyStep("buying");
      const buyTx = await writeContractAsync({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "buyItem",
        args: [BigInt(tokenId)],
        chainId: besu.id,
      });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: buyTx });
      }

      setBuyStep("success");
      refresh();
      await queryClient.invalidateQueries({
        queryKey: ["marketplace-listings"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["marketplace-listing", tokenId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["nft-activity", tokenId],
      });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Transaction failed");
      setBuyStep("error");
    }
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const imageUrl = metadata?.image ? resolveIpfsImage(metadata.image) : null;
  const isPageLoading = listingLoading || metaLoading;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* ── Header ── */}
      <header className="border-b border-gray-800/60 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3 text-sm">
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
        {/* ── Loading skeleton ── */}
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

        {/* ── Not found ── */}
        {listingError && !isPageLoading && (
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

        {/* ── Main content ── */}
        {!isPageLoading && listing && (
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

                {/* Attributes */}
                {metadata?.attributes && metadata.attributes.length > 0 && (
                  <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      Details
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {metadata.attributes.map((attr) => (
                        <span
                          key={attr.trait_type}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-full text-xs"
                        >
                          <span className="text-gray-500">
                            {attr.trait_type}
                          </span>
                          <span className="text-white font-medium">
                            {attr.value}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right — Info & Buy */}
              <div className="space-y-4">
                {/* Status badge */}
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-900/40 border border-blue-700/40 text-blue-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
                    Listed for Sale
                  </span>
                  <span className="text-xs text-gray-600">
                    SkyNFT #{tokenId}
                  </span>
                </div>

                {/* Title */}
                <div>
                  <h1 className="text-3xl font-extrabold text-white leading-tight">
                    {metadata?.name ?? `SkyNFT #${tokenId}`}
                  </h1>
                  {metadata?.description && (
                    <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                      {metadata.description}
                    </p>
                  )}
                </div>

                {/* Owned by */}
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">Owned by</span>
                  <span className="font-mono text-blue-400 font-medium">
                    {shortAddr(listing.seller)}
                    {isSelf && (
                      <span className="ml-1.5 text-xs text-yellow-500">
                        (You)
                      </span>
                    )}
                  </span>
                </div>

                {/* Price card */}
                <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">
                    Price
                  </p>
                  <p className="text-4xl font-extrabold text-white">
                    {parseFloat(listing.price).toLocaleString()}
                    <span className="text-xl text-gray-400 ml-2">USDC</span>
                  </p>
                  {isConnected && address && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Your balance</span>
                      <span
                        className={
                          hasEnoughUsdc ? "text-gray-300" : "text-orange-400"
                        }
                      >
                        {parseFloat(usdcBalanceFormatted).toLocaleString()} USDC
                      </span>
                    </div>
                  )}
                </div>

                {/* Buy section */}
                {buyStep === "success" ? (
                  <div className="bg-emerald-900/30 border border-emerald-700/40 rounded-2xl p-6 text-center">
                    <div className="text-4xl mb-2">🎉</div>
                    <p className="text-lg font-bold text-emerald-400">
                      Purchase Complete!
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      NFT #{tokenId} is now yours.
                    </p>
                    <button
                      onClick={() => router.push("/?tab=my-nfts")}
                      className="mt-4 w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-xl transition-colors"
                    >
                      View My NFTs →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Progress steps */}
                    {isBuying && (
                      <div className="flex gap-2">
                        {[
                          {
                            label: "1. Approve USDC",
                            active: buyStep === "approving",
                          },
                          {
                            label: "2. Buy NFT",
                            active: buyStep === "buying",
                          },
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
                        Insufficient USDC. Go to Marketplace → Get 10,000 USDC.
                      </div>
                    ) : (
                      <button
                        onClick={() => void handleBuy()}
                        disabled={isBuying}
                        className="w-full py-4 text-base font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl transition-all shadow-lg shadow-emerald-900/30"
                      >
                        {isBuying
                          ? "Processing…"
                          : `Buy Now · ${parseFloat(listing.price).toLocaleString()} USDC`}
                      </button>
                    )}

                    {buyStep === "error" && errorMsg && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                        <p className="text-xs text-red-400 break-all">
                          {errorMsg}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Token URI */}
                <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-3">
                  <p className="text-xs text-gray-600 mb-1">Token URI</p>
                  <p className="text-xs font-mono text-gray-500 break-all">
                    {listing.tokenURI}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Activity History ── */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">
                  Activity History
                </h2>
                {!activityLoading && (
                  <button
                    onClick={() => void refetchActivity()}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded-lg hover:bg-gray-800"
                  >
                    ↻ Refresh
                  </button>
                )}
              </div>

              {/* Loading */}
              {activityLoading && (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="h-16 bg-gray-800 rounded-xl animate-pulse"
                    />
                  ))}
                </div>
              )}

              {/* Error fetching logs */}
              {!activityLoading && activityError && (
                <div className="flex items-center justify-between px-4 py-3 bg-red-900/20 border border-red-800/40 rounded-xl">
                  <p className="text-sm text-red-400">
                    Failed to load activity. Check browser console for details.
                  </p>
                  <button
                    onClick={() => void refetchActivity()}
                    className="text-xs text-red-400 hover:text-red-200 transition-colors ml-4 shrink-0"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Empty state */}
              {!activityLoading &&
                !activityError &&
                (!activity || activity.length === 0) && (
                  <p className="text-gray-600 text-sm py-6 text-center border border-gray-800 rounded-xl">
                    No activity found
                  </p>
                )}

              {/* Events list */}
              {!activityLoading &&
                !activityError &&
                activity &&
                activity.length > 0 && (
                  <div className="space-y-2">
                    {activity.map((event, i) => (
                      <ActivityRow key={`${event.txHash}-${i}`} event={event} />
                    ))}
                  </div>
                )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
