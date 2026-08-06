import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { PsaAnalyzeResult } from '../../psa/psa.service';
import type { UploadRwaDto } from '../dto/upload-rwa.dto';

/** Bundled via nest-cli `src/assets/**` → `dist/assets/`. */
export const VAULT_ADMIN_MINT_PLACEHOLDER_FILENAME = 'tokenable_logo.png';

/**
 * Resolve Tokenable placeholder PNG for admin mint when PSA/Cardhedger/item
 * image is missing. Prefer built `dist/assets` (Docker), then `src/assets` (dev).
 */
export function resolveVaultAdminMintPlaceholderPngPath(): string {
  const candidates = [
    join(__dirname, '..', '..', 'assets', VAULT_ADMIN_MINT_PLACEHOLDER_FILENAME),
    join(
      process.cwd(),
      'dist',
      'assets',
      VAULT_ADMIN_MINT_PLACEHOLDER_FILENAME,
    ),
    join(
      process.cwd(),
      'src',
      'assets',
      VAULT_ADMIN_MINT_PLACEHOLDER_FILENAME,
    ),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  throw new Error(
    `Tokenable mint placeholder missing (${VAULT_ADMIN_MINT_PLACEHOLDER_FILENAME}). Expected under dist/assets or src/assets.`,
  );
}

export function readVaultAdminMintPlaceholderPng(): {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
} {
  const path = resolveVaultAdminMintPlaceholderPngPath();
  return {
    buffer: readFileSync(path),
    originalname: VAULT_ADMIN_MINT_PLACEHOLDER_FILENAME,
    mimetype: 'image/png',
  };
}

/**
 * Build IPFS upload DTO for admin PSA-vault mint from a cert analyze result.
 * Mirrors the self-vault frontend path (`mintSellFlowCardByCert`) enough for
 * `RwaService.uploadToIpfs` grade policy + cert extraction.
 *
 * When no remote image exists, `usePlaceholderImage` is true — caller must
 * upload the bundled Tokenable logo via `uploadToIpfs(..., file)`.
 */
export function buildVaultAdminMintUploadFromAnalyze(params: {
  certNumber: string;
  analyze: PsaAnalyzeResult;
  fallbackName?: string | null;
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

  const imageUrl =
    params.analyze.psaCertImages?.front?.trim() ||
    params.analyze.cardhedgerMint?.imageUrl?.trim() ||
    params.fallbackImageUrl?.trim() ||
    '';
  const usePlaceholderImage = !imageUrl;

  const gradeScore = psa.gradeScore ?? null;
  const gradeLabel = psa.gradeLabel?.trim() || null;
  const gradeDescription = psa.gradeDescription?.trim() || null;

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
      ...(params.analyze.cardhedgerMint
        ? { cardhedger: params.analyze.cardhedgerMint }
        : {}),
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
    ...(imageUrl ? { imageUrl } : {}),
    gradedMetadata,
  };

  return {
    dto,
    imageUrl: imageUrl || null,
    usePlaceholderImage,
  };
}
