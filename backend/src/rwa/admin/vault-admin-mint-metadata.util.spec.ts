import { buildVaultAdminMintUploadFromAnalyze } from './vault-admin-mint-metadata.util';
import {
  readRwaMintPlaceholderPng,
  resolveRwaMintPlaceholderPngPath,
} from '../rwa-mint-placeholder.util';
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
    psaCertImages: { front: 'https://example.com/slab.jpg', back: 'https://example.com/back.jpg' },
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
    expect(graded.psa.certImageSourceUrl).toBe('https://example.com/slab.jpg');
    expect(graded.psa.certImageBackUrl).toBe('https://example.com/back.jpg');
  });

  it('copies analyze varietyHint onto graded.psa.Variety', () => {
    const { dto } = buildVaultAdminMintUploadFromAnalyze({
      certNumber: '83179580',
      analyze: {
        ...analyze,
        psa: { ...analyze.psa, varietyHint: 'VSTAR UNIVERSE' },
      },
    });
    const graded = JSON.parse(dto.gradedMetadata!).graded;
    expect(graded.psa.Variety).toBe('VSTAR UNIVERSE');
  });

  it('flags placeholder when no PSA, upload, or usable Cardhedger image', () => {
    const { dto, imageUrl, usePlaceholderImage } =
      buildVaultAdminMintUploadFromAnalyze({
        certNumber: '83179580',
        analyze: {
          ...analyze,
          psaCertImages: undefined,
          cardhedgerMint: {
            cardId: '12345',
            imageUrl: 'https://cardhedger.example/cardhedger-default/crop_image',
            matchConfidence: 'verified',
          },
        },
      });
    expect(usePlaceholderImage).toBe(true);
    expect(imageUrl).toBeNull();
    expect(dto.imageUrl).toBeUndefined();
    const graded = JSON.parse(dto.gradedMetadata!).graded;
    expect(graded.cardhedger?.imageUrl).toBeUndefined();
    expect(graded.cardhedger?.cardId).toBe('12345');
  });

  it('uses Cardhedger catalog when PSA slab is missing', () => {
    const catalog = 'https://942284f33c575895b4be9de571ca6e40.cdn.bubble.io/foo/crop_image';
    const { dto, imageUrl, usePlaceholderImage } =
      buildVaultAdminMintUploadFromAnalyze({
        certNumber: '83179580',
        analyze: {
          ...analyze,
          psaCertImages: undefined,
          cardhedgerMint: {
            cardId: '12345',
            imageUrl: catalog,
            matchConfidence: 'verified',
          },
        },
      });
    expect(usePlaceholderImage).toBe(false);
    expect(imageUrl).toBe(catalog);
    expect(dto.imageUrl).toBe(catalog);
  });
});

describe('vault admin mint placeholder PNG', () => {
  it('resolves and reads bundled Tokenable logo', () => {
    const path = resolveRwaMintPlaceholderPngPath();
    expect(path).toMatch(/tokenable_mint_placeholder\.png$/);
    const { buffer, mimetype, originalname } =
      readRwaMintPlaceholderPng();
    expect(originalname).toBe('tokenable_mint_placeholder.png');
    expect(mimetype).toBe('image/png');
    expect(buffer.length).toBeGreaterThan(100);
    expect(buffer[0]).toBe(0x89);
    expect(buffer[1]).toBe(0x50); // PNG magic
  });
});
