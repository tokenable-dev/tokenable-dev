import type { PsaAnalyzeResult } from "@/lib/core";
import { isPsaRateLimitError } from "@/lib/psa/psaApiErrors";
import { sellDraftCardFieldsFromPsaAnalyze } from "@/lib/sell/sellFlowDraft";

/** Sell-flow partner list policy (CSV + slab + cert entry). */
export const PARTNER_PSA_GRADE_REJECT_MESSAGE =
  "Only PSA 9 and PSA 10 are accepted right now.";

export type PartnerCsvErrorKind =
  | "invalid_cert"
  | "duplicate"
  | "list_full"
  | "already_minted"
  | "psa_shipment"
  | "grade_not_accepted"
  | "not_found"
  | "rate_limit"
  | "lookup_failed"
  | "add_failed";

export const PARTNER_CSV_ERROR_BADGE: Record<PartnerCsvErrorKind, string> = {
  invalid_cert: "Invalid cert",
  duplicate: "Duplicate",
  list_full: "List full",
  already_minted: "Already minted",
  psa_shipment: "In PSA shipment",
  grade_not_accepted: "Grade not accepted",
  not_found: "Not found",
  rate_limit: "Rate limited",
  lookup_failed: "Lookup failed",
  add_failed: "Could not add",
};

export function cardDisplayNameFromPsaAnalyze(r: PsaAnalyzeResult): string {
  return sellDraftCardFieldsFromPsaAnalyze(r).name;
}

export function classifyPartnerCsvLookupError(message: string): PartnerCsvErrorKind {
  const m = message.toLowerCase();

  if (m.includes("only psa 9 and psa 10")) return "grade_not_accepted";
  if (
    m.includes("already minted") ||
    m.includes("redeem it before") ||
    m.includes("vaultrefalreadyactive")
  ) {
    return "already_minted";
  }
  if (
    m.includes("psa vault shipment") ||
    m.includes("in transit or at psa")
  ) {
    return "psa_shipment";
  }
  if (m.includes("already in your list")) return "duplicate";
  if (m.includes("99 cards per submission") || m.includes("up to 99")) {
    return "list_full";
  }
  if (
    m.includes("invalid cert") ||
    m.includes("7–10 digits") ||
    m.includes("7-10 digits") ||
    m.includes("valid psa cert")
  ) {
    return "invalid_cert";
  }
  if (
    m.includes("rate limit") ||
    m.includes("quota") ||
    m.includes("psa_rate_limit") ||
    /\b429\b/.test(m)
  ) {
    return "rate_limit";
  }
  if (
    m.includes("couldn't find") ||
    m.includes("could not find") ||
    m.includes("not find that cert")
  ) {
    return "not_found";
  }
  if (
    m.includes("공식 메타") ||
    m.includes("psa request failed") ||
    m.includes("psa lookup failed") ||
    m.includes("[http 5")
  ) {
    return "lookup_failed";
  }
  if (m.includes("could not add")) return "add_failed";

  return "lookup_failed";
}

/** English user-facing hint for assistive tech (badge is the short label). */
export function partnerCsvErrorHint(kind: PartnerCsvErrorKind): string {
  switch (kind) {
    case "invalid_cert":
      return "Enter a valid PSA cert number (7–10 digits).";
    case "duplicate":
      return "This cert is already on your list.";
    case "list_full":
      return "You can add up to 99 cards per submission.";
    case "already_minted":
      return "This cert is already minted on this network. Redeem it before minting again.";
    case "psa_shipment":
      return "This cert is on an active PSA vault shipment.";
    case "grade_not_accepted":
      return PARTNER_PSA_GRADE_REJECT_MESSAGE;
    case "not_found":
      return "We could not find that cert number. Check the number on the slab.";
    case "rate_limit":
      return "PSA rate limit reached. Please wait and try again later.";
    case "lookup_failed":
      return "PSA lookup failed. Try again later.";
    case "add_failed":
      return "The card could not be added to your list.";
    default:
      return "This row could not be completed.";
  }
}

export function partnerCsvLookupErrorFromUnknown(err: unknown): PartnerCsvErrorKind {
  if (isPsaRateLimitError(err)) return "rate_limit";
  const message =
    err instanceof Error ? err.message : "PSA lookup failed";
  return classifyPartnerCsvLookupError(message);
}
