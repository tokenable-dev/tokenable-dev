"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useReadContract } from "wagmi";
import { sepolia } from "@/config/wagmi";
import { getResolvedRwaAsset, type Order, type RwaMetadata } from "@/lib/core";
import type { GradedCardMetadata } from "@/types/gradedCard";
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

function shortenAddr(addr: string | undefined): string {
  const s = (addr ?? "").trim().toLowerCase();
  if (!s.startsWith("0x") || s.length < 12) return "—";
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function certNumberFromMetadata(meta: RwaMetadata | null): string | null {
  const raw = meta?.properties?.graded;
  const g =
    raw && typeof raw === "object" ? (raw as GradedCardMetadata) : undefined;
  const fromGrade = g?.grade?.certNumber?.trim();
  const fromPsa = g?.psa?.certNumber?.trim();
  if (fromGrade) return fromGrade;
  if (fromPsa) return fromPsa;
  if (meta?.attributes) {
    for (const a of meta.attributes) {
      const tt = (a.trait_type ?? "").toLowerCase();
      if (
        (tt.includes("cert") || tt.includes("psa cert")) &&
        String(a.value ?? "").trim() !== ""
      ) {
        return String(a.value).trim();
      }
    }
  }
  return null;
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
  address: string | undefined;
}

export function CollectionRwaCard({
  tokenId,
  collectionKey,
  listing,
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
  const meta = metaBundle?.metadata ?? null;
  const name = meta?.name ?? `Asset #${tokenId}`;
  const certLabel = certNumberFromMetadata(meta);
  const sellerAddr = listing
    ? (listing.offerer || listing.parameters?.offerer)
    : undefined;

  const ownerAddr =
    typeof ownerOnChain === "string" ? ownerOnChain.toLowerCase() : "";
  const isOwner = !!(address && ownerAddr && address.toLowerCase() === ownerAddr);

  const fromQs = `fromCollection=${encodeURIComponent(collectionKey)}`;
  const detailHref = `/marketplace/${tokenId}?${fromQs}`;
  const sellHref = `${detailHref}&list=1`;

  return (
    <article className="group flex flex-col rounded-2xl border border-gray-800/90 bg-gray-900/35 overflow-hidden shadow-sm shadow-black/25 transition-colors hover:border-gray-700/80 hover:bg-gray-900/55">
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

        <dl className="grid gap-1.5 text-[10px] leading-snug text-zinc-400 sm:text-[11px]">
          <div className="flex items-baseline justify-between gap-2">
            <dt className="shrink-0 font-medium text-zinc-500">Seller</dt>
            <dd className="min-w-0 truncate font-mono text-zinc-200" title={sellerAddr}>
              {listing ? shortenAddr(sellerAddr) : "—"}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="shrink-0 font-medium text-zinc-500">Cert number</dt>
            <dd className="min-w-0 truncate text-right tabular-nums text-zinc-200" title={certLabel ?? ""}>
              {certLabel ?? "—"}
            </dd>
          </div>
        </dl>

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
