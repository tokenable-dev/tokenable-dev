import type { VaultSubmissionApiItem } from "@/lib/core/api/vault-submissions";
import {
  formatSellCardDisplay,
  normalizeSellCardDisplaySource,
  type SellCardDisplaySource,
} from "@/lib/sell/sellFlowDraft";

/** Vault detail list lines — cert is its own row (important on mobile). */
export function vaultDetailCardLines(
  card: SellCardDisplaySource & { cert: string },
): { line1: string; listLine2: string; certLine: string } {
  const { line1, line2 } = formatSellCardDisplay(card);
  const cert = card.cert.trim();
  return {
    line1,
    listLine2: line2 ?? "",
    certLine: cert ? `Cert #${cert}` : "",
  };
}

export function vaultSubmissionItemDisplaySource(
  item: VaultSubmissionApiItem,
  enrichment?: SellCardDisplaySource | null,
): SellCardDisplaySource {
  return {
    cert: item.cert,
    name: item.name?.trim() || null,
    grade: item.grade,
    cardNumber:
      item.cardNumber?.trim() || enrichment?.cardNumber?.trim() || null,
    year: item.year?.trim() || enrichment?.year?.trim() || null,
    setName: item.setName?.trim() || enrichment?.setName?.trim() || null,
    language: item.language?.trim() || enrichment?.language?.trim() || null,
    variant: item.variant?.trim() || enrichment?.variant?.trim() || null,
  };
}

/** True when stored name alone cannot produce full Line 1 + Line 2. */
export function needsPsaDisplayEnrichment(
  source: SellCardDisplaySource,
): boolean {
  const normalized = normalizeSellCardDisplaySource(source);
  const hasNumber = Boolean(normalized.cardNumber?.trim());
  const hasProvenance = Boolean(
    normalized.year?.trim() || normalized.setName?.trim(),
  );
  return !hasNumber || !hasProvenance;
}
