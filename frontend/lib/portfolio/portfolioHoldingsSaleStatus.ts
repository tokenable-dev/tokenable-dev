import type { RedeemSurfaceBadge } from "@/lib/portfolio/redeemDraft";
export {
  shortVaultChipLabel,
  vaultChipTone,
} from "@/lib/marketplace/vaultCustodyLabel";

/** Sale-state only — every card is already in a vault. */
export type HoldingsSaleKind = "not_listed" | "listed" | "redeeming";

export function holdingsSaleKind(
  isListed: boolean,
  redeemStatus: RedeemSurfaceBadge | null,
): HoldingsSaleKind {
  if (redeemStatus && redeemStatus.kind !== "possession") return "redeeming";
  if (isListed) return "listed";
  return "not_listed";
}

export function holdingsSaleStatusLabel(kind: HoldingsSaleKind): string {
  if (kind === "listed") return "Listed";
  if (kind === "redeeming") return "Redeeming";
  return "Not listed";
}
