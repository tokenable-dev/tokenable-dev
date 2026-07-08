import type { RwaMetadata } from "@/lib/core";
import {
  formatPsaGradedByDisplay,
  psaGradePolicyInputFromGraded,
} from "@/lib/market/psaGradePolicy";
import {
  buildRwaAssetDetailHeadlineParts,
  formatAssetDetailHeadlineText,
} from "@/lib/marketplace/assetDetailHeadline";
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

function isUsableListingImageUrl(raw: string): boolean {
  const t = raw.trim();
  return (
    t.length > 0 &&
    (/^https?:\/\//i.test(t) || t.startsWith("ipfs://") || t.startsWith("//"))
  );
}

function normalizeListingImageUrl(raw: string): string {
  const t = raw.trim();
  return t.startsWith("//") ? `https:${t}` : t;
}

export type ListingGalleryImage = {
  id: string;
  label: string;
  src: string;
};

/** All displayable slab / catalog faces for listing detail (Card.html prov-thumbs). */
export function listingGalleryImages(
  metadata: RwaMetadata | null,
  frontUrl: string | null,
): ListingGalleryImage[] {
  const graded = metadata?.properties?.graded as Record<string, unknown> | undefined;
  const psa = graded?.psa as Record<string, unknown> | undefined;
  const verification = graded?.verification as Record<string, unknown> | undefined;
  const cardhedger = graded?.cardhedger as Record<string, unknown> | undefined;

  const items: ListingGalleryImage[] = [];
  const seen = new Set<string>();

  const push = (id: string, label: string, raw: unknown) => {
    if (typeof raw !== "string") return;
    const src = normalizeListingImageUrl(raw);
    if (!isUsableListingImageUrl(src) || seen.has(src)) return;
    seen.add(src);
    items.push({ id: `${id}-${items.length}`, label, src });
  };

  push("display", "Front", frontUrl);
  push("psa-front", "Front", psa?.certImageSourceUrl);
  push("verify-front", "Front", verification?.slabFront);
  push("nft", "Asset", metadata?.image);
  push("catalog", "Catalog", cardhedger?.imageUrl);
  push("psa-back", "Back", psa?.certImageBackUrl);
  push("verify-back", "Back", verification?.slabBack);
  push("slab-back", "Back", extractGradedSlabBackCandidate(metadata));

  if (items.length === 0) return items;
  if (items.length === 1) return [{ ...items[0]!, label: "Front" }];

  const frontCount = items.filter((i) => i.label === "Front").length;
  if (frontCount > 1) {
    let frontIdx = 0;
    return items.map((item) => {
      if (item.label !== "Front") return item;
      frontIdx += 1;
      return frontIdx === 1 ? item : { ...item, label: `Front ${frontIdx}` };
    });
  }

  return items;
}

export function listingImageFaces(
  metadata: RwaMetadata | null,
  frontUrl: string | null,
): { front: string | null; back: string | null } {
  const gallery = listingGalleryImages(metadata, frontUrl);
  const front = gallery.find((g) => g.label.startsWith("Front"))?.src ?? gallery[0]?.src ?? null;
  const back = gallery.find((g) => g.label.startsWith("Back"))?.src ?? null;
  return {
    front: front?.trim() ? front.trim() : null,
    back: back?.trim() ? back.trim() : null,
  };
}
