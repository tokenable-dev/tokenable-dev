import type { RwaMetadata } from "@/lib/core";
import {
  formatPsaGradedByDisplay,
  psaGradePolicyInputFromGraded,
} from "@/lib/market/psaGradePolicy";
import {
  buildRwaAssetDetailHeadlineParts,
  formatAssetDetailHeadlineText,
} from "@/lib/marketplace/assetDetailHeadline";
import { uriNeedsBackendResolve } from "@/lib/marketplace/mediaUriResolve";
import {
  buildRwaDetailMobileTrustView,
  extractGradedSlabBackCandidate,
} from "@/lib/marketplace/rwa-detail/rwaDetailMetadata";

export function formatListingUsdc(amount: string): string {
  try {
    const n = Number(amount) / 1_000_000;
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  } catch {
    return "—";
  }
}

export function shortenWallet(addr: string | undefined): string {
  const s = (addr ?? "").trim().toLowerCase();
  if (!s.startsWith("0x") || s.length < 12) return "—";
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

export function listingAssetTitle(
  metadata: RwaMetadata | null,
  tokenId: number,
): string {
  const parts = buildRwaAssetDetailHeadlineParts(metadata, `#${tokenId}`);
  return formatAssetDetailHeadlineText(parts) || `Token #${tokenId}`;
}

export function listingVerificationTiles(metadata: RwaMetadata | null): {
  gradedBy: string;
  certNumber: string;
  vault: string;
  tokenLabel: string;
} {
  const trust = buildRwaDetailMobileTrustView(metadata);
  const graded =
    metadata?.properties?.graded && typeof metadata.properties.graded === "object"
      ? (metadata.properties.graded as Record<string, unknown>)
      : null;
  const gradedBy =
    (graded ? formatPsaGradedByDisplay(psaGradePolicyInputFromGraded(graded)) : null) ??
    trust.gradeLine?.trim() ??
    "—";
  return {
    gradedBy,
    certNumber: trust.certNumber ?? "—",
    vault: "Vaulted · Insured",
    tokenLabel: "On-chain RWA",
  };
}

function normalizeListingImageUrl(raw: string): string {
  const t = raw.trim();
  return t.startsWith("//") ? `https:${t}` : t;
}

/** Listing detail gallery — HTTPS slab photos only (no IPFS / catalog / NFT image). */
function isHttpsSlabGalleryUrl(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  const src = normalizeListingImageUrl(raw);
  if (!/^https?:\/\//i.test(src)) return false;
  if (uriNeedsBackendResolve(src)) return false;
  return src.length > 0;
}

function pickSlabGalleryUrl(...candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    if (isHttpsSlabGalleryUrl(candidate)) {
      return normalizeListingImageUrl(candidate);
    }
  }
  return null;
}

export type ListingGalleryImage = {
  id: string;
  label: string;
  src: string;
};

/** Slab front/back only for listing detail (Card.html prov-thumbs). */
export function listingGalleryImages(metadata: RwaMetadata | null): ListingGalleryImage[] {
  const graded = metadata?.properties?.graded as Record<string, unknown> | undefined;
  const psa = graded?.psa as Record<string, unknown> | undefined;
  const verification = graded?.verification as Record<string, unknown> | undefined;

  const front = pickSlabGalleryUrl(psa?.certImageSourceUrl, verification?.slabFront);
  const back = pickSlabGalleryUrl(
    psa?.certImageBackUrl,
    verification?.slabBack,
    extractGradedSlabBackCandidate(metadata),
  );

  const items: ListingGalleryImage[] = [];
  if (front) items.push({ id: "front", label: "Front", src: front });
  if (back && back !== front) items.push({ id: "back", label: "Back", src: back });
  return items;
}

export function listingImageFaces(
  metadata: RwaMetadata | null,
): { front: string | null; back: string | null } {
  const gallery = listingGalleryImages(metadata);
  const front = gallery.find((g) => g.label === "Front")?.src ?? null;
  const back = gallery.find((g) => g.label === "Back")?.src ?? null;
  return {
    front: front?.trim() ? front.trim() : null,
    back: back?.trim() ? back.trim() : null,
  };
}
