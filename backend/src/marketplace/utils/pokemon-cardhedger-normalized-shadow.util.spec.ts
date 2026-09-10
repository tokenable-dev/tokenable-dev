import {
  buildPokemonCardhedgerShadowTelemetry,
  buildPokemonNormalizedCardhedgerQueries,
  cardhedgerPokemonFinishSearchHint,
  comparePokemonShadowOutcome,
  pickPokemonNormalizedShadowCandidate,
  productionCardhedgerIdFromShadowCompare,
  scorePokemonNormalizedShadowCandidate,
} from './pokemon-cardhedger-normalized-shadow.util';
import {
  lookupPokemonCardhedgerSetPhrase,
  pokemonCardhedgerPrimarySetPhrase,
} from './pokemon-cardhedger-set-phrase.util';
import { cardhedgerSetAliasTokens } from './cardhedger-search-alias.util';

const GENGAR_ROWS = [
  {
    card_id: 'gengar-base-id',
    description: 'Pokemon Japanese 151 Gengar 094',
    name: 'Gengar',
    set: 'Pokemon Japanese 151',
    number: '094',
    variant: 'Base',
  },
  {
    card_id: 'gengar-reverse-foil-id',
    description: 'Pokemon Japanese 151 Gengar Reverse Foil 094',
    name: 'Gengar',
    set: 'Pokemon Japanese 151',
    number: '094',
    variant: 'Reverse Foil',
  },
  {
    card_id: 'gengar-master-ball-id',
    description: 'Pokemon Japanese 151 Gengar Master Ball 094',
    name: 'Gengar',
    set: 'Pokemon Japanese 151',
    number: '094',
    variant: 'Master Ball',
  },
];

describe('pokemon-cardhedger-set-phrase', () => {
  it('maps SV2a → Pokemon Japanese 151 only (not V1 display name)', () => {
    const e = lookupPokemonCardhedgerSetPhrase('SV2a');
    expect(e?.primaryPhrase).toBe('Pokemon Japanese 151');
    expect(e?.primaryPhrase).not.toBe('Pokémon Card 151');
    expect(pokemonCardhedgerPrimarySetPhrase('sv2a')).toBe(
      'Pokemon Japanese 151',
    );
  });

  it('does not invent phrases for SV1S / SV1V / SV-P / SVP', () => {
    expect(pokemonCardhedgerPrimarySetPhrase('SV1S')).toBeNull();
    expect(pokemonCardhedgerPrimarySetPhrase('SV1V')).toBeNull();
    expect(pokemonCardhedgerPrimarySetPhrase('SV-P')).toBeNull();
    expect(pokemonCardhedgerPrimarySetPhrase('SVP')).toBeNull();
  });

  it('preserves existing SV2a alias tokens in cardhedger-search-alias', () => {
    const tokens = cardhedgerSetAliasTokens(
      'POKEMON JAPANESE SV2a-POKEMON CARD 151',
      'POKEMON JAPANESE SV2a-POKEMON CARD 151',
    );
    expect(tokens).toEqual(
      expect.arrayContaining([
        'pokemon japanese 151',
        'scarlet violet 151',
      ]),
    );
  });
});

describe('V2.1 shadow validation matrix', () => {
  it('Case A — JP 151 Reverse Foil query + same outcome telemetry', () => {
    const pokemon = {
      game: 'pokemon' as const,
      language: 'JP',
      series: 'Scarlet & Violet',
      setName: 'Pokémon Card 151',
      setCode: 'SV2a',
      cardName: 'Gengar',
      cardNumber: '094',
      variant: 'Reverse Holo',
      setKind: 'expansion' as const,
    };
    const plan = buildPokemonNormalizedCardhedgerQueries({
      pokemon,
      psaVariety: 'REVERSE HOLO',
    });
    expect(plan.queries[0]).toBe(
      'Gengar 094 Pokemon Japanese 151 Reverse Foil',
    );
    expect(plan.queries.some((q) => /\bSV2a\b/i.test(q))).toBe(false);

    const pick = pickPokemonNormalizedShadowCandidate(
      [{ query: plan.queries[0]!, cards: GENGAR_ROWS }],
      {
        cardName: 'Gengar',
        cardNumber: '094',
        setPhrase: plan.setPhrase!,
        psaVariety: 'REVERSE HOLO',
      },
    );
    expect(pick?.cardId).toBe('gengar-reverse-foil-id');
    expect(pick?.variant).toBe('Reverse Foil');

    const outcome = comparePokemonShadowOutcome({
      legacyId: 'gengar-reverse-foil-id',
      legacyVerified: true,
      shadowId: pick!.cardId,
      shadowVerified: true,
    });
    expect(outcome).toBe('same');

    const telemetry = buildPokemonCardhedgerShadowTelemetry({
      collectionKey: 'gengar-jp-151-094',
      pokemon,
      year: '2023',
      plan,
      legacy: {
        cardId: 'gengar-reverse-foil-id',
        query: 'legacy',
        verified: true,
        confidence: 'verified',
        row: GENGAR_ROWS[1],
      },
      shadow: {
        cardId: pick!.cardId,
        query: pick!.query,
        verified: true,
        confidence: 'verified',
        row: GENGAR_ROWS[1],
      },
      outcome,
    });
    expect(telemetry.type).toBe('cardhedger_pokemon_normalized_shadow');
    expect(telemetry.setCode).toBe('SV2a');
    expect(telemetry.setName).toBe('Pokémon Card 151');
    expect(telemetry.normalized.setPhrase).toBe('Pokemon Japanese 151');
    expect(telemetry.normalized.variantPhrase).toBe('Reverse Foil');
    expect((telemetry as { cert?: unknown }).cert).toBeUndefined();
  });

  it('Case B — Master Ball does not collapse to Reverse Foil', () => {
    expect(
      cardhedgerPokemonFinishSearchHint('MASTER BALL REVERSE HOLO'),
    ).toBe('Master Ball');
    const master = scorePokemonNormalizedShadowCandidate(
      GENGAR_ROWS[2],
      {
        cardName: 'Gengar',
        cardNumber: '094',
        setPhrase: 'Pokemon Japanese 151',
        psaVariety: 'MASTER BALL REVERSE HOLO',
      },
      'q',
    );
    const reverse = scorePokemonNormalizedShadowCandidate(
      GENGAR_ROWS[1],
      {
        cardName: 'Gengar',
        cardNumber: '094',
        setPhrase: 'Pokemon Japanese 151',
        psaVariety: 'MASTER BALL REVERSE HOLO',
      },
      'q',
    );
    expect(master?.verified).toBe(true);
    expect(master?.variant).toBe('Master Ball');
    expect(reverse?.varietyMatched).toBe(false);
  });

  it('Case C/D/E — SV1S / SV1V / SV-P / SVP skip without invented phrases', () => {
    for (const setCode of ['SV1S', 'SV1V', 'SV-P', 'SVP']) {
      expect(
        buildPokemonNormalizedCardhedgerQueries({
          pokemon: {
            game: 'pokemon',
            setCode,
            cardName: 'Pikachu',
            cardNumber: '001',
          },
        }).skipReason,
      ).toBe('insufficient_set_phrase');
    }
  });

  it('marks legacyOnlyCandidate when skip is insufficient_set_phrase but legacy verified', () => {
    const pokemon = {
      game: 'pokemon' as const,
      setCode: 'SVP',
      cardName: 'Pikachu',
      cardNumber: '190',
    };
    const plan = buildPokemonNormalizedCardhedgerQueries({ pokemon });
    expect(plan.skipReason).toBe('insufficient_set_phrase');
    const telemetry = buildPokemonCardhedgerShadowTelemetry({
      collectionKey: 'svp-pikachu',
      pokemon,
      plan,
      legacy: {
        cardId: 'legacy-svp-id',
        query: 'legacy',
        verified: true,
        confidence: 'verified',
      },
      shadow: {
        cardId: null,
        query: null,
        verified: false,
        confidence: null,
      },
      outcome: 'skipped',
    });
    expect(telemetry.legacyOnlyCandidate).toBe(true);
    expect(telemetry.normalized.setCode).toBe('SVP');
    expect(telemetry.normalized.setPhrase).toBeNull();
  });

  it('Case F — insufficient identity fails closed', () => {
    expect(
      buildPokemonNormalizedCardhedgerQueries({
        pokemon: {
          game: 'pokemon',
          setCode: 'SV2a',
          cardName: 'Gengar',
        },
      }).skipReason,
    ).toBe('insufficient_identity');
    expect(
      buildPokemonNormalizedCardhedgerQueries({
        pokemon: {
          game: 'pokemon',
          cardName: 'Pikachu',
          cardNumber: '001',
        },
      }).skipReason,
    ).toBe('insufficient_set_phrase');
  });

  it('Case G — non-Pokémon skipped', () => {
    expect(
      buildPokemonNormalizedCardhedgerQueries({ pokemon: null }).skipReason,
    ).toBe('not_pokemon');
  });

  it('Case A — accepts live Cardhedger set string via token coverage', () => {
    const liveRow = {
      card_id: '1694044201512x180824829158223720',
      description:
        'Gengar 2023 Pokemon Japanese Scarlet & Violet 151 Reverse Foil',
      name: 'Gengar',
      set: '2023 Pokemon Japanese Scarlet & Violet 151',
      number: '94',
      variant: 'Reverse Foil',
    };
    const c = scorePokemonNormalizedShadowCandidate(
      liveRow,
      {
        cardName: 'Gengar',
        cardNumber: '094',
        setPhrase: 'Pokemon Japanese 151',
        psaVariety: 'REVERSE HOLO',
      },
      'Gengar 094 Pokemon Japanese 151 Reverse Foil',
    );
    expect(c?.verified).toBe(true);
    expect(c?.setMatched).toBe(true);
    expect(c?.variant).toBe('Reverse Foil');
  });
});

describe('production safety + outcome semantics', () => {
  it('classifies same / both_fail / legacy_only / shadow_only / conflict', () => {
    expect(
      comparePokemonShadowOutcome({
        legacyId: 'A',
        legacyVerified: true,
        shadowId: 'A',
        shadowVerified: true,
      }),
    ).toBe('same');
    expect(
      comparePokemonShadowOutcome({
        legacyId: null,
        legacyVerified: false,
        shadowId: null,
        shadowVerified: false,
      }),
    ).toBe('both_fail');
    expect(
      comparePokemonShadowOutcome({
        legacyId: 'A',
        legacyVerified: true,
        shadowId: null,
        shadowVerified: false,
      }),
    ).toBe('legacy_only');
    expect(
      comparePokemonShadowOutcome({
        legacyId: null,
        legacyVerified: false,
        shadowId: 'B',
        shadowVerified: true,
      }),
    ).toBe('shadow_only');
    expect(
      comparePokemonShadowOutcome({
        legacyId: 'A',
        legacyVerified: true,
        shadowId: 'B',
        shadowVerified: true,
      }),
    ).toBe('conflict');
  });

  it('conflict keeps production = legacy A (never B)', () => {
    const legacyId = 'A';
    const shadowId = 'B';
    expect(
      comparePokemonShadowOutcome({
        legacyId,
        legacyVerified: true,
        shadowId,
        shadowVerified: true,
      }),
    ).toBe('conflict');
    expect(
      productionCardhedgerIdFromShadowCompare({ legacyId, shadowId }),
    ).toBe('A');
  });

  it('shadow_only does not become production identity', () => {
    expect(
      productionCardhedgerIdFromShadowCompare({
        legacyId: null,
        shadowId: 'shadow-only-id',
      }),
    ).toBeNull();
  });

  it('conflict telemetry includes row digests without cert', () => {
    const plan = buildPokemonNormalizedCardhedgerQueries({
      pokemon: {
        game: 'pokemon',
        setCode: 'SV2a',
        cardName: 'Gengar',
        cardNumber: '094',
      },
      psaVariety: 'REVERSE HOLO',
    });
    const telemetry = buildPokemonCardhedgerShadowTelemetry({
      collectionKey: 'k',
      pokemon: {
        game: 'pokemon',
        setCode: 'SV2a',
        cardName: 'Gengar',
        cardNumber: '094',
      },
      plan,
      legacy: {
        cardId: 'A',
        query: 'legacy-q',
        verified: true,
        confidence: 'verified',
        row: GENGAR_ROWS[1],
      },
      shadow: {
        cardId: 'B',
        query: 'shadow-q',
        verified: true,
        confidence: 'verified',
        row: GENGAR_ROWS[2],
      },
      outcome: 'conflict',
    });
    expect(telemetry.outcome).toBe('conflict');
    expect(telemetry.conflict?.legacyRow?.variant).toBe('Reverse Foil');
    expect(telemetry.conflict?.shadowRow?.variant).toBe('Master Ball');
    expect(JSON.stringify(telemetry)).not.toMatch(/cert/i);
  });
});
