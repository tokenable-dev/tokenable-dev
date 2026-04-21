"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useReadContract } from "wagmi";
import { sepolia } from "@/config/wagmi";
import { getResolvedRwaAsset, type Order } from "@/lib/api";
import {
  TOKENABLE_RWA_ADDRESS,
  TOKENABLE_RWA_READ_ABI,
} from "@/constants/contracts";

function formatTokenIdShort(id: number): string {
  if (!Number.isFinite(id)) return "—";
  const s = String(Math.trunc(id));
  if (s.length <= 10) return `#${s}`;
  return `#${s.slice(0, 5)}…${s.slice(-4)}`;
}

function formatUsdc(amount: string): string {
  try {
    const n = Number(amount) / 1_000_000;
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  } catch {
    return "—";
  }
}

interface CollectionRwaCardProps {
  tokenId: number;
  /** 현재 컬렉션 키 — 상세에서 거래 후 되돌아가기용 쿼리 */
  collectionKey: string;
  /** Best active ask for this token, if any */
  listing: Order | null;
  /** Active collection-wide (criteria) bids for this collection */
  collectionBidCount: number;
  address: string | undefined;
}

export function CollectionRwaCard({
  tokenId,
  collectionKey,
  listing,
  collectionBidCount,
  address,
}: CollectionRwaCardProps) {
  const { data: metaBundle } = useQuery({
    queryKey: ["marketplace-detail-metadata", tokenId],
    queryFn: () => getResolvedRwaAsset(tokenId),
    staleTime: 60_000,
  });

  const { data: ownerOnChain } = useReadContract({
    address: TOKENABLE_RWA_ADDRESS,
    abi: TOKENABLE_RWA_READ_ABI,
    functionName: "ownerOf",
    args: [BigInt(Math.max(0, Math.floor(tokenId)))],
    chainId: sepolia.id,
  });

  const imageUrl = metaBundle?.imageUrl ?? null;
  const name = metaBundle?.metadata?.name ?? `Asset #${tokenId}`;

  const ownerAddr =
    typeof ownerOnChain === "string" ? ownerOnChain.toLowerCase() : "";
  const isOwner = !!(address && ownerAddr && address.toLowerCase() === ownerAddr);

  const fromQs = `fromCollection=${encodeURIComponent(collectionKey)}`;
  const detailHref = `/marketplace/${tokenId}?${fromQs}`;
  const sellHref = `${detailHref}&list=1`;

  return (
    <article className="group flex flex-col rounded-2xl border border-gray-800/90 bg-gray-900/35 overflow-hidden shadow-sm shadow-black/25 transition-colors hover:border-mint/30 hover:bg-gray-900/55">
      <Link
        href={detailHref}
        className="relative block aspect-[3/4] bg-gradient-to-br from-gray-900 to-gray-950"
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-contain p-2"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-[11px] text-gray-500">
            No image
          </div>
        )}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent pt-10 pb-2 px-3">
          <p className="text-[10px] font-mono text-gray-400">{formatTokenIdShort(tokenId)}</p>
          <p className="text-sm font-semibold text-white line-clamp-2 leading-snug">{name}</p>
        </div>
      </Link>

      <div className="flex flex-col gap-2 p-3 pt-2 border-t border-gray-800/80">
        {listing ? (
          <p className="text-xs text-gray-400">
            <span className="text-rose-200/95 font-semibold tabular-nums">
              ${formatUsdc(listing.considerationAmount)}
            </span>
            <span className="text-gray-600"> USDC</span>
          </p>
        ) : (
          <p className="text-xs text-gray-500">Not listed</p>
        )}

        {collectionBidCount > 0 && (
          <p className="text-[10px] text-emerald-400/90">
            {collectionBidCount} collection bid{collectionBidCount === 1 ? "" : "s"}
          </p>
        )}

        <div className="mt-1">
          {isOwner ? (
            <Link
              href={listing ? detailHref : sellHref}
              className="inline-flex w-full min-w-0 justify-center items-center rounded-lg bg-mint/15 px-2 py-2 text-xs font-semibold text-mint border border-mint-deep/35 hover:bg-mint/25 transition-colors"
            >
              {listing ? "Manage listing" : "List for sale"}
            </Link>
          ) : (
            <Link
              href={detailHref}
              className="inline-flex w-full min-w-0 justify-center items-center rounded-lg bg-gray-800/80 px-2 py-2 text-xs font-semibold text-gray-100 border border-gray-700 hover:bg-gray-800 transition-colors"
            >
              {listing ? "View listing" : "View asset"}
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
