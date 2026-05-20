"use client";

import Link from "next/link";
import { IBM_Plex_Sans } from "next/font/google";
import { useQuery } from "@tanstack/react-query";
import { useReadContract } from "wagmi";
import { sepolia } from "@/config/wagmi";
import { getResolvedRwaAsset, type Order, type RwaMetadata } from "@/lib/core";
import {
  TOKENABLE_RWA_ADDRESS,
  TOKENABLE_RWA_READ_ABI,
} from "@/constants/contracts";
import { COLLECTION_LISTING_CARD_CHROME } from "@/components/marketplace/collectionOverviewChrome";
import { getCachedRwaMetadata, getCachedRwaImageUrl } from "@/lib/marketplace";

const rwaCardFont = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

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
 * Gradient rim pill — decorative; the whole {@link CollectionRwaCard} is wrapped in a Link.
 * `pointer-events-none` ancestors let presses go to the card link. Hover/focus uses parent `group`.
 */
function ListingCtaPill({ label }: { label: string }) {
  const rimGradient =
    "linear-gradient(99.67deg, #529e22 3.64%, #87FF48 54%, #284214 112.88%)";
  return (
    <span
      className="relative z-[2] box-border flex h-9 min-h-9 w-full min-w-0 max-w-none shrink-0 items-center justify-center rounded-[18px] p-[1.5px] text-center shadow-[0_7px_18px_-7px_rgba(0,0,0,0.8)] transition-[transform,box-shadow] duration-200 ease-out [-webkit-tap-highlight-color:transparent] group-hover:-translate-y-0.5 group-hover:scale-[1.02] group-hover:shadow-[0_9px_24px_-8px_rgba(0,0,0,0.88),0_0_18px_-2px_rgba(135,255,72,0.28),0_0_1px_1px_rgba(135,255,72,0.35)_inset] group-active:translate-y-0 group-active:scale-[0.99] motion-reduce:transition-none motion-reduce:group-hover:scale-100 motion-reduce:group-hover:translate-y-0 max-lg:opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-visible:opacity-100"
      style={{ background: rimGradient }}
      aria-hidden
    >
      <span
        className={`${rwaCardFont.className} flex h-full min-h-0 w-full min-w-0 items-center justify-center gap-2 rounded-[16px] bg-[rgba(11,13,16,1)] px-4 py-1 text-[13px] font-bold leading-snug tracking-wide text-white transition-[background-color,box-shadow] duration-200 ease-out group-hover:bg-[rgba(16,18,22,1)] group-hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] group-active:bg-[rgba(11,13,16,1)] sm:px-6 sm:text-[13px]`}
      >
        {label}
      </span>
    </span>
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
}

export function CollectionRwaCard({
  tokenId,
  collectionKey,
  listing,
  address,
  prefetchedImageUrl,
  prefetchedMetadata,
}: CollectionRwaCardProps) {
  const hasPrefetch =
    prefetchedImageUrl !== undefined || prefetchedMetadata !== undefined;

  const { data: metaBundle } = useQuery({
    queryKey: ["marketplace-detail-metadata", tokenId],
    queryFn: () => getResolvedRwaAsset(tokenId),
    staleTime: 60_000,
    enabled: !hasPrefetch,
    initialData: hasPrefetch
      ? undefined
      : (() => {
          const cachedMeta = getCachedRwaMetadata(tokenId) as RwaMetadata | null;
          const cachedImg = getCachedRwaImageUrl(tokenId);
          if (cachedMeta || cachedImg) {
            return {
              tokenId,
              tokenURI: "",
              metadata: cachedMeta,
              imageUrl: cachedImg,
            };
          }
          return undefined;
        })(),
  });

  const { data: ownerOnChain } = useReadContract({
    address: TOKENABLE_RWA_ADDRESS,
    abi: TOKENABLE_RWA_READ_ABI,
    functionName: "ownerOf",
    args: [BigInt(Math.max(0, Math.floor(tokenId)))],
    chainId: sepolia.id,
  });

  const imageUrl = hasPrefetch
    ? (prefetchedImageUrl ?? null)
    : (metaBundle?.imageUrl ?? null);
  const listingPrice =
    listing != null ? formatUsdc(listing.considerationAmount) : null;
  const sellerAddr = listing
    ? (listing.offerer || listing.parameters?.offerer)
    : undefined;
  const sellerDisplay = shortenAddr(sellerAddr);

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

  return (
    <Link
      href={ctaHref}
      className={`group block w-full min-w-0 cursor-pointer text-inherit no-underline outline-none ring-offset-2 ring-offset-black focus-visible:ring-2 focus-visible:ring-mint/50 ${COLLECTION_LISTING_CARD_CHROME}`}
      aria-label={`Listing ${formatTokenIdShort(tokenId)} — ${ctaLabel}`}
    >
      <article className="flex min-h-[188px] w-full min-w-0 flex-col overflow-hidden sm:min-h-[202px]">
        <div className="relative flex min-h-[110px] flex-1 flex-col items-center justify-center bg-black p-1 sm:min-h-[120px] sm:p-1.5">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              className="h-full w-full max-w-full flex-1 object-contain object-center min-h-0"
            />
          ) : (
            <div className="px-3 text-center text-[11px] text-zinc-500">
              No image
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] flex translate-y-[24%] justify-center px-1.5 sm:px-2">
            <div className="mx-auto w-full min-w-0 max-w-[min(100%,206px)] sm:max-w-[min(100%,220px)]">
              <ListingCtaPill label={ctaLabel} />
            </div>
          </div>
        </div>

        <div
          className={`${rwaCardFont.className} flex shrink-0 flex-col bg-[rgba(20,18,27,1)] px-2.5 pb-1.5 pt-2 leading-[140%] tracking-normal sm:px-3 sm:pt-2.5`}
        >
          {listing && listingPrice !== "—" ? (
            <p className="text-[15px] font-medium leading-[140%] tracking-normal text-white tabular-nums [overflow-wrap:anywhere] sm:text-[16px]">
              ${listingPrice}
            </p>
          ) : (
            <p className="text-[15px] font-medium leading-[140%] tracking-normal text-zinc-500 sm:text-[16px]">
              —
            </p>
          )}
          <p className="mt-1 min-w-0 break-words text-[11px] font-normal leading-[140%] tracking-normal text-[#a0a0a0] [overflow-wrap:anywhere] sm:text-[12px]">
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
