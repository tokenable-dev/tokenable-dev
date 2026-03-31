"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWalletClient } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { sepolia } from "@/config/wagmi";
import {
  COLLECTION_BID_DOMAIN,
  COLLECTION_BID_TYPES,
  bucketKeyToBytes32,
  randomPoolBidNonce,
} from "@/lib/collectionBidTypedData";
import {
  getBucketBidsByToken,
  createPoolBid,
  cancelPoolBid,
  validatePoolBidSellerMatch,
  type BucketBid,
  type MarketBucketComponents,
} from "@/lib/api";
import { mapWalletError } from "@/lib/walletError";

const POOL_BID_DURATION_SECONDS = 30 * 24 * 60 * 60;

function shortAddr(a: string) {
  const x = a.startsWith("0x") ? a : `0x${a}`;
  if (x.length <= 14) return x;
  return `${x.slice(0, 6)}…${x.slice(-4)}`;
}

function usdcFromWei(s: string): string {
  try {
    return formatUnits(BigInt(s), 6);
  } catch {
    return "—";
  }
}

export interface PoolBidsPanelCollectionContext {
  bucketKey: string;
  components: Record<string, unknown>;
  bids: BucketBid[];
  buyerLinkTokenId?: number;
  onInvalidate: () => void;
}

/** collection = 풀 매수·목록·취소(구매자). token = 자산 상세: 판매자만 풀 매칭 UI, 구매자는 컬렉션 안내 */
export type PoolBidsPanelVariant = "collection" | "token";

interface PoolBidsPanelProps {
  tokenId?: number;
  collectionContext?: PoolBidsPanelCollectionContext;
  variant?: PoolBidsPanelVariant;
  /** variant=token 이고 구매자에게 컬렉션 링크를 줄 때 (fromCollection / listing 메타) */
  collectionKey?: string;
  address?: string;
  isOwner: boolean;
  /**
   * When true (collection page + unified order book): do not render the duplicate pool bid list;
   * bids are shown in CollectionUnifiedOrderBook. Placement form and success UI remain.
   */
  hideBidList?: boolean;
}

export function PoolBidsPanel({
  tokenId,
  collectionContext,
  variant = "token",
  collectionKey,
  address,
  isOwner,
  hideBidList = false,
}: PoolBidsPanelProps) {
  const queryClient = useQueryClient();
  const { data: walletClient } = useWalletClient({ chainId: sepolia.id });
  const [price, setPrice] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkMsg, setCheckMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [placementSuccess, setPlacementSuccess] = useState(false);
  const [copiedCollectionUrl, setCopiedCollectionUrl] = useState(false);
  const pathname = usePathname();

  const byCtx = Boolean(collectionContext);
  const byToken =
    tokenId != null && Number.isFinite(tokenId) && Number(tokenId) >= 0;

  const {
    data: fetched,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["marketplace-pool-bids", "token", tokenId],
    queryFn: () => getBucketBidsByToken(Number(tokenId)),
    enabled: !byCtx && byToken,
    staleTime: 15_000,
    retry: false,
  });

  const data = useMemo(() => {
    if (!collectionContext) return fetched;
    return {
      bucketKey: collectionContext.bucketKey,
      components: collectionContext.components as unknown as MarketBucketComponents,
      bids: collectionContext.bids,
    };
  }, [collectionContext, fetched]);

  const errText = !byCtx && isError ? "Could not load pool bids for this card." : null;

  const loading = !byCtx && isLoading;

  const showBidList =
    variant === "collection" || (variant === "token" && isOwner);
  const showBuyerPlacement = variant === "collection" && !isOwner;

  useEffect(() => {
    if (!placementSuccess) return;
    const t = window.setTimeout(() => setPlacementSuccess(false), 12000);
    return () => window.clearTimeout(t);
  }, [placementSuccess]);

  async function handlePlacePoolBid() {
    if (!address || !walletClient) return;
    const n = parseFloat(price);
    if (!Number.isFinite(n) || n <= 0) {
      setFormError("Enter a valid USDC price.");
      return;
    }
    if (!data?.bucketKey) {
      setFormError("Bucket not loaded.");
      return;
    }
    setFormError("");
    setBusy(true);
    try {
      const amount = parseUnits(price, 6).toString();
      const end = Math.floor(Date.now() / 1000) + POOL_BID_DURATION_SECONDS;
      const nonce = randomPoolBidNonce();
      const signature = await walletClient.signTypedData({
        domain: COLLECTION_BID_DOMAIN,
        types: COLLECTION_BID_TYPES,
        primaryType: "CollectionBid",
        message: {
          bucketKey: bucketKeyToBytes32(data.bucketKey),
          considerationAmount: BigInt(amount),
          endTime: BigInt(end),
          buyer: address as `0x${string}`,
          nonce: BigInt(nonce),
        },
      });
      if (collectionContext) {
        await createPoolBid({
          bucketKey: collectionContext.bucketKey,
          components: collectionContext.components as unknown as Record<string, unknown>,
          considerationAmount: amount,
          endTime: String(end),
          buyerOfferer: address,
          signature,
          nonce,
        });
        collectionContext.onInvalidate();
        setPlacementSuccess(true);
      } else {
        await createPoolBid({
          tokenId: String(tokenId),
          considerationAmount: amount,
          endTime: String(end),
          buyerOfferer: address,
          signature,
          nonce,
        });
        setPlacementSuccess(true);
      }
      setPrice("");
      await queryClient.invalidateQueries({ queryKey: ["marketplace-pool-bids"] });
    } catch (e: unknown) {
      setFormError(mapWalletError(e).message);
    } finally {
      setBusy(false);
    }
  }

  function buyerAuthUrl(bidId: number) {
    const linkT = collectionContext?.buyerLinkTokenId ?? tokenId;
    if (linkT == null || !Number.isFinite(Number(linkT))) return "";
    if (typeof window === "undefined") return "";
    const u = new URL(window.location.href);
    u.pathname = `/marketplace/${Number(linkT)}`;
    u.search = `signPoolBid=${bidId}`;
    return u.toString();
  }

  async function copyBuyerLink(bidId: number) {
    const url = buyerAuthUrl(bidId);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(bidId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setCheckMsg("Could not copy link.");
    }
  }

  async function handleCancel(bid: BucketBid) {
    if (!address) return;
    setBusy(true);
    setCheckMsg(null);
    try {
      await cancelPoolBid(bid.id, address);
      await queryClient.invalidateQueries({ queryKey: ["marketplace-pool-bids"] });
      collectionContext?.onInvalidate();
    } catch {
      setFormError("Could not cancel pool bid. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleValidateMatch(bid: BucketBid) {
    if (!address || !isOwner || tokenId == null) return;
    setBusy(true);
    setCheckMsg(null);
    try {
      const r = await validatePoolBidSellerMatch(bid.id, tokenId, address);
      setCheckMsg(r.message);
    } catch {
      setCheckMsg("Could not verify match. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copyCollectionPageUrl() {
    if (typeof window === "undefined" || !pathname) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${pathname}`);
      setCopiedCollectionUrl(true);
      window.setTimeout(() => setCopiedCollectionUrl(false), 2000);
    } catch {
      setCheckMsg("Could not copy URL.");
    }
  }

  if (!byCtx && !byToken) {
    return (
      <div className="rounded-xl border border-gray-800 bg-[#0b0e11] px-3 py-3 text-[11px] text-gray-500">
        Pool bids need <span className="text-gray-400">tokenId</span> or{" "}
        <span className="text-gray-400">collectionContext</span>.
      </div>
    );
  }

  if (variant === "token" && !isOwner) {
    const href = collectionKey?.trim()
      ? `/marketplace/collections/${encodeURIComponent(collectionKey.trim())}`
      : null;
    return (
      <div className="rounded-xl border border-gray-800/90 bg-[#0a0d11]/90 px-4 py-4 space-y-3">
        <p className="text-sm font-semibold text-gray-200">Pool bids (collection-wide)</p>
        <p className="text-xs text-gray-500 leading-relaxed">
          Same card &amp; grade pool bids are placed on the <strong className="text-gray-400">collection</strong> page,
          not on a single asset. Open the collection to bid or see all pool offers.
        </p>
        {href ? (
          <Link
            href={href}
            className="inline-flex text-sm font-medium text-mint hover:text-mint-dim hover:underline"
          >
            Go to collection →
          </Link>
        ) : (
          <p className="text-[11px] text-gray-600">
            Collection link appears when this asset is part of a graded collection (listing metadata).
          </p>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-800 bg-[#0b0e11] px-3 py-4 text-xs text-gray-500 animate-pulse">
        Loading pool order book…
      </div>
    );
  }

  if (errText || !data) {
    return (
      <div className="rounded-xl border border-gray-800 bg-[#0b0e11] px-3 py-3 space-y-1">
        <p className="text-xs font-semibold text-gray-400">Pool bids (same card &amp; grade)</p>
        <p className="text-[11px] text-gray-500 leading-relaxed">
          {errText ?? "Pool bids unavailable."}
        </p>
      </div>
    );
  }

  const { bids } = data;

  return (
    <div
      id="pool-bids"
      className="rounded-xl border border-mint-deep/25 bg-mint/[0.03] overflow-hidden scroll-mt-24"
    >
      <div className="px-3 py-2.5 border-b border-mint-deep/20 bg-mint/[0.06] flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold text-mint">
            {variant === "collection" ? "Pool bid (EIP-712)" : "Pool bids"}
          </p>
          {variant === "collection" && (
            <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">
              Place a collection-wide buy price for any asset in this graded bucket. Your bid appears in
              {hideBidList ? " the collection order book." : " the list below."}
            </p>
          )}
        </div>
        {isOwner && bids.length > 0 && showBidList && (
          <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-100/90 border border-amber-500/30">
            {bids.length} buyer{bids.length === 1 ? "" : "s"} in pool
          </span>
        )}
      </div>

      {placementSuccess && collectionContext && variant === "collection" && (
        <div className="px-3 py-2.5 border-b border-mint-deep/20 bg-mint/[0.08] space-y-2">
          <p className="text-[11px] text-mint font-medium">Pool bid is live</p>
          <p className="text-[10px] text-gray-400 leading-relaxed">
            Sellers match from their asset page after you share the invite (Copy / Mail on the pool row). When one picks your price for
            their token, you’ll sign a Seaport bid for that token — still no new contracts.
          </p>
          <button
            type="button"
            onClick={() => void copyCollectionPageUrl()}
            className="text-[10px] px-2 py-1 rounded-md border border-gray-600 text-gray-300 hover:bg-gray-800"
          >
            {copiedCollectionUrl ? "Copied" : "Copy collection page link"}
          </button>
        </div>
      )}

      {placementSuccess && !collectionContext && (
        <div className="px-3 py-2 border-b border-mint-deep/20 bg-mint/[0.06] text-[11px] text-mint">
          Pool bid placed — sellers use Check match / Buyer link below when ready.
        </div>
      )}

      {showBidList && !hideBidList && (
        <div className="px-3 py-2 space-y-2 max-h-48 overflow-y-auto">
          {bids.length === 0 ? (
            <p className="text-[11px] text-gray-500 py-2 text-center">No pool bids yet.</p>
          ) : (
            bids.map((b) => {
              const mine =
                address?.toLowerCase() === b.buyerOfferer.toLowerCase();
              return (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-800/80 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white tabular-nums">
                      {parseFloat(usdcFromWei(b.considerationAmount)).toLocaleString()}{" "}
                      <span className="text-xs font-medium text-gray-500">USDC</span>
                    </p>
                    <p className="text-[10px] text-gray-500 font-mono truncate">
                      {shortAddr(b.buyerOfferer)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {mine && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleCancel(b)}
                        className="text-[10px] px-2 py-1 rounded-md border border-gray-600 text-gray-400 hover:bg-gray-800 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    )}
                    {isOwner && (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleValidateMatch(b)}
                          className="text-[10px] px-2 py-1 rounded-md border border-mint-deep/40 text-mint hover:bg-mint/10 disabled:opacity-50"
                        >
                          Check match
                        </button>
                        <button
                          type="button"
                          disabled={busy || !buyerAuthUrl(b.id)}
                          onClick={() => void copyBuyerLink(b.id)}
                          className="text-[10px] px-2 py-1 rounded-md border border-gray-600 text-gray-400 hover:bg-gray-800 disabled:opacity-50"
                          title="Send to buyer so they can sign Seaport for this token"
                        >
                          {copiedId === b.id ? "Copied" : "Buyer link"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {checkMsg && (
        <div className="px-3 py-2 border-t border-gray-800/80 text-[10px] text-gray-400 leading-relaxed">
          {checkMsg}
        </div>
      )}

      {showBuyerPlacement && !address && (
        <div className="px-3 py-2.5 border-t border-gray-800/80 text-[10px] text-gray-500">
          Connect your wallet to place a pool bid.
        </div>
      )}

      {showBuyerPlacement && address && (
        <div className="px-3 py-3 border-t border-gray-800/80 space-y-2">
          <p className="text-[10px] text-gray-500">
            Pool bid — any asset in this bucket (same card &amp; grade)
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="decimal"
              placeholder="USDC"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="flex-1 min-w-0 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void handlePlacePoolBid()}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-mint/20 text-mint text-xs font-semibold border border-mint-deep/35 hover:bg-mint/30 disabled:opacity-50"
            >
              {busy ? "…" : "Bid"}
            </button>
          </div>
          {formError && <p className="text-[10px] text-red-400">{formError}</p>}
        </div>
      )}

      {!byCtx && (
        <button
          type="button"
          onClick={() => void refetch()}
          className="w-full py-1.5 text-[10px] text-gray-500 hover:text-gray-400 border-t border-gray-800/80"
        >
          Refresh
        </button>
      )}
    </div>
  );
}
