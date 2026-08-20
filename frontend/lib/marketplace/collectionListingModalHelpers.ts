import type { Order, RwaMetadata } from "@/lib/core";
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

/** Placeholder ask so Place Bid can run without an active listing (RWA + collection). */
export function stubListingForOffer(tokenId: number, collectionKey: string): Order {
  return {
    id: 0,
    orderHash: "0x",
    offerer: "0x0000000000000000000000000000000000000000",
    side: "ask",
    collectionKey,
    tokenContract: "0x0000000000000000000000000000000000000000",
    tokenId: String(tokenId),
    considerationToken: "0x0000000000000000000000000000000000000000",
    considerationAmount: "0",
    parameters: {
      offerer: "0x0000000000000000000000000000000000000000",
      zone: "0x0000000000000000000000000000000000000000",
      zoneHash:
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      startTime: "0",
      endTime: "0",
      orderType: 0,
      offer: [],
      consideration: [],
      totalOriginalConsiderationItems: 0,
      salt: "0",
      conduitKey:
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      counter: "0",
    },
    signature: "0x",
    status: "active",
    startTime: new Date(0).toISOString(),
    endTime: new Date(0).toISOString(),
    createdAt: new Date(0).toISOString(),
  };
}

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
  /** Stored-at custody line (design system-2 Card.html). */
  storedAt: string;
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
    storedAt: "PSA Vault",
  };
}

/** Vault badge for listing cards / orderbook — Card.html `PSA vault` / `{Partner} vault`. */
export function listingVaultBadge(
  listing: {
    sellerDisplayName?: string | null;
    vaultLabel?: string | null;
    settlementPolicy?: "standard" | "self_vault_hold" | null;
    offerer?: string;
    parameters?: { offerer?: string };
  } | null,
): { label: string; tone: "psa" | "partner"; title?: string } {
  if (!listing) return { label: "—", tone: "psa" };
  const addr = listing.offerer || listing.parameters?.offerer;
  const tokenLabel = listing.vaultLabel?.trim();
  if (tokenLabel) {
    const tone =
      listing.settlementPolicy === "self_vault_hold" ? "partner" : "psa";
    return { label: tokenLabel, tone, title: addr };
  }
  if (listing.settlementPolicy === "standard") {
    return { label: "PSA vault", tone: "psa", title: addr };
  }
  const name = listing.sellerDisplayName?.trim();
  if (name) {
    const label = /vault$/i.test(name) ? name : `${name} vault`;
    return { label, tone: "partner", title: addr };
  }
  return { label: "PSA vault", tone: "psa", title: addr };
}

/** Desktop listing / prov sticky — Card.html vault badge. */
export function listingSellerVerifiedLabel(
  listing: {
    sellerDisplayName?: string | null;
    vaultLabel?: string | null;
    settlementPolicy?: "standard" | "self_vault_hold" | null;
    offerer?: string;
    parameters?: { offerer?: string };
  } | null,
): { label: string; title?: string; tone: "psa" | "partner" } {
  const badge = listingVaultBadge(listing);
  return { label: badge.label, title: badge.title, tone: badge.tone };
}

/** Mobile orderbook row — Card.html vault badge. */
export function listingVerifiedCollectorLabel(
  listing: {
    sellerDisplayName?: string | null;
    vaultLabel?: string | null;
    settlementPolicy?: "standard" | "self_vault_hold" | null;
    offerer?: string;
    parameters?: { offerer?: string };
  } | null,
): { label: string; title?: string; tone: "psa" | "partner" } {
  return listingVaultBadge(listing);
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

/**
 * Listing detail gallery — prefer PSA slab front/back; fall back to NFT/catalog
 * `imageUrl` when slab photos are missing (so the modal is not empty).
 */
export function listingGalleryImages(
  metadata: RwaMetadata | null,
  fallbackImageUrl?: string | null,
): ListingGalleryImage[] {
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

  if (items.length === 0) {
    const candidates = [
      fallbackImageUrl,
      metadata?.image,
      typeof metadata?.properties?.image === "string"
        ? metadata.properties.image
        : null,
    ];
    for (const candidate of candidates) {
      if (typeof candidate !== "string") continue;
      const src = normalizeListingImageUrl(candidate);
      if (!src) continue;
      items.push({ id: "asset", label: "Front", src });
      break;
    }
  }

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
