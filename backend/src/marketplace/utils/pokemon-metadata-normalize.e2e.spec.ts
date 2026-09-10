/**
 * V1.1 end-to-end validation: PSA-shaped input → normalize → graded/IPFS →
 * marketplace collection components. Does not touch Cardhedger matching.
 */

import { buildBulkMintMetadataFromPsaCert } from '../../rwa/bulk-mint/bulk-mint-prepare.util';
import type { PsaCertRecord } from '../../psa/psa-public-api.service';
import { CollectionService } from '../collections/collection.service';
import { marketParallelKeyFromPsaVariety } from './market-parallel-key.util';
import {
  applyPokemonNormalizedToComponents,
  attachPokemonNormalizedToGraded,
  extractPokemonNormalizedFromMeta,
  normalizePokemonMetadata,
  type PokemonNormalizedMetadata,
} from './pokemon-metadata-normalize.util';

const CASE_A_EXPECTED: PokemonNormalizedMetadata = {
  game: 'pokemon',
  language: 'JP',
  series: 'Scarlet & Violet',
  setName: 'Pokémon Card 151',
  setCode: 'SV2a',
  cardName: 'Gengar',
  cardNumber: '094',
  variant: 'Reverse Holo',
  setKind: 'expansion',
};

const CASE_A_BRAND = 'POKEMON JAPANESE SV2a-POKEMON CARD 151';

function snapshotLegacy(graded: Record<string, unknown>) {
  const card = (graded.card ?? {}) as Record<string, unknown>;
  const psa = (graded.psa ?? {}) as Record<string, unknown>;
  return {
    cardSet: card.set,
    cardName: card.name,
    cardNumber: card.number,
    setHint: psa.setHint,
    variety: psa.variety ?? psa.Variety,
    cardNameHint: psa.cardNameHint,
    cardhedgerCardId: (graded.cardhedger as { cardId?: string } | undefined)
      ?.cardId,
  };
}

describe('Pokémon metadata normalization V1.1 E2E', () => {
  describe('Case A — JP 151 / SV2a full flow', () => {
    const analyzeInput = {
      brand: CASE_A_BRAND,
      subject: 'Gengar',
      cardNumber: '094',
      variety: 'REVERSE HOLO',
      category: 'Pokemon',
    };

    it('PSA analyze-shaped normalize matches expected', () => {
      const actual = normalizePokemonMetadata({
        brand: analyzeInput.brand,
        setHint: analyzeInput.brand,
        category: analyzeInput.category,
        subject: analyzeInput.subject,
        cardNumber: analyzeInput.cardNumber,
        variety: analyzeInput.variety,
      });
      expect(actual).toEqual(CASE_A_EXPECTED);
    });

    it('bulk mint → IPFS graded.normalized.pokemon + legacy fields intact', () => {
      const psaCert: PsaCertRecord = {
        CertNumber: '90000001',
        Subject: 'Gengar',
        Brand: CASE_A_BRAND,
        CardNumber: '094',
        Variety: 'REVERSE HOLO',
        CardGrade: '10',
        Category: 'Pokemon',
      };
      const { metadata } = buildBulkMintMetadataFromPsaCert({
        certNumber: '90000001',
        psaCert,
        imageUrl: 'https://example.com/slab.jpg',
      });

      const graded = metadata.properties!.graded as Record<string, unknown>;
      const before = {
        cardSet: (graded.card as { set: string }).set,
        cardNumber: (graded.card as { number: string }).number,
        setHint: (graded.psa as { setHint: string }).setHint,
        variety: (graded.psa as { Variety: string }).Variety,
      };

      expect(extractPokemonNormalizedFromMeta(metadata as unknown as Record<string, unknown>)).toEqual(
        CASE_A_EXPECTED,
      );
      expect(before.cardSet).toBe(CASE_A_BRAND);
      expect(before.setHint).toBe(CASE_A_BRAND);
      expect(before.variety).toBe('REVERSE HOLO');
      expect(before.cardNumber).toBe('094');
      // Re-attach must not mutate legacy identity fields.
      const legacy = snapshotLegacy(graded);
      attachPokemonNormalizedToGraded(graded);
      expect(snapshotLegacy(graded)).toEqual(legacy);
    });

    it('IPFS meta → collection components.normalizedPokemon mirror', () => {
      const psaCert: PsaCertRecord = {
        CertNumber: '90000001',
        Subject: 'Gengar',
        Brand: CASE_A_BRAND,
        CardNumber: '094',
        Variety: 'REVERSE HOLO',
        CardGrade: '10',
        Category: 'Pokemon',
      };
      const { metadata } = buildBulkMintMetadataFromPsaCert({
        certNumber: '90000001',
        psaCert,
        imageUrl: 'https://example.com/slab.jpg',
      });

      const components = CollectionService.searchComponentsFromGradedMeta(
        metadata as unknown as Record<string, unknown>,
      );

      expect(components.normalizedPokemon).toEqual(CASE_A_EXPECTED);
      expect(components.psaBrand).toBe(CASE_A_BRAND);
      expect(components.cardSet).toBe(CASE_A_BRAND);
      expect(components.psaVariety).toBe('REVERSE HOLO');
      expect(components.psaSubject).toBe('Gengar');
      expect(components.cardNumber).toBe('094');
      expect(components.language).toBe('JP');
      expect(components.cardhedgerCardId).toBeUndefined();

      const parallelKey = marketParallelKeyFromPsaVariety(
        String(components.psaVariety ?? ''),
        String(components.psaBrand ?? ''),
      );
      expect(parallelKey).toBeTruthy();
      // Variety still drives parallel key — not the normalized variant string.
      expect(parallelKey).not.toBe('base');
    });
  });

  describe('Cases B–D — set catalog via graded → components', () => {
    it('Case B — SV1S Scarlet ex', () => {
      const brand = 'POKEMON JAPANESE SV1S-SCARLET EX';
      const { metadata } = buildBulkMintMetadataFromPsaCert({
        certNumber: '90000002',
        psaCert: {
          CertNumber: '90000002',
          Subject: 'Pikachu',
          Brand: brand,
          CardNumber: '001',
          Category: 'Pokemon',
          CardGrade: '10',
        },
        imageUrl: 'https://example.com/a.jpg',
      });
      const graded = metadata.properties!.graded as Record<string, unknown>;
      expect((graded.card as { set: string }).set).toBe(brand);
      expect(
        extractPokemonNormalizedFromMeta(
          metadata as unknown as Record<string, unknown>,
        ),
      ).toMatchObject({
        game: 'pokemon',
        language: 'JP',
        series: 'Scarlet & Violet',
        setCode: 'SV1S',
        setName: 'Scarlet ex',
        setKind: 'expansion',
      });
      const comp = CollectionService.searchComponentsFromGradedMeta(
        metadata as unknown as Record<string, unknown>,
      );
      expect(comp.psaBrand).toBe(brand);
      expect(comp.normalizedPokemon).toMatchObject({ setCode: 'SV1S' });
    });

    it('Case C — SV1V Violet ex', () => {
      const brand = 'POKEMON JAPANESE SV1V-VIOLET EX';
      const { metadata } = buildBulkMintMetadataFromPsaCert({
        certNumber: '90000003',
        psaCert: {
          CertNumber: '90000003',
          Subject: 'Charmander',
          Brand: brand,
          CardNumber: '010',
          Category: 'Pokemon',
          CardGrade: '10',
        },
        imageUrl: 'https://example.com/b.jpg',
      });
      expect(
        extractPokemonNormalizedFromMeta(
          metadata as unknown as Record<string, unknown>,
        ),
      ).toMatchObject({
        game: 'pokemon',
        language: 'JP',
        series: 'Scarlet & Violet',
        setCode: 'SV1V',
        setName: 'Violet ex',
        setKind: 'expansion',
      });
      expect(
        CollectionService.searchComponentsFromGradedMeta(
          metadata as unknown as Record<string, unknown>,
        ).psaBrand,
      ).toBe(brand);
    });

    it('Case D — SV-P promo without invented series/setName', () => {
      const brand = 'POKEMON JAPANESE SV-P';
      const { metadata } = buildBulkMintMetadataFromPsaCert({
        certNumber: '90000004',
        psaCert: {
          CertNumber: '90000004',
          Subject: 'Pikachu',
          Brand: brand,
          CardNumber: '001',
          Category: 'Pokemon',
          CardGrade: '10',
        },
        imageUrl: 'https://example.com/c.jpg',
      });
      const pokemon = extractPokemonNormalizedFromMeta(
        metadata as unknown as Record<string, unknown>,
      );
      expect(pokemon).toMatchObject({
        game: 'pokemon',
        language: 'JP',
        setCode: 'SV-P',
        setKind: 'promo',
        cardName: 'Pikachu',
        cardNumber: '001',
      });
      expect(pokemon?.series).toBeUndefined();
      expect(pokemon?.setName).toBeUndefined();
    });
  });

  describe('Case E — insufficient metadata', () => {
    it('Brand Pokemon only — no invented fields through IPFS + components', () => {
      const { metadata } = buildBulkMintMetadataFromPsaCert({
        certNumber: '90000005',
        psaCert: {
          CertNumber: '90000005',
          Subject: 'Pikachu',
          Brand: 'Pokemon',
          CardNumber: '001',
          CardGrade: '10',
        },
        imageUrl: 'https://example.com/d.jpg',
      });
      const pokemon = extractPokemonNormalizedFromMeta(
        metadata as unknown as Record<string, unknown>,
      );
      expect(pokemon).toEqual({
        game: 'pokemon',
        cardName: 'Pikachu',
        cardNumber: '001',
      });
      const comp = CollectionService.searchComponentsFromGradedMeta(
        metadata as unknown as Record<string, unknown>,
      );
      expect(comp.normalizedPokemon).toEqual(pokemon);
      expect(comp.language).toBeUndefined();
      expect(comp.psaBrand).toBe('Pokemon');
    });
  });

  describe('Case F — variants', () => {
    it('REVERSE HOLO → variant; psaVariety unchanged', () => {
      const { metadata } = buildBulkMintMetadataFromPsaCert({
        certNumber: '90000006',
        psaCert: {
          CertNumber: '90000006',
          Subject: 'Gengar',
          Brand: CASE_A_BRAND,
          CardNumber: '094',
          Variety: 'REVERSE HOLO',
          Category: 'Pokemon',
          CardGrade: '10',
        },
        imageUrl: 'https://example.com/e.jpg',
      });
      const graded = metadata.properties!.graded as Record<string, unknown>;
      expect((graded.psa as { Variety: string }).Variety).toBe('REVERSE HOLO');
      const pokemon = extractPokemonNormalizedFromMeta(
        metadata as unknown as Record<string, unknown>,
      );
      expect(pokemon?.variant).toBe('Reverse Holo');
      expect(pokemon?.rarity).toBeUndefined();
    });

    it('MASTER BALL REVERSE HOLO → variant; not rarity', () => {
      const out = normalizePokemonMetadata({
        brand: CASE_A_BRAND,
        subject: 'Gengar',
        cardNumber: '094',
        variety: 'MASTER BALL REVERSE HOLO',
      });
      expect(out?.variant).toBe('Master Ball Reverse Holo');
      expect(out?.rarity).toBeUndefined();
    });
  });

  describe('Case G — rarity', () => {
    it('Illustration Rare → rarity only', () => {
      const out = normalizePokemonMetadata({
        brand: CASE_A_BRAND,
        subject: 'Mew',
        cardNumber: '151',
        variety: 'Illustration Rare',
      });
      expect(out?.rarity).toMatch(/Illustration Rare/i);
      expect(out?.variant).toBeUndefined();
    });
  });

  describe('non-Pokémon + fill-if-empty', () => {
    it('One Piece / sports → no normalized block on IPFS', () => {
      const { metadata } = buildBulkMintMetadataFromPsaCert({
        certNumber: '90000007',
        psaCert: {
          CertNumber: '90000007',
          Subject: 'Luffy',
          Brand: 'ONE PIECE JAPANESE OP13',
          CardNumber: '118',
          CardGrade: '10',
        },
        imageUrl: 'https://example.com/f.jpg',
      });
      expect(
        extractPokemonNormalizedFromMeta(
          metadata as unknown as Record<string, unknown>,
        ),
      ).toBeNull();
      expect(
        (metadata.properties!.graded as Record<string, unknown>).normalized,
      ).toBeUndefined();
    });

    it('does not overwrite existing components.language / rarity', () => {
      const components: Record<string, unknown> = {
        language: 'Japanese',
        rarity: 'Secret Rare',
        psaBrand: CASE_A_BRAND,
        cardSet: CASE_A_BRAND,
        cardhedgerCardId: 'ch-keep-me',
      };
      applyPokemonNormalizedToComponents(components, {
        ...CASE_A_EXPECTED,
        rarity: 'Illustration Rare',
      });
      expect(components.language).toBe('Japanese');
      expect(components.rarity).toBe('Secret Rare');
      expect(components.cardhedgerCardId).toBe('ch-keep-me');
      expect(components.psaBrand).toBe(CASE_A_BRAND);
      expect(components.normalizedPokemon).toMatchObject({
        setCode: 'SV2a',
        language: 'JP',
      });
    });
  });
});
