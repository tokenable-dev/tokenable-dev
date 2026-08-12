import type { PsaCertRecord } from '../../psa/psa-public-api.service';
import { parseGradeFromPsaCertRecord } from '../../psa/psa-public-api.service';
import type { RwaMetadata } from '../interfaces/rwa-metadata.interface';

/**
 * Build OpenSea-style graded metadata + display name from a PSA GetByCertNumber body.
 */
export function buildBulkMintMetadataFromPsaCert(params: {
  certNumber: string;
  psaCert: PsaCertRecord;
  imageUrl: string;
  /** PSA slab photo URL stored for UI fallback (not pinned on-chain). */
  certImageSourceUrl?: string | null;
}): { name: string; description: string; metadata: RwaMetadata } {
  const { certNumber, psaCert, imageUrl, certImageSourceUrl } = params;
  const { label, score } = parseGradeFromPsaCertRecord(psaCert);
  const subject = String(psaCert.Subject ?? '').trim();
  const year = String(psaCert.Year ?? psaCert.YearIssued ?? '').trim();
  const brand = String(psaCert.Brand ?? '').trim();
  const variety = String(psaCert.Variety ?? '').trim();
  const cardNumber = String(psaCert.CardNumber ?? '').trim();
  const gradeDesc =
    typeof psaCert.GradeDescription === 'string'
      ? psaCert.GradeDescription.trim()
      : '';

  const titleParts = [year, brand, subject, variety, cardNumber && `#${cardNumber}`]
    .filter(Boolean)
    .join(' ');
  const name =
    titleParts ||
    `PSA ${label ?? score ?? ''} Cert ${certNumber}`.replace(/\s+/g, ' ').trim();

  const description = [
    `PSA-graded collectible (cert ${certNumber}).`,
    gradeDesc && `Grade: ${gradeDesc}.`,
    'Minted via Tokenable enterprise bulk mint.',
  ]
    .filter(Boolean)
    .join(' ');

  const graded = {
    gradingCompany: 'PSA',
    gradeScore: score ?? null,
    gradeLabel: label ?? (score != null ? String(score) : null),
    gradeDescription: gradeDesc || null,
    psa: {
      certNumber,
      cardNameHint: subject || null,
      year: year || null,
      setHint: brand || null,
      cardNumberHint: cardNumber || null,
      variety: variety || null,
      category: String(psaCert.Category ?? '').trim() || null,
      labelType: String(psaCert.LabelType ?? '').trim() || null,
      totalPopulation:
        typeof psaCert.TotalPopulation === 'number'
          ? psaCert.TotalPopulation
          : null,
      populationHigher:
        typeof psaCert.PopulationHigher === 'number'
          ? psaCert.PopulationHigher
          : null,
      autographGrade: String(psaCert.AutographGrade ?? '').trim() || null,
      certVerifyUrl: `https://www.psacard.com/cert/${certNumber}`,
      ...(certImageSourceUrl?.trim()
        ? { certImageSourceUrl: certImageSourceUrl.trim() }
        : {}),
      specId:
        typeof psaCert.SpecID === 'number' && Number.isFinite(psaCert.SpecID)
          ? psaCert.SpecID
          : null,
    },
    card: {
      name: subject || name,
      year: year || null,
      set: brand || null,
      number: cardNumber || null,
    },
  };

  const metadata: RwaMetadata = {
    name,
    description,
    image: imageUrl,
    external_url: `https://www.psacard.com/cert/${certNumber}`,
    attributes: [
      { trait_type: 'Grading Company', value: 'PSA' },
      ...(score != null
        ? [{ trait_type: 'Grade', value: String(score) }]
        : label
          ? [{ trait_type: 'Grade', value: label }]
          : []),
      { trait_type: 'Cert Number', value: certNumber },
      ...(year ? [{ trait_type: 'Year', value: year }] : []),
      ...(brand ? [{ trait_type: 'Brand', value: brand }] : []),
    ],
    properties: { graded },
  };

  return { name, description, metadata };
}
