import type { PsaAnalyzeResult } from "@/lib/core";
import { psaCertImageMatchesFormCert } from "@/lib/vault/mintFormPsa";
import type { GradedCardFormState } from "@/types/gradedCard";
import type { PsaInputMode } from "@/lib/vault/mintFormConstants";

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
  if (
    psaCertImageMatchesFormCert(lastAnalyze, form.grade.certNumber) ||
    lastAnalyze?.cardhedgerMint?.imageUrl
  ) {
    hasImage = true;
  } else if (lastAnalyze?.psaCertImages?.front) {
    hasImage =
      form.image instanceof File || (typeof form.image === "string" && !!form.image.trim());
  } else {
    hasImage =
      form.image instanceof File || (typeof form.image === "string" && !!form.image.trim());
  }
  if (!hasImage) {
    next.image =
      psaInputMode === "cert"
        ? lastAnalyze?.psa?.enrichedFromOfficialApi
          ? "PSA cert data loaded but no slab image is available. We use a Cardhedger catalog image when found; otherwise upload a slab photo in Photo mode."
          : "Run cert lookup first. When PSA has no slab image, a Cardhedger catalog image or uploaded photo is used for minting."
        : "Upload a photo and wait for analysis, or use Cert # mode. If PSA does not supply an image URL, your uploaded photo is used.";
  }
  return next;
}
