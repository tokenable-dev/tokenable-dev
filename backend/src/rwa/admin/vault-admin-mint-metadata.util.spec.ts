import {
  buildVaultAdminMintUploadFromAnalyze,
  resolveVaultAdminMintPlaceholderPngPath,
  readVaultAdminMintPlaceholderPng,
} from './vault-admin-mint-metadata.util';
import type { PsaAnalyzeResult } from '../../psa/psa.service';

describe('buildVaultAdminMintUploadFromAnalyze', () => {
  const analyze = {
    psa: {
      certNumber: '83179580',
      cardNameHint: 'Charizard',
      gradeScore: 10,
      gradeLabel: 'GEM MT 10',
      year: '1999',
      setHint: 'Base',
      certVerifyUrl: 'https://www.psacard.com/cert/83179580',
    },
    psaCertImages: { front: 'https://example.com/slab.jpg' },
    psaApi: { lookup: { status: 'skipped' } },
    ocr: {
      cardhedger: {
        front: {
          raw_text: '',
          parsed_entities: {
            card_name: '',
            set: '',
            year: '',
            card_number: '',
            cert_number: '',
            grade: '',
            autograph_detected: false,
            signer_guess: null,
          },
          confidence: 0,
        },
        combined: {
          raw_text: '',
          parsed_entities: {
            card_name: '',
            set: '',
            year: '',
            card_number: '',
            cert_number: '',
            grade: '',
            autograph_detected: false,
            signer_guess: null,
          },
          confidence: 0,
        },
      },
      combinedText: '',
    },
  } as unknown as PsaAnalyzeResult;

  it('builds upload dto with gradedMetadata and image', () => {
    const { dto, imageUrl, usePlaceholderImage } =
      buildVaultAdminMintUploadFromAnalyze({
        certNumber: '83179580',
        analyze,
      });
    expect(imageUrl).toBe('https://example.com/slab.jpg');
    expect(usePlaceholderImage).toBe(false);
    expect(dto.name).toContain('Charizard');
    expect(dto.imageUrl).toBe(imageUrl);
    const graded = JSON.parse(dto.gradedMetadata!).graded;
    expect(graded.gradingCompany).toBe('PSA');
    expect(graded.psa.certNumber).toBe('83179580');
  });

  it('flags placeholder when no remote image is available', () => {
    const { dto, imageUrl, usePlaceholderImage } =
      buildVaultAdminMintUploadFromAnalyze({
        certNumber: '83179580',
        analyze: {
          ...analyze,
          psaCertImages: undefined,
          cardhedgerMint: undefined,
        },
        fallbackImageUrl: null,
      });
    expect(usePlaceholderImage).toBe(true);
    expect(imageUrl).toBeNull();
    expect(dto.imageUrl).toBeUndefined();
    expect(dto.gradedMetadata).toBeTruthy();
  });
});

describe('vault admin mint placeholder PNG', () => {
  it('resolves and reads bundled Tokenable logo', () => {
    const path = resolveVaultAdminMintPlaceholderPngPath();
    expect(path).toMatch(/tokenable_logo\.png$/);
    const { buffer, mimetype, originalname } =
      readVaultAdminMintPlaceholderPng();
    expect(originalname).toBe('tokenable_logo.png');
    expect(mimetype).toBe('image/png');
    expect(buffer.length).toBeGreaterThan(100);
    expect(buffer[0]).toBe(0x89);
    expect(buffer[1]).toBe(0x50); // PNG magic
  });
});
