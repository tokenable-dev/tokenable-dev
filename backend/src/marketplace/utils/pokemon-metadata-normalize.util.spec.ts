import {
  attachPokemonNormalizedToGraded,
  extractPokemonSetCodeFromBrand,
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

  it('non-Pokémon card → null', () => {
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
