import type { PsaAnalyzeResult } from "@/lib/core";
import { psaCertImageMatchesFormCert } from "@/lib/vault/mintFormPsa";
import {
  isUsableCardhedgerMintImageUrl,
  resolveSelfVaultMintImageSelection,
} from "@/lib/vault/mintImageSource";
import type { PsaInputMode } from "@/lib/vault/mintFormConstants";
import type { GradedCardFormState } from "@/types/gradedCard";

export function validateMintForm(
  form: GradedCardFormState,
  lastAnalyze: PsaAnalyzeResult | null,
  psaInputMode: PsaInputMode,
): Record<string, string> {
  const next: Record<string, string> = {};
  if (!form.name.trim()) next.name = "Asset name is required";
  if (!form.grade.certNumber.trim() && !lastAnalyze?.psa.certNumber?.trim()) {
    next.certNumber =
      "PSA cert number is required — run a cert lookup or PSA photo analysis first.";
  }
  let hasImage = false;
  if (psaCertImageMatchesFormCert(lastAnalyze, form.grade.certNumber)) {
    hasImage = true;
  } else if (
    form.image instanceof File ||
    (typeof form.image === "string" && !!form.image.trim())
  ) {
    hasImage = true;
  } else if (
    psaInputMode === "cert" &&
    lastAnalyze?.psa?.enrichedFromOfficialApi &&
    (isUsableCardhedgerMintImageUrl(lastAnalyze.cardhedgerMint?.imageUrl) ||
      resolveSelfVaultMintImageSelection({
        analyze: lastAnalyze,
        certNumber: form.grade.certNumber,
        userImage: form.image,
      }).source === "tokenable_placeholder")
  ) {
    // PSA cert valid — Cardhedger catalog, user upload, or Tokenable default on backend.
    hasImage = true;
  }
  if (!hasImage) {
    next.image =
      psaInputMode === "cert"
        ? "Run cert lookup first. When PSA has no slab photo, we use your upload, catalog art, or the Tokenable default image."
        : "Upload a photo and wait for analysis, or use Cert # mode. If PSA does not supply a slab URL, your uploaded photo is used.";
  }
  return next;
}
