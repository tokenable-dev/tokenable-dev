import {
  attachPokemonNormalizedToGraded,
  extractPokemonSetCodeFromBrand,
  inferPrintLanguageFromHints,
  normalizePokemonMetadata,
} from './pokemon-metadata-normalize.util';
import { lookupPokemonSetCodeCatalog } from './pokemon-set-code.catalog';

describe('pokemon-set-code.catalog', () => {
  it('maps SV2a → Scarlet & Violet / Pokémon Card 151', () => {
    const e = lookupPokemonSetCodeCatalog('SV2a');
    expect(e).toMatchObject({
      setCode: 'SV2a',
      series: 'Scarlet & Violet',
      setName: 'Pokémon Card 151',
      setKind: 'expansion',
    });
  });

  it('maps SV1S and SV1V', () => {
    expect(lookupPokemonSetCodeCatalog('SV1S')?.setName).toBe('Scarlet ex');
    expect(lookupPokemonSetCodeCatalog('SV1V')?.setName).toBe('Violet ex');
  });

  it('maps SVP canonical Black Star Promos (not Cardhedger phrase)', () => {
    expect(lookupPokemonSetCodeCatalog('SVP')).toMatchObject({
      setCode: 'SVP',
      series: 'Scarlet & Violet',
      setName: 'Scarlet & Violet Black Star Promos',
      setKind: 'promo',
      market: 'EN',
    });
    expect(lookupPokemonSetCodeCatalog('SVP')?.setName).not.toBe(
      'Pokemon Scarlet Violet Black Star Promos',
    );
  });

  it('maps SV-P as promo without inventing series', () => {
    const e = lookupPokemonSetCodeCatalog('SV-P');
    expect(e?.setKind).toBe('promo');
    expect(e?.series).toBeUndefined();
    expect(e?.setName).toBeUndefined();
  });

  it('maps M2 / M2a canonical display names (not Cardhedger phrases)', () => {
    expect(lookupPokemonSetCodeCatalog('M2')).toMatchObject({
      setCode: 'M2',
      setName: 'Inferno X',
      setKind: 'expansion',
      market: 'JP',
    });
    expect(lookupPokemonSetCodeCatalog('M2a')).toMatchObject({
      setCode: 'M2a',
      setName: 'Mega Dream EX',
    });
    expect(lookupPokemonSetCodeCatalog('M2')?.setName).not.toBe(
      'Pokemon Japanese Inferno X',
    );
  });
});

describe('normalizePokemonMetadata', () => {
  it('JP 151 / SV2a — Reverse Holo Gengar', () => {
    const out = normalizePokemonMetadata({
      brand: 'POKEMON JAPANESE SV2a-POKEMON CARD 151',
      subject: 'Gengar',
      cardNumber: '094',
      variety: 'REVERSE HOLO',
      cardhedgerSet: 'Pokemon Japanese 151',
    });
    expect(out).toEqual({
      game: 'pokemon',
      language: 'JP',
      series: 'Scarlet & Violet',
      setName: 'Pokémon Card 151',
      setCode: 'SV2a',
      cardName: 'Gengar',
      cardNumber: '094',
      variant: 'Reverse Holo',
      setKind: 'expansion',
    });
  });

  it('SV2a without Brand "Japanese" still gets JP from catalog.market', () => {
    const out = normalizePokemonMetadata({
      brand: 'POKEMON SV2a-POKEMON CARD 151',
      subject: 'Gengar',
      cardNumber: '094',
    });
    expect(out).toMatchObject({
      game: 'pokemon',
      language: 'JP',
      setCode: 'SV2a',
      setName: 'Pokémon Card 151',
    });
  });

  it('reads language from Variety / Cardhedger set phrase', () => {
    expect(
      normalizePokemonMetadata({
        brand: 'POKEMON SWORD & SHIELD',
        variety: 'JAPANESE',
        subject: 'Pikachu',
        cardNumber: '001',
      })?.language,
    ).toBe('JP');
    expect(
      normalizePokemonMetadata({
        brand: 'POKEMON 151',
        cardhedgerSet: 'Pokemon Japanese 151',
        subject: 'Mew',
        cardNumber: '151',
      })?.language,
    ).toBe('JP');
  });

  it('SV1S Scarlet ex', () => {
    const out = normalizePokemonMetadata({
      brand: 'POKEMON JAPANESE SV1S-SCARLET EX',
      subject: 'Pikachu',
      cardNumber: '001',
    });
    expect(out).toMatchObject({
      game: 'pokemon',
      language: 'JP',
      setCode: 'SV1S',
      series: 'Scarlet & Violet',
      setName: 'Scarlet ex',
      setKind: 'expansion',
      cardName: 'Pikachu',
      cardNumber: '001',
    });
  });

  it('SV1V Violet ex', () => {
    const out = normalizePokemonMetadata({
      brand: 'POKEMON JAPANESE SV1V-VIOLET EX',
      subject: 'Charmander',
      cardNumber: '010',
    });
    expect(out).toMatchObject({
      setCode: 'SV1V',
      setName: 'Violet ex',
      series: 'Scarlet & Violet',
      setKind: 'expansion',
    });
  });

  it('SVP EN Black Star Promos — setKind promo with canonical setName', () => {
    const cases = [
      { subject: 'Pikachu', cardNumber: '190' },
      { subject: 'Snorlax', cardNumber: '51' },
      { subject: 'Charmander', cardNumber: '44' },
      { subject: 'Eevee', cardNumber: '173' },
      { subject: 'Mewtwo', cardNumber: '52' },
    ];
    for (const c of cases) {
      const out = normalizePokemonMetadata({
        brand: 'POKEMON SVP BLACK STAR PROMOS',
        subject: c.subject,
        cardNumber: c.cardNumber,
      });
      expect(out).toMatchObject({
        game: 'pokemon',
        language: 'EN',
        setCode: 'SVP',
        series: 'Scarlet & Violet',
        setName: 'Scarlet & Violet Black Star Promos',
        setKind: 'promo',
        cardName: c.subject,
        cardNumber: c.cardNumber,
      });
    }
  });

  it('SV1V Miraidon ex fixtures normalize without requiring Cardhedger phrase', () => {
    for (const cardNumber of ['94', '102', '106', '37']) {
      const out = normalizePokemonMetadata({
        brand: 'POKEMON JAPANESE SV1V-VIOLET EX',
        subject: 'Miraidon ex',
        cardNumber,
      });
      expect(out).toMatchObject({
        game: 'pokemon',
        language: 'JP',
        setCode: 'SV1V',
        setName: 'Violet ex',
        series: 'Scarlet & Violet',
        setKind: 'expansion',
        cardName: 'Miraidon ex',
        cardNumber,
      });
    }
  });

  it('SV-P promo — setKind promo, no invented series', () => {
    const out = normalizePokemonMetadata({
      brand: 'POKEMON JAPANESE SV-P',
      subject: 'Pikachu',
      cardNumber: '001',
    });
    expect(out).toMatchObject({
      game: 'pokemon',
      language: 'JP',
      setCode: 'SV-P',
      setKind: 'promo',
      cardName: 'Pikachu',
      cardNumber: '001',
    });
    expect(out?.series).toBeUndefined();
    expect(out?.setName).toBeUndefined();
  });

  it('insufficient Brand "Pokemon" — no guessing', () => {
    const out = normalizePokemonMetadata({
      brand: 'Pokemon',
      subject: 'Pikachu',
      cardNumber: '001',
    });
    expect(out).toEqual({
      game: 'pokemon',
      cardName: 'Pikachu',
      cardNumber: '001',
    });
  });

  it('non-Pokémon card → null (language is inferred separately)', () => {
    expect(
      normalizePokemonMetadata({
        brand: 'ONE PIECE JAPANESE OP13',
        subject: 'Luffy',
        cardNumber: '118',
      }),
    ).toBeNull();
    expect(
      normalizePokemonMetadata({
        brand: '2023 TOPPS CHROME',
        subject: 'Shohei Ohtani',
        cardNumber: '1',
        category: 'BASEBALL',
      }),
    ).toBeNull();
  });

  it('Master Ball Reverse Holo → variant', () => {
    const out = normalizePokemonMetadata({
      brand: 'POKEMON JAPANESE SV2a-POKEMON CARD 151',
      subject: 'Gengar',
      cardNumber: '094',
      variety: 'MASTER BALL REVERSE HOLO',
    });
    expect(out?.variant).toBe('Master Ball Reverse Holo');
    expect(out?.rarity).toBeUndefined();
  });

  it('rarity classification when variety is rarity label', () => {
    const out = normalizePokemonMetadata({
      brand: 'POKEMON JAPANESE SV2a-POKEMON CARD 151',
      subject: 'Mew',
      cardNumber: '151',
      variety: 'Illustration Rare',
    });
    expect(out?.rarity).toMatch(/Illustration Rare/i);
    expect(out?.variant).toBeUndefined();
  });

  it('does not use Cardhedger row.set as canonical setName', () => {
    const out = normalizePokemonMetadata({
      brand: 'POKEMON JAPANESE SV2a-POKEMON CARD 151',
      subject: 'Gengar',
      cardNumber: '094',
      cardhedgerSet: 'Pokemon Japanese 151',
    });
    expect(out?.setName).toBe('Pokémon Card 151');
    expect(out?.setName).not.toBe('Pokemon Japanese 151');
  });

  it('regression: attach does not mutate card.set / psa.brand', () => {
    const graded: Record<string, unknown> = {
      card: { name: 'Gengar', number: '094', set: 'POKEMON JAPANESE SV2a-POKEMON CARD 151' },
      psa: {
        brand: 'POKEMON JAPANESE SV2a-POKEMON CARD 151',
        subject: 'Gengar',
        setHint: 'POKEMON JAPANESE SV2a-POKEMON CARD 151',
        Variety: 'REVERSE HOLO',
      },
    };
    const brandBefore = (graded.psa as { brand: string }).brand;
    const setBefore = (graded.card as { set: string }).set;
    attachPokemonNormalizedToGraded(graded);
    expect((graded.psa as { brand: string }).brand).toBe(brandBefore);
    expect((graded.card as { set: string }).set).toBe(setBefore);
    expect(
      (graded.normalized as { pokemon: { setCode: string } }).pokemon.setCode,
    ).toBe('SV2a');
  });
});

describe('extractPokemonSetCodeFromBrand', () => {
  it('extracts SV2a from hyphenated Brand', () => {
    expect(
      extractPokemonSetCodeFromBrand('POKEMON JAPANESE SV2a-POKEMON CARD 151'),
    ).toBe('SV2a');
  });

  it('extracts M2 / M2a from hyphenated Brand', () => {
    expect(
      extractPokemonSetCodeFromBrand('POKEMON JAPANESE M2-INFERNO X'),
    ).toBe('M2');
    expect(
      extractPokemonSetCodeFromBrand('POKEMON JAPANESE M2a-MEGA DREAM EX'),
    ).toBe('M2a');
  });
});

describe('inferPrintLanguageFromHints', () => {
  it('maps One Piece Brand JAPANESE → JP', () => {
    expect(
      inferPrintLanguageFromHints({
        brand: 'ONE PIECE JAPANESE OP05-AWAKENING OF THE NEW ERA',
        category: 'ONE PIECE',
      }),
    ).toBe('JP');
  });

  it('does not invent English for sports Brand without a language word', () => {
    expect(
      inferPrintLanguageFromHints({
        brand: '2023 TOPPS CHROME',
        category: 'BASEBALL',
      }),
    ).toBeUndefined();
  });
});
