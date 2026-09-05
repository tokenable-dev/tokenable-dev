"use client";

import Link from "next/link";
import { IBM_Plex_Sans } from "next/font/google";
import { useReadContract } from "wagmi";
import { type Order, type RwaMetadata } from "@/lib/core";
import { TOKENABLE_RWA_READ_ABI } from "@/constants/contracts";
import { useAppChain } from "@/providers/AppChainProvider";
import { useChainContracts } from "@/hooks/chain/useChainContracts";
import { TkButton } from "@/components/ds";
import { COLLECTION_LISTING_CARD_CHROME } from "@/components/marketplace/collectionOverviewChrome";
import { COLLECTION_MOBILE_LISTING_IMG_CLASS } from "@/lib/marketplace/collectionListingUtils";
import { PRODUCT_OUTLINE_GRADIENT } from "@/components/ui/GradientOutlineFrame";
import {
  buildRwaAssetDetailHeadlineParts,
  formatAssetDetailHeadlineText,
} from "@/lib/marketplace/assetDetailHeadline";
import { displayAssetNameFromMetadata } from "@/lib/marketplace/rwaDisplayTitle";
import { useCollectionDetailMobile } from "@/hooks/collection-detail";
import { useCollectionRwaCardData } from "@/hooks/collection-listings/useCollectionRwaCardData";
import { formatUsdcAtomicAmount } from "@/lib/marketplace/collection-trading/orderUsdcFormat";
import { listingVaultBadge } from "@/lib/marketplace/collectionListingModalHelpers";

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

/**
 * Gradient rim pill on listing cards — always visible; Buy gets stronger chrome.
 * The whole {@link CollectionRwaCard} is a Link; this layer is decorative (`aria-hidden`).
 */
function ListingCtaPill({
  label,
  compact = false,
  mobileListing = false,
}: {
  label: string;
  compact?: boolean;
  /** Collection detail mobile grid — full-width pill under card image. */
  mobileListing?: boolean;
}) {
  const isBuy = label === "Buy";

  if (mobileListing) {
    if (isBuy) {
      return (
        <span
          className={`${rwaCardFont.className} relative z-[2] box-border inline-flex h-6 min-h-6 min-w-[4.75rem] shrink-0 items-center justify-center rounded-full border border-mint/80 bg-transparent px-6 text-center text-xs font-bold leading-none text-mint transition-[transform,opacity] duration-200 ease-out [-webkit-tap-highlight-color:transparent] group-active:scale-[0.98] motion-reduce:transition-none`}
          aria-hidden
        >
          {label}
        </span>
      );
    }

    return (
      <span
        className="relative z-[2] box-border flex h-6 min-h-6 w-full min-w-0 max-w-none shrink-0 items-center justify-center rounded-full p-[1.5px] text-center"
        style={{ background: PRODUCT_OUTLINE_GRADIENT }}
        aria-hidden
      >
        <span
          className={`${rwaCardFont.className} flex h-full w-full items-center justify-center rounded-full border border-black/80 bg-black px-3 text-[10px] font-bold leading-none text-white`}
        >
          {label}
        </span>
      </span>
    );
  }

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
            : "bg-black text-xs font-bold text-white group-hover:bg-zinc-950 sm:text-[13px]"
        }`}
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
  /** Tighter 2-col grid on collection detail mobile. */
  compact?: boolean;
  /** Collection detail listings grid — smaller Buy CTA + used with wider grid gap. */
  collectionDetailListing?: boolean;
  /** Collection detail — open listing modal instead of navigating away. */
  onOpenListing?: (tokenId: number, action?: "view" | "buy" | "bid") => void;
}

export function CollectionRwaCard({
  tokenId,
  collectionKey,
  listing,
  address,
  prefetchedImageUrl,
  prefetchedMetadata,
  compact = false,
  collectionDetailListing = false,
  onOpenListing,
}: CollectionRwaCardProps) {
  const { chainId } = useAppChain();
  const { rwaAddress } = useChainContracts();
  const useCompact = compact && useCollectionDetailMobile();
  const { metaBundle, metadata, imageUrl: resolvedImageUrl } = useCollectionRwaCardData({
    tokenId,
    prefetchedImageUrl,
    prefetchedMetadata,
  });

  const { data: ownerOnChain } = useReadContract({
    address: rwaAddress,
    abi: TOKENABLE_RWA_READ_ABI,
    functionName: "ownerOf",
    args: [BigInt(Math.max(0, Math.floor(tokenId)))],
    chainId,
  });

  const imageUrl = resolvedImageUrl;
  const listingPrice =
    listing != null ? formatUsdcAtomicAmount(listing.considerationAmount) : null;
  const sellerAddr = listing
    ? (listing.offerer || listing.parameters?.offerer)
    : undefined;
  const sellerDisplay =
    listing?.sellerDisplayName?.trim() || shortenAddr(sellerAddr);
  const vaultBadge = listingVaultBadge(listing);

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

  if (collectionDetailListing) {
    const openView = () => onOpenListing?.(tokenId, "view");
    const openBuy = () => onOpenListing?.(tokenId, "buy");

    return (
      <article className="cd-listing-card cd-listing-card--ds">
        {onOpenListing ? (
          <button
            type="button"
            className="cd-listing-card__img-wrap"
            onClick={openView}
          >
            <div className="cd-listing-card__overlay" aria-hidden>
              <span className="cd-listing-card__overlay-label">View details</span>
            </div>
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt=""
                className="cd-listing-card__img"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="cd-listing-card__img cd-listing-card__img--empty">No image</div>
            )}
          </button>
        ) : (
          <Link href={detailHref} className="cd-listing-card__img-wrap">
            <div className="cd-listing-card__overlay" aria-hidden>
              <span className="cd-listing-card__overlay-label">View details</span>
            </div>
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt=""
                className="cd-listing-card__img"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="cd-listing-card__img cd-listing-card__img--empty">No image</div>
            )}
          </Link>
        )}

        {listing ? (
          <div className="cd-listing-card__actions">
            {listingPrice !== "—" ? (
              <span className="cd-listing-card__price">${listingPrice}</span>
            ) : (
              <span className="cd-listing-card__price cd-listing-card__price--muted">—</span>
            )}
            {onOpenListing ? (
              <TkButton
                type="button"
                variant="primary"
                size="sm"
                className="cd-listing-card__btn cd-listing-card__btn--buy"
                onClick={openBuy}
              >
                Buy
              </TkButton>
            ) : (
              <TkButton
                variant="primary"
                size="sm"
                href={detailHref}
                className="cd-listing-card__btn cd-listing-card__btn--buy"
              >
                Buy
              </TkButton>
            )}
          </div>
        ) : (
          <div className="cd-listing-card__actions">
            {onOpenListing ? (
              <TkButton
                type="button"
                variant="primary"
                size="sm"
                className="cd-listing-card__btn"
                onClick={openView}
              >
                {ctaLabel}
              </TkButton>
            ) : (
              <TkButton variant="primary" size="sm" href={ctaHref} className="cd-listing-card__btn">
                {ctaLabel}
              </TkButton>
            )}
          </div>
        )}

        <div className="cd-listing-card__foot">
          <span
            className={`cd-listing-card__vault cd-listing-card__vault--${vaultBadge.tone}`}
            title={vaultBadge.title}
          >
            {listing ? vaultBadge.label : "—"}
          </span>
        </div>
      </article>
    );
  }

  if (useCompact) {
    return (
      <Link
        href={ctaHref}
        className={`${rwaCardFont.className} group flex w-full min-w-0 cursor-pointer self-start bg-black text-inherit no-underline outline-none`}
        aria-label={`${displayTitle} — ${ctaLabel}`}
      >
        <article className="flex w-full min-w-0 flex-col">
          <div className="relative flex w-full items-center justify-center bg-black px-1">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt=""
                className={`relative z-[1] ${COLLECTION_MOBILE_LISTING_IMG_CLASS}`}
              />
            ) : (
              <div className="flex aspect-[3/4] w-full items-center justify-center px-2 text-center text-[9px] text-zinc-500">
                No image
              </div>
            )}
          </div>

          {listing ? (
            <div className="mt-2 flex min-w-0 flex-col items-center gap-1 px-1">
              <div className="max-w-full min-w-0 w-fit text-left">
                {listingPrice !== "—" ? (
                  <p className="truncate text-[15px] font-bold tabular-nums leading-none text-white">
                    ${listingPrice}
                  </p>
                ) : (
                  <p className="text-[15px] font-medium leading-none text-zinc-500">—</p>
                )}
                <p
                  className="truncate text-xs font-normal leading-snug text-zinc-500"
                  title={sellerAddr}
                >
                  Seller:{" "}
                  <span className="tabular-nums" title={sellerAddr}>
                    {sellerDisplay}
                  </span>
                </p>
              </div>
              <div className="mt-1 flex justify-center">
                <ListingCtaPill label={ctaLabel} mobileListing />
              </div>
            </div>
          ) : (
            <div className="mt-2 flex min-w-0 flex-col items-center gap-1.5 px-1">
              <p className="w-fit text-left text-[15px] font-medium leading-none text-zinc-500">
                —
              </p>
              <ListingCtaPill label={ctaLabel} mobileListing />
            </div>
          )}
        </article>
      </Link>
    );
  }

  return (
    <Link
      href={ctaHref}
      className={`group flex h-full w-full min-w-0 cursor-pointer text-inherit no-underline outline-none ${
        collectionDetailListing ? "cd-listing-card" : COLLECTION_LISTING_CARD_CHROME
      }`}
      aria-label={`Listing ${formatTokenIdShort(tokenId)} — ${ctaLabel}`}
    >
      <article className="flex h-full w-full min-w-0 flex-col overflow-hidden">
        <div
          className={`relative flex w-full items-center justify-center bg-black ${
            collectionDetailListing
              ? "aspect-[4/5] p-0.5 sm:p-1 lg:aspect-[5/6] lg:p-0.5"
              : "min-h-[88px] flex-1 flex-col sm:min-h-[120px] sm:p-1.5"
          }`}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              className={
                collectionDetailListing
                  ? "relative z-[1] h-[92%] w-[92%] max-h-full max-w-full object-contain object-center lg:h-[86%] lg:w-[86%]"
                  : "h-full w-full max-w-full flex-1 object-contain object-center min-h-0"
              }
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
            <div className="mx-auto w-full min-w-0 max-w-full px-0.5">
              <ListingCtaPill label={ctaLabel} compact={false} />
            </div>
          </div>
        </div>

        <div
          className={`${rwaCardFont.className} flex shrink-0 flex-col bg-black px-2 pb-1 pt-1.5 leading-[140%] tracking-normal sm:px-3 sm:pb-1.5 sm:pt-2.5 ${
            collectionDetailListing ? "lg:px-1.5 lg:pb-1 lg:pt-1" : ""
          }`}
        >
          {listing && listingPrice !== "—" ? (
            <p
              className={`text-[13px] font-medium font-semibold tabular-nums text-white [overflow-wrap:anywhere] sm:text-[16px] ${
                collectionDetailListing ? "lg:text-[12px]" : ""
              }`}
            >
              ${listingPrice}
            </p>
          ) : (
            <p
              className={`text-[13px] font-medium text-zinc-500 sm:text-[16px] ${
                collectionDetailListing ? "lg:text-[12px]" : ""
              }`}
            >
              —
            </p>
          )}
          <p
            className={`mt-0.5 min-w-0 break-words text-[10px] font-normal text-[#a0a0a0] [overflow-wrap:anywhere] sm:mt-1 sm:text-[12px] ${
              collectionDetailListing ? "lg:mt-0.5 lg:text-[10px]" : ""
            }`}
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
