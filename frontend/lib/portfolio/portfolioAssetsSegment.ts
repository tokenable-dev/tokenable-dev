import type { RedeemSurfaceBadge } from "@/lib/portfolio/redeemDraft";

/** Portfolio.html My Assets segment chips / filter drawer. */
export type AssetsSegment =
  | "all"
  | "tradeable"
  | "notlisted"
  | "listed"
  | "shipping"
  | "verifying";

export type HoldingsLifecycleSeg =
  | "notlisted"
  | "listed"
  | "shipping"
  | "verifying"
  | "possession";

export const ASSETS_SEGMENT_OPTIONS: { id: AssetsSegment; label: string }[] = [
  { id: "tradeable", label: "Tradeable" },
  { id: "all", label: "All" },
  { id: "notlisted", label: "Not listed" },
  { id: "listed", label: "Listed" },
  { id: "shipping", label: "Shipping out" },
  { id: "verifying", label: "Verifying" },
];

export function holdingsLifecycleSeg(
  isListed: boolean,
  redeemStatus: RedeemSurfaceBadge | null,
): HoldingsLifecycleSeg {
  if (redeemStatus?.kind === "possession") return "possession";
  if (redeemStatus?.kind === "transit") return "shipping";
  if (
    redeemStatus?.kind === "preparing" ||
    redeemStatus?.kind === "custody_pending"
  ) {
    return "verifying";
  }
  return isListed ? "listed" : "notlisted";
}

/** Design: possession rows never appear under My Assets. */
export function matchesAssetsSegment(
  seg: HoldingsLifecycleSeg,
  filter: AssetsSegment,
): boolean {
  if (seg === "possession") return false;
  if (filter === "all") return true;
  if (filter === "tradeable") return seg === "listed" || seg === "notlisted";
  return seg === filter;
}
