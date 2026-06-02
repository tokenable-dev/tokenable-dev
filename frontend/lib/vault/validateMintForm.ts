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
        ? "Run Cert lookup first so PSA can supply an image URL, or switch to slab photos and upload a front image."
        : "Upload a photo and wait for analysis, or use Cert # mode. If PSA does not supply an image URL, your uploaded photo is used.";
  }
  return next;
}
