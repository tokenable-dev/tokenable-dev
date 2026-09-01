import type { RedeemSurfaceBadge } from "@/lib/portfolio/redeemDraft";
import { formatPortfolioUsd } from "@/lib/portfolio/portfolioTableHelpers";

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

export function holdingsSaleStatusLabel(
  kind: HoldingsSaleKind,
  listPriceUsd: number | null,
): string {
  if (kind === "listed" && listPriceUsd != null) {
    return `Listed · ${formatPortfolioUsd(listPriceUsd)}`;
  }
  if (kind === "listed") return "Listed";
  if (kind === "redeeming") return "Redeeming";
  return "Not listed";
}

/** Table / gallery chip: "PSA Vault" → "PSA". */
export function shortVaultChipLabel(raw: string | null | undefined): string {
  const s = (raw ?? "").trim() || "PSA Vault";
  return s.replace(/\s+vault$/i, "").trim() || s;
}

export function vaultChipTone(shortLabel: string): "psa" | "partner" {
  return shortLabel.toUpperCase() === "PSA" ? "psa" : "partner";
}
