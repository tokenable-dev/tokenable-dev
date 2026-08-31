import type { PsaAnalyzeResult } from '../../psa/psa.service';
import type { UploadRwaDto } from '../dto/upload-rwa.dto';
import {
  resolveCardhedgerMintImageUrl,
  resolveRemoteMintImageUrl,
} from '../rwa-mint-image.util';

function cardhedgerMetaWithoutCatalogImage(
  mint: PsaAnalyzeResult['cardhedgerMint'],
): Record<string, unknown> | null {
  if (!mint) return null;
  const out: Record<string, unknown> = {};
  if (mint.cardId?.trim()) out.cardId = mint.cardId.trim();
  if (mint.searchQuery != null) out.searchQuery = mint.searchQuery;
  if (mint.matchConfidence) out.matchConfidence = mint.matchConfidence;
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Build IPFS upload DTO for admin PSA-vault mint from a cert analyze result.
 * Mint image priority: PSA slab → submission/item image → Cardhedger catalog
 * (never Cardhedger branded placeholder) → caller/`RwaService` Tokenable default.
 */
export function buildVaultAdminMintUploadFromAnalyze(params: {
  certNumber: string;
  analyze: PsaAnalyzeResult;
  fallbackName?: string | null;
  /** Submission/item photo when PSA has no slab URL. */
  fallbackImageUrl?: string | null;
}): {
  dto: UploadRwaDto;
  imageUrl: string | null;
  usePlaceholderImage: boolean;
} {
  const cert = params.certNumber.trim();
  const psa = params.analyze.psa;
  const name =
    psa.cardNameHint?.trim() ||
    params.fallbackName?.trim() ||
    `PSA CERT #${cert}`;

  const psaSlabUrl = params.analyze.psaCertImages?.front?.trim() || '';
  const remote = resolveRemoteMintImageUrl({
    psaCertSlabUrl: psaSlabUrl,
    userImageUrl: params.fallbackImageUrl,
    cardhedgerImageUrl: resolveCardhedgerMintImageUrl({
      imageUrl: params.analyze.cardhedgerMint?.imageUrl,
    }),
  });
  const remoteMintUrl = remote.url;
  const usePlaceholderImage = !remoteMintUrl;

  const gradeScore = psa.gradeScore ?? null;
  const gradeLabel = psa.gradeLabel?.trim() || null;
  const gradeDescription = psa.gradeDescription?.trim() || null;
  const cardhedger = cardhedgerMetaWithoutCatalogImage(
    params.analyze.cardhedgerMint,
  );

  const gradedMetadata = JSON.stringify({
    graded: {
      gradingCompany: 'PSA',
      gradeScore,
      gradeLabel,
      gradeDescription,
      psa: {
        certNumber: psa.certNumber?.trim() || cert,
        gradeScore,
        gradeLabel,
        gradeDescription,
        cardNameHint: psa.cardNameHint?.trim() || null,
        year: psa.year?.trim() || null,
        setHint: psa.setHint?.trim() || null,
        cardNumberHint: psa.cardNumberHint?.trim() || null,
        category: psa.category?.trim() || null,
        labelType: psa.labelType?.trim() || null,
        totalPopulation: psa.totalPopulation ?? null,
        populationHigher: psa.populationHigher ?? null,
        autographGrade: psa.autographGrade?.trim() || null,
        certVerifyUrl:
          psa.certVerifyUrl?.trim() ||
          `https://www.psacard.com/cert/${cert}`,
        ...(psaSlabUrl ? { certImageSourceUrl: psaSlabUrl } : {}),
        ...(params.analyze.psaCertImages?.back?.trim()
          ? { certImageBackUrl: params.analyze.psaCertImages.back.trim() }
          : {}),
        ...(psa.varietyHint?.trim()
          ? { Variety: psa.varietyHint.trim() }
          : {}),
      },
      card: {
        name: psa.cardNameHint?.trim() || name,
        year: psa.year?.trim() || null,
        set: psa.setHint?.trim() || null,
        number: psa.cardNumberHint?.trim() || null,
      },
      verification: {
        certUrl:
          psa.certVerifyUrl?.trim() ||
          `https://www.psacard.com/cert/${cert}`,
      },
      ...(cardhedger ? { cardhedger } : {}),
    },
    attributes: [
      { trait_type: 'Grading Company', value: 'PSA' },
      ...(gradeScore != null
        ? [{ trait_type: 'Grade', value: String(gradeScore) }]
        : gradeLabel
          ? [{ trait_type: 'Grade', value: gradeLabel }]
          : []),
      { trait_type: 'Cert Number', value: cert },
    ],
    external_url:
      psa.certVerifyUrl?.trim() || `https://www.psacard.com/cert/${cert}`,
  });

  const dto: UploadRwaDto = {
    name,
    description: `PSA-graded collectible (cert ${cert}). Minted via Tokenable PSA vault admin.`,
    ...(remoteMintUrl ? { imageUrl: remoteMintUrl } : {}),
    gradedMetadata,
  };

  return {
    dto,
    imageUrl: remoteMintUrl,
    usePlaceholderImage,
  };
}
