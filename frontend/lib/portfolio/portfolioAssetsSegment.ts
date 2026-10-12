import type { RedeemSurfaceBadge } from "@/lib/portfolio/redeemDraft";

/** Portfolio.html My Assets segment chips / filter drawer. */
export type AssetsSegment =
  | "all"
  | "tradeable"
  | "notlisted"
  | "listed"
  | "shipping"
  | "verifying"
  | "hidden";

export type HoldingsLifecycleSeg =
  | "notlisted"
  | "listed"
  | "shipping"
  | "verifying"
  | "possession";

/** Desktop filter dropdown + mobile drawer (Portfolio.html v36). */
export const ASSETS_FILTER_OPTIONS: { id: AssetsSegment; label: string }[] = [
  { id: "all", label: "All" },
  { id: "listed", label: "Listed" },
  { id: "notlisted", label: "Unlisted" },
  { id: "shipping", label: "Redeeming" },
  { id: "verifying", label: "Vaulting" },
  { id: "hidden", label: "Hidden" },
];

/** Mobile filter drawer (Portfolio.html `pf-fd-sheet`; hidden only on desktop select in prototype). */
export const ASSETS_SEGMENT_DRAWER_OPTIONS: { id: AssetsSegment; label: string }[] = [
  { id: "tradeable", label: "Tradeable" },
  { id: "all", label: "All" },
  { id: "notlisted", label: "Not listed" },
  { id: "listed", label: "Listed" },
  { id: "shipping", label: "Shipping out" },
  { id: "verifying", label: "Verifying" },
  { id: "hidden", label: "Hidden" },
];

/** @deprecated use ASSETS_FILTER_OPTIONS — kept for tests importing the old name */
export const ASSETS_SEGMENT_OPTIONS = ASSETS_FILTER_OPTIONS;

export function holdingsLifecycleSeg(
  isListed: boolean,
  redeemStatus: RedeemSurfaceBadge | null,
): HoldingsLifecycleSeg {
  if (redeemStatus?.kind === "possession") return "possession";
  if (
    redeemStatus?.kind === "transit" ||
    redeemStatus?.kind === "preparing" ||
    redeemStatus?.kind === "custody_pending"
  ) {
    return "shipping";
  }
  return isListed ? "listed" : "notlisted";
}

/** Design: possession rows never appear under My Assets. */
export function matchesAssetsSegment(
  seg: HoldingsLifecycleSeg,
  filter: AssetsSegment,
  opts?: { hidden?: boolean },
): boolean {
  const isHidden = opts?.hidden === true;
  if (filter === "hidden") return isHidden;
  if (isHidden) return false;
  if (seg === "possession") return false;
  if (filter === "all") return true;
  if (filter === "tradeable") return seg === "listed" || seg === "notlisted";
  return seg === filter;
}
