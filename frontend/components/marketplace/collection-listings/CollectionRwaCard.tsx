"use client";

import Link from "next/link";
import { IBM_Plex_Sans } from "next/font/google";
import { useReadContract } from "wagmi";
import { sepolia } from "@/config/wagmi";
import { type Order, type RwaMetadata } from "@/lib/core";
import {
  TOKENABLE_RWA_ADDRESS,
  TOKENABLE_RWA_READ_ABI,
} from "@/constants/contracts";
import { COLLECTION_LISTING_CARD_CHROME } from "@/components/marketplace/collectionOverviewChrome";
import { PRODUCT_OUTLINE_GRADIENT } from "@/components/ui/GradientOutlineFrame";
import {
  buildRwaAssetDetailHeadlineParts,
  formatAssetDetailHeadlineText,
} from "@/lib/marketplace/assetDetailHeadline";
import { displayAssetNameFromMetadata } from "@/lib/marketplace/rwaDisplayTitle";
import { useCollectionDetailMobile } from "@/hooks/collection-detail";
import { useCollectionRwaCardData } from "@/hooks/collection-listings/useCollectionRwaCardData";

const rwaCardFont = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const LISTING_IMAGE_STAGE =
  "bg-[radial-gradient(ellipse_85%_72%_at_50%_100%,rgba(58,62,74,0.5)_0%,rgba(22,24,30,0.92)_52%,#0a0b0e_100%)]";

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

function formatUsdc(amount: string): string {
  try {
    const n = Number(amount) / 1_000_000;
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  } catch {
    return "—";
  }
}

/**
 * Gradient rim pill on listing cards — always visible; Buy gets stronger chrome.
 * The whole {@link CollectionRwaCard} is a Link; this layer is decorative (`aria-hidden`).
 */
function ListingCtaPill({ label, compact = false }: { label: string; compact?: boolean }) {
  const isBuy = label === "Buy";

  if (compact) {
    return (
      <span
        className={`relative z-[2] box-border flex w-full min-w-0 max-w-none shrink-0 items-center justify-center rounded-lg p-[1.5px] text-center ${
          isBuy ? "h-6 min-h-6" : "h-5 min-h-5"
        }`}
        style={{ background: PRODUCT_OUTLINE_GRADIENT }}
        aria-hidden
      >
        <span
          className={`${rwaCardFont.className} flex h-full w-full items-center justify-center rounded-[6px] border border-black/80 bg-black px-2 text-[10px] font-bold leading-none ${
            isBuy ? "text-mint" : "text-white"
          }`}
        >
          {label}
        </span>
      </span>
    );
  }

  return (
    <span
      className={`relative z-[2] box-border flex w-full min-w-0 max-w-none shrink-0 items-center justify-center rounded-2xl text-center transition-[transform,box-shadow,filter] duration-200 ease-out [-webkit-tap-highlight-color:transparent] group-hover:scale-[1.03] group-active:scale-[0.99] motion-reduce:transition-none motion-reduce:group-hover:scale-100 ${
        isBuy
          ? "h-8 min-h-8 p-[2px] shadow-[0_8px_22px_-6px_rgba(0,0,0,0.9),0_0_22px_-2px_rgba(16,211,51,0.55)] group-hover:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.92),0_0_32px_-2px_rgba(16,211,51,0.72)] sm:h-10 sm:min-h-10 sm:rounded-[20px] sm:p-[2.5px]"
          : "h-7 min-h-7 p-[1.5px] shadow-[0_6px_16px_-8px_rgba(0,0,0,0.85),0_0_12px_-4px_rgba(16,211,51,0.25)] group-hover:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.9),0_0_18px_-4px_rgba(16,211,51,0.4)] sm:h-9 sm:min-h-9 sm:rounded-[18px]"
      }`}
      style={{ background: PRODUCT_OUTLINE_GRADIENT }}
      aria-hidden
    >
      <span
        className={`${rwaCardFont.className} flex h-full min-h-0 w-full min-w-0 items-center justify-center rounded-[14px] border border-black/80 px-3 py-0.5 leading-snug tracking-wide transition-[background-color,box-shadow,color] duration-200 ease-out sm:rounded-[17px] sm:px-5 sm:py-1 ${
          isBuy
            ? "bg-black text-[12px] font-bold text-mint shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] group-hover:bg-zinc-950 group-hover:brightness-110 sm:text-[14px]"
            : "bg-black text-[11px] font-bold text-white group-hover:bg-zinc-950 sm:text-[13px]"
        }`}
      >
        {label}
      </span>
    </span>
  );
}

function ListedStatusBadge() {
  return (
    <div
      className="pointer-events-none absolute left-2 top-2 z-[3] flex items-center gap-1.5 rounded-full border border-emerald-900/60 bg-[#0f1a14]/90 px-2 py-[3px] backdrop-blur-[2px]"
      aria-hidden
    >
      <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-mint shadow-[0_0_6px_rgba(16,211,51,0.65)]" />
      <span className={`${rwaCardFont.className} text-[10px] font-medium leading-none text-white`}>
        Listed
      </span>
    </div>
  );
}

interface CollectionRwaCardProps {
  tokenId: number;
  /** 현재 컬렉션 키 — 상세에서 거래 후 되돌아가기용 쿼리 */
  collectionKey: string;
  /** Best active ask for this token, if any */
  listing: Order | null;
  address: string | undefined;
  /** Pre-fetched image URL from parent batch request — skips individual fetch when provided */
  prefetchedImageUrl?: string | null;
  /** Pre-fetched metadata from parent batch request — skips individual fetch when provided */
  prefetchedMetadata?: RwaMetadata | null;
  /** Tighter 2-col grid on collection detail mobile. */
  compact?: boolean;
}

export function CollectionRwaCard({
  tokenId,
  collectionKey,
  listing,
  address,
  prefetchedImageUrl,
  prefetchedMetadata,
  compact = false,
}: CollectionRwaCardProps) {
  const useCompact = compact && useCollectionDetailMobile();
  const { metaBundle, metadata, imageUrl: resolvedImageUrl } = useCollectionRwaCardData({
    tokenId,
    prefetchedImageUrl,
    prefetchedMetadata,
  });

  const { data: ownerOnChain } = useReadContract({
    address: TOKENABLE_RWA_ADDRESS,
    abi: TOKENABLE_RWA_READ_ABI,
    functionName: "ownerOf",
    args: [BigInt(Math.max(0, Math.floor(tokenId)))],
    chainId: sepolia.id,
  });

  const imageUrl = resolvedImageUrl;
  const listingPrice =
    listing != null ? formatUsdc(listing.considerationAmount) : null;
  const sellerAddr = listing
    ? (listing.offerer || listing.parameters?.offerer)
    : undefined;
  const sellerDisplay = shortenAddr(sellerAddr);

  const displayTitle =
    formatAssetDetailHeadlineText(
      buildRwaAssetDetailHeadlineParts(metadata, formatTokenIdShort(tokenId)),
    ) ||
    displayAssetNameFromMetadata(metadata, formatTokenIdShort(tokenId));

  const ownerAddr =
    typeof ownerOnChain === "string" ? ownerOnChain.toLowerCase() : "";
  const isOwner = !!(address && ownerAddr && address.toLowerCase() === ownerAddr);

  const fromQs = `fromCollection=${encodeURIComponent(collectionKey)}`;
  const detailHref = `/marketplace/${tokenId}?${fromQs}`;
  const sellHref = `${detailHref}&list=1`;

  const ctaLabel = !listing
    ? isOwner
      ? "List for sale"
      : "View asset"
    : "Buy";

  const ctaHref =
    !listing && isOwner ? sellHref : detailHref;

  if (useCompact) {
    return (
      <Link
        href={ctaHref}
        className={`${rwaCardFont.className} group flex h-full w-full min-w-0 cursor-pointer overflow-hidden rounded-[14px] border border-zinc-800/75 bg-[#0c0d10] text-inherit no-underline outline-none transition-colors hover:border-zinc-700/80`}
        aria-label={`${displayTitle} — ${ctaLabel}`}
      >
        <article className="flex w-full min-w-0 flex-col">
          <div
            className={`relative flex aspect-[4/5] w-full min-h-0 items-center justify-center overflow-hidden ${LISTING_IMAGE_STAGE}`}
          >
            {listing ? <ListedStatusBadge /> : null}
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt=""
                className="relative z-[1] h-[88%] w-[88%] max-w-full object-contain object-center"
              />
            ) : (
              <div className="relative z-[1] px-2 text-center text-[9px] text-zinc-500">
                No image
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-2 px-2.5 pb-2.5 pt-2">
            <p
              className="min-h-[14px] min-w-0 truncate text-[12px] font-medium leading-[14px] text-white"
              title={displayTitle}
            >
              {displayTitle}
            </p>
            <div className="flex min-h-[15px] min-w-0 items-baseline leading-none">
              {listing && listingPrice !== "—" ? (
                <span className="text-[13px] font-semibold tabular-nums text-white">
                  <span className="font-normal text-zinc-500">$ </span>
                  {listingPrice}
                </span>
              ) : (
                <span className="text-[12px] font-medium text-zinc-500">—</span>
              )}
            </div>
          </div>
        </article>
      </Link>
    );
  }

  return (
    <Link
      href={ctaHref}
      className={`group flex h-full w-full min-w-0 cursor-pointer text-inherit no-underline outline-none ${COLLECTION_LISTING_CARD_CHROME}`}
      aria-label={`Listing ${formatTokenIdShort(tokenId)} — ${ctaLabel}`}
    >
      <article className="flex h-full min-h-[148px] w-full min-w-0 flex-col overflow-hidden sm:min-h-[202px]">
        <div className="relative flex min-h-[88px] flex-1 flex-col items-center justify-center bg-black p-1 sm:min-h-[120px] sm:p-1.5">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              className="h-full w-full max-w-full flex-1 object-contain object-center min-h-0"
            />
          ) : (
            <div className="px-2 text-center text-[9px] text-zinc-500">
              No image
            </div>
          )}

          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] flex justify-center bg-gradient-to-t from-black via-black/75 to-transparent px-1.5 pb-1.5 pt-10 sm:px-2 sm:pb-2 sm:pt-12"
            aria-hidden
          >
            <div className="mx-auto w-full min-w-0 max-w-[min(100%,180px)] sm:max-w-[min(100%,240px)]">
              <ListingCtaPill label={ctaLabel} compact={false} />
            </div>
          </div>
        </div>

        <div
          className={`${rwaCardFont.className} flex shrink-0 flex-col bg-black px-2 pb-1 pt-1.5 leading-[140%] tracking-normal sm:px-3 sm:pb-1.5 sm:pt-2.5`}
        >
          {listing && listingPrice !== "—" ? (
            <p className="text-[13px] font-medium font-semibold tabular-nums text-white [overflow-wrap:anywhere] sm:text-[16px]">
              ${listingPrice}
            </p>
          ) : (
            <p className="text-[13px] font-medium text-zinc-500 sm:text-[16px]">
              —
            </p>
          )}
          <p
            className="mt-0.5 min-w-0 break-words text-[10px] font-normal text-[#a0a0a0] [overflow-wrap:anywhere] sm:mt-1 sm:text-[12px]"
            title={listing ? sellerAddr : undefined}
          >
            Seller:{" "}
            <span className="break-all" title={sellerAddr}>
              {listing ? sellerDisplay : "—"}
            </span>
          </p>
        </div>
      </article>
    </Link>
  );
}
