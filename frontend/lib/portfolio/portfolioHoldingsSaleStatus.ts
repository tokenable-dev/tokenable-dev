import type { RedeemSurfaceBadge } from "@/lib/portfolio/redeemDraft";
export {
  shortVaultChipLabel,
  vaultChipTone,
} from "@/lib/marketplace/vaultCustodyLabel";
import {
  shortVaultChipLabel,
  vaultChipTone,
} from "@/lib/marketplace/vaultCustodyLabel";
import { formatUsdCompact } from "@/lib/market/collectionMarketPricing";

/** Sale-state only — every card is already in a vault. */
export type HoldingsSaleKind =
  | "not_listed"
  | "listed"
  | "redeeming"
  | "event_used";

export function holdingsSaleKind(
  isListed: boolean,
  redeemStatus: RedeemSurfaceBadge | null,
  kbwMysteryUsed = false,
): HoldingsSaleKind {
  if (kbwMysteryUsed) return "event_used";
  if (redeemStatus && redeemStatus.kind !== "possession") return "redeeming";
  if (isListed) return "listed";
  return "not_listed";
}

export function holdingsSaleStatusLabel(
  kind: HoldingsSaleKind,
  listPriceUsd?: number | null,
): string {
  if (kind === "event_used") return "Checked";
  if (kind === "listed") {
    if (listPriceUsd != null && Number.isFinite(listPriceUsd)) {
      return `Listed · ${formatUsdCompact(listPriceUsd)}`;
    }
    return "Listed";
  }
  if (kind === "redeeming") return "Redeeming";
  return "Not listed";
}

/** Portfolio.html `#pf-tableview` Vault chip — PSA (azure) or TKB (neutral). */
export function portfolioTableVaultChip(
  vaultLabel: string | null | undefined,
): { text: string; tone: "psa" | "partner" } | null {
  const short = shortVaultChipLabel(vaultLabel);
  if (!short) return null;
  const upper = short.toUpperCase();
  if (upper === "PSA") return { text: "PSA", tone: "psa" };
  // Portfolio.html uses TKB for Tokenable / TOKN partner vaults.
  if (upper === "TOKENABLE" || upper === "TOKN" || upper === "TKB") {
    return { text: "TKB", tone: "partner" };
  }
  return { text: short, tone: vaultChipTone(short) };
}
