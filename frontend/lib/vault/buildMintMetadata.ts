import type { PsaAnalyzeResult } from "@/lib/core";
import type { GradedCardFormState, GradedCardMetadata } from "@/types/gradedCard";

export function buildGradedCardMetadata(
  form: GradedCardFormState,
  lastAnalyze: PsaAnalyzeResult | null,
): GradedCardMetadata {
  const metadata: GradedCardMetadata = {
    name: form.name,
    image: "",
  };
  if (form.description.trim()) metadata.description = form.description;

  metadata.gradingCompany = "PSA";

  const hasCard =
    form.card.name ||
    form.card.player ||
    form.card.year ||
    form.card.set ||
    form.card.number;
  if (hasCard) {
    metadata.card = {};
    if (form.card.name) metadata.card.name = form.card.name;
    if (form.card.player) metadata.card.player = form.card.player;
    if (form.card.year) {
      const y = parseInt(form.card.year, 10);
      if (!Number.isNaN(y)) metadata.card.year = y;
    }
    if (form.card.set) metadata.card.set = form.card.set;
    if (form.card.number) metadata.card.number = form.card.number;
  }

  const hasGrade =
    form.grade.certNumber ||
    form.grade.score ||
    Object.keys(form.grade.subgrades).length > 0;
  if (hasGrade) {
    metadata.grade = {};
    if (form.grade.certNumber) metadata.grade.certNumber = form.grade.certNumber;
    if (form.grade.score) {
      const s = parseFloat(form.grade.score);
      if (!Number.isNaN(s)) metadata.grade.score = s;
    }
    if (Object.keys(form.grade.subgrades).length > 0) {
      metadata.grade.subgrades = { ...form.grade.subgrades };
    }
  }

  const hasVerification =
    form.verification.certUrl ||
    form.verification.slabFront ||
    form.verification.slabBack;
  if (hasVerification) {
    metadata.verification = {};
    if (form.verification.certUrl)
      metadata.verification.certUrl = form.verification.certUrl;
    if (form.verification.slabFront) metadata.verification.slabFront = "";
    if (form.verification.slabBack) metadata.verification.slabBack = "";
  }

  const scoreFromForm = parseFloat(form.grade.score);
  const slabSubject =
    form.card.name.trim() || lastAnalyze?.psa.cardNameHint?.trim() || "";
  const slabBrand = form.card.set.trim() || lastAnalyze?.psa.setHint?.trim() || "";
  const slabYear = form.card.year.trim() || lastAnalyze?.psa.year?.trim() || "";
  metadata.psa = {
    certNumber: form.grade.certNumber || lastAnalyze?.psa.certNumber,
    gradeLabel: lastAnalyze?.psa.gradeLabel,
    gradeScore: Number.isNaN(scoreFromForm)
      ? lastAnalyze?.psa.gradeScore
      : scoreFromForm,
    gradeDescription: lastAnalyze?.psa.gradeDescription,
    certVerifyUrl: form.verification.certUrl || lastAnalyze?.psa.certVerifyUrl,
    cardNameHint: lastAnalyze?.psa.cardNameHint,
    setHint: lastAnalyze?.psa.setHint,
    cardNumberHint: lastAnalyze?.psa.cardNumberHint,
    year: lastAnalyze?.psa.year,
    labelType: lastAnalyze?.psa.labelType,
    category: lastAnalyze?.psa.category,
    ...(slabSubject ? { subject: slabSubject } : {}),
    ...(slabBrand ? { brand: slabBrand } : {}),
    ...(slabYear ? { Year: slabYear } : {}),
    autographGrade:
      typeof form.grade.subgrades.autographGrade === "string"
        ? form.grade.subgrades.autographGrade
        : lastAnalyze?.psa.autographGrade,
    totalPopulation: lastAnalyze?.psa.totalPopulation,
    populationHigher: lastAnalyze?.psa.populationHigher,
    totalPopulationWithQualifier: lastAnalyze?.psa.totalPopulationWithQualifier,
    reverseBarcode: lastAnalyze?.psa.reverseBarcode,
    specId: lastAnalyze?.psa.specId,
    enrichedFromOfficialApi: lastAnalyze?.psa.enrichedFromOfficialApi,
    ...(lastAnalyze?.psaCertImages?.front
      ? { certImageSourceUrl: lastAnalyze.psaCertImages.front }
      : {}),
    ...(lastAnalyze?.psaCertImages?.back
      ? { certImageBackUrl: lastAnalyze.psaCertImages.back }
      : {}),
    ...(lastAnalyze?.psa.varietyHint?.trim()
      ? { Variety: lastAnalyze.psa.varietyHint.trim() }
      : {}),
  };
  if (lastAnalyze) {
    if (
      lastAnalyze.cardhedgerMint?.matchConfidence === "verified" &&
      lastAnalyze.cardhedgerMint?.cardId?.trim()
    ) {
      metadata.cardhedger = {
        cardId: lastAnalyze.cardhedgerMint.cardId.trim(),
        ...(lastAnalyze.cardhedgerMint.searchQuery != null
          ? { searchQuery: lastAnalyze.cardhedgerMint.searchQuery }
          : {}),
      };
    }
    const l = lastAnalyze.psaApi.lookup;
    metadata.psaApi = {
      status: l.status,
      ...(l.status === "success" && { certNumber: l.certNumber }),
      ...(l.status === "error" && { message: l.message }),
    };
  }

  return metadata;
}

export function buildMintOpenSeaAttributes(
  form: GradedCardFormState,
): { trait_type: string; value: string }[] {
  const attrs: { trait_type: string; value: string }[] = [];
  attrs.push({ trait_type: "Grading Company", value: "PSA" });
  if (form.grade.certNumber)
    attrs.push({ trait_type: "PSA Cert #", value: form.grade.certNumber });
  if (form.grade.score) attrs.push({ trait_type: "Grade", value: form.grade.score });
  if (form.card.name) attrs.push({ trait_type: "Card Name", value: form.card.name });
  if (form.card.set) attrs.push({ trait_type: "Set", value: form.card.set });
  if (form.card.number) attrs.push({ trait_type: "Card #", value: form.card.number });
  const sg = form.grade.subgrades;
  if (typeof sg.psaPopulation === "string" && sg.psaPopulation.trim())
    attrs.push({ trait_type: "PSA Population", value: sg.psaPopulation });
  if (typeof sg.psaPopHigher === "string" && sg.psaPopHigher.trim())
    attrs.push({ trait_type: "PSA Pop Higher", value: sg.psaPopHigher });
  if (typeof sg.labelType === "string" && sg.labelType.trim())
    attrs.push({ trait_type: "PSA Label Type", value: sg.labelType });
  if (typeof sg.psaCategory === "string" && sg.psaCategory.trim())
    attrs.push({ trait_type: "PSA Category", value: sg.psaCategory });
  return attrs;
}
