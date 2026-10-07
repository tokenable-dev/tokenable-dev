/**
 * Pokémon mint Cardhedger matching — end-to-end regression (mocked Cardhedger rows).
 * Covers hardened Pokémon gate, deferred sets, variant/year/approx, non-Pokémon soft gate.
 * No live API / staging / production.
 */
import type { ConfigService } from '@nestjs/config';
import { CardhedgerService } from '../../cardhedger/cardhedger.service';
import { PsaPublicApiService } from '../../psa/psa-public-api.service';
import { PsaService } from '../../psa/psa.service';
import { normalizePokemonMetadata } from './pokemon-metadata-normalize.util';
import {
  lookupPokemonCardhedgerSetPhrase,
  pokemonCardhedgerPrimarySetPhrase,
} from './pokemon-cardhedger-set-phrase.util';

function mintService(forwardJson: jest.Mock): PsaService {
  return new PsaService(
    {} as PsaPublicApiService,
    {
      assertConfigured: () => undefined,
      forwardJson,
    } as unknown as CardhedgerService,
    { get: () => undefined } as unknown as ConfigService,
  );
}

async function tryMint(
  svc: PsaService,
  searchQuery: string,
  hints: {
    cardName: string;
    cardNumber: string;
    cardSet?: string;
    psaVariety?: string | null;
    category?: string | null;
  },
  opts?: { allowApproximate?: boolean },
) {
  return (
    svc as unknown as {
      tryResolveCardhedgerMint: (
        q: string,
        h: typeof hints,
        o?: { allowApproximate?: boolean },
      ) => Promise<{ cardId: string; matchConfidence: string } | undefined>;
    }
  ).tryResolveCardhedgerMint(searchQuery, hints, opts);
}

/** Conceptual pre-V5 gate (documentation fixture — not production code). */
function preV5WouldVerify(input: {
  numMatch: boolean;
  setMatch: boolean;
  nameMatch: boolean;
}): boolean {
  return input.numMatch && (input.setMatch || input.nameMatch);
}

describe('V6 mint E2E — original bug vs V5', () => {
  it('documents pre-V5 failure mode: number+name without set would verify', () => {
    expect(
      preV5WouldVerify({
        numMatch: true,
        setMatch: false,
        nameMatch: true,
      }),
    ).toBe(true);
  });

  it('current mint: weak SV2a + wrong-set Gengar does not verify; correct set does', async () => {
    const wrong = {
      card_id: 'gengar-wrong',
      name: 'Gengar',
      set: '2022 Pokemon Japanese Dark Phantasma',
      number: '094',
      variant: 'Base',
    };
    const right = {
      card_id: 'gengar-151',
      name: 'Gengar',
      set: '2023 Pokemon Japanese Scarlet & Violet 151',
      number: '094',
      variant: 'Base',
    };
    const hints = {
      cardName: 'Gengar',
      cardNumber: '094',
      cardSet: 'SV2a',
      category: 'Pokemon',
      psaVariety: 'REVERSE HOLO' as string | null,
    };
    // Use Base-compatible variety for this pair
    hints.psaVariety = null;

    expect(
      await tryMint(
        mintService(jest.fn(async () => ({ cards: [wrong] }))),
        'Gengar 094',
        hints,
      ),
    ).toBeUndefined();

    const hit = await tryMint(
      mintService(jest.fn(async () => ({ cards: [wrong, right] }))),
      'Gengar 094',
      hints,
    );
    expect(hit?.cardId).toBe('gengar-151');
    expect(hit?.matchConfidence).toBe('verified');
  });
});

describe('V6 mint E2E — implemented phrase mappings', () => {
  const cases: Array<{
    setCode: string;
    brand: string;
    cardName: string;
    cardNumber: string;
    phrase: string;
    correctSet: string;
    wrongSet: string;
    variety?: string;
  }> = [
    {
      setCode: 'SV2a',
      brand: 'POKEMON JAPANESE SV2a-POKEMON CARD 151',
      cardName: 'Gengar',
      cardNumber: '094',
      phrase: 'Pokemon Japanese 151',
      correctSet: '2023 Pokemon Japanese Scarlet & Violet 151',
      wrongSet: '2022 Pokemon Japanese Dark Phantasma',
    },
    {
      setCode: 'M2',
      brand: 'POKEMON JAPANESE M2 INFERNO X',
      cardName: 'Mega Charizard X ex',
      cardNumber: '116',
      phrase: 'Pokemon Japanese Inferno X',
      correctSet: '2025 Pokemon Japanese Inferno X',
      wrongSet: '2025 Pokemon Japanese Mega Dream EX',
      variety: 'MEGA ULTRA RARE',
    },
    {
      setCode: 'M2a',
      brand: 'POKEMON JAPANESE M2a MEGA DREAM EX',
      cardName: 'Mega Gengar ex',
      cardNumber: '240',
      phrase: 'Pokemon Japanese Mega Dream EX',
      correctSet: '2025 Pokemon Japanese Mega Dream EX',
      wrongSet: '2025 Pokemon Japanese Inferno X',
      variety: 'SPECIAL ART RARE',
    },
    {
      setCode: 'SVP',
      brand: 'POKEMON SVP BLACK STAR PROMOS',
      cardName: 'Pikachu',
      cardNumber: '190',
      phrase: 'Pokemon Scarlet Violet Black Star Promos',
      correctSet: '2024 Pokemon Scarlet & Violet Black Star Promos',
      wrongSet: '2022 Pokemon Japanese Dark Phantasma',
    },
    {
      setCode: 'SV1V',
      brand: 'POKEMON JAPANESE SV1V-VIOLET EX',
      cardName: 'Miraidon ex',
      cardNumber: '94',
      phrase: 'Pokemon Japanese Scarlet & Violet Violet EX',
      correctSet: '2023 Pokemon Japanese Scarlet & Violet Violet EX',
      wrongSet: '2023 Pokemon Japanese Scarlet & Violet Triplet Beat',
    },
  ];

  it.each(cases)(
    '$setCode mapping: normalize + phrase + mint correct/wrong set',
    async (c) => {
      const norm = normalizePokemonMetadata({
        brand: c.brand,
        category: 'Pokemon',
        subject: c.cardName,
        cardNumber: c.cardNumber,
        variety: c.variety,
      });
      expect(norm?.setCode).toBe(c.setCode);
      expect(pokemonCardhedgerPrimarySetPhrase(c.setCode)).toBe(c.phrase);
      expect(lookupPokemonCardhedgerSetPhrase(c.setCode)?.primaryPhrase).toBe(
        c.phrase,
      );

      const correct = {
        card_id: `${c.setCode}-correct`,
        name: c.cardName,
        set: c.correctSet,
        number: c.cardNumber,
        variant: 'Base',
      };
      const wrong = {
        card_id: `${c.setCode}-wrong`,
        name: c.cardName,
        set: c.wrongSet,
        number: c.cardNumber,
        variant: 'Base',
      };

      expect(
        await tryMint(
          mintService(jest.fn(async () => ({ cards: [wrong] }))),
          `${c.cardName} ${c.cardNumber}`,
          {
            cardName: c.cardName,
            cardNumber: c.cardNumber,
            cardSet: c.brand,
            category: 'Pokemon',
            psaVariety: c.variety ?? null,
          },
        ),
      ).toBeUndefined();

      const hit = await tryMint(
        mintService(jest.fn(async () => ({ cards: [wrong, correct] }))),
        `${c.cardName} ${c.cardNumber} ${c.phrase}`,
        {
          cardName: c.cardName,
          cardNumber: c.cardNumber,
          cardSet: c.brand,
          category: 'Pokemon',
          psaVariety: c.variety ?? null,
        },
      );
      expect(hit?.cardId).toBe(`${c.setCode}-correct`);
      expect(hit?.matchConfidence).toBe('verified');
    },
  );
});

describe('V6 mint E2E — deferred SV1S / SV-P', () => {
  it('SV1S has canonical metadata but no Cardhedger phrase', () => {
    const n = normalizePokemonMetadata({
      brand: 'POKEMON JAPANESE SV1S-SCARLET EX',
      category: 'Pokemon',
      subject: 'Koraidon ex',
      cardNumber: '103',
    });
    expect(n?.setCode).toBe('SV1S');
    expect(n?.setName).toBe('Scarlet ex');
    expect(pokemonCardhedgerPrimarySetPhrase('SV1S')).toBeNull();
  });

  it('SV1S does not invent phrase and does not verify via name+number on EX-like sets', async () => {
    const shiny = {
      card_id: 'sv1s-false-positive',
      name: 'Koraidon EX',
      set: '2023 Pokemon Japanese Scarlet & Violet Shiny Treasure EX',
      number: '103',
      variant: 'Base',
    };
    const scarlet = {
      card_id: 'sv1s-scarlet-ex',
      name: 'Koraidon EX',
      set: '2023 Pokemon Japanese Scarlet EX',
      number: '103',
      variant: 'Base',
    };
    // Deferred: fail closed even against the "real" Scarlet EX row — no safe phrase yet.
    for (const cards of [[shiny], [scarlet], [shiny, scarlet]]) {
      expect(
        await tryMint(
          mintService(jest.fn(async () => ({ cards }))),
          'Koraidon ex 103',
          {
            cardName: 'Koraidon ex',
            cardNumber: '103',
            cardSet: 'POKEMON JAPANESE SV1S-SCARLET EX',
            category: 'Pokemon',
          },
        ),
      ).toBeUndefined();
    }
  });

  it('SV-P has no invented Cardhedger phrase; name+number alone cannot verify', async () => {
    expect(pokemonCardhedgerPrimarySetPhrase('SV-P')).toBeNull();
    const n = normalizePokemonMetadata({
      brand: 'POKEMON JAPANESE SV-P',
      category: 'Pokemon',
      subject: 'Pikachu',
      cardNumber: '001',
    });
    expect(n?.setCode).toBe('SV-P');
    expect(n?.setName).toBeUndefined();

    // Plausible JP promo row — without a curated phrase, mint must not soft-verify on name alone.
    // Brand token coverage may still match SV-P Promos strings; reject unrelated sets at least.
    const unrelated = {
      card_id: 'svp-unrelated',
      name: 'Pikachu',
      set: '2023 Pokemon Japanese Scarlet & Violet 151',
      number: '001',
      variant: 'Base',
    };
    expect(
      await tryMint(
        mintService(jest.fn(async () => ({ cards: [unrelated] }))),
        'Pikachu 001',
        {
          cardName: 'Pikachu',
          cardNumber: '001',
          cardSet: 'POKEMON JAPANESE SV-P',
          category: 'Pokemon',
        },
      ),
    ).toBeUndefined();
  });
});

describe('V6 mint E2E — variant / year / approximate / ties', () => {
  const baseHints = {
    cardName: 'Gengar',
    cardNumber: '094',
    cardSet: 'POKEMON JAPANESE SV2a-POKEMON CARD 151',
    category: 'Pokemon',
  };
  const rows = {
    base: {
      card_id: 'g-base',
      name: 'Gengar',
      set: '2023 Pokemon Japanese Scarlet & Violet 151',
      number: '094',
      variant: 'Base',
    },
    reverse: {
      card_id: 'g-rev',
      name: 'Gengar',
      set: '2023 Pokemon Japanese Scarlet & Violet 151',
      number: '094',
      variant: 'Reverse Foil',
    },
    master: {
      card_id: 'g-master',
      name: 'Gengar',
      set: '2023 Pokemon Japanese Scarlet & Violet 151',
      number: '094',
      variant: 'Master Ball',
    },
  };

  it('REVERSE HOLO → Reverse Foil; Master Ball rejected', async () => {
    const hit = await tryMint(
      mintService(
        jest.fn(async () => ({
          cards: [rows.base, rows.reverse, rows.master],
        })),
      ),
      'Gengar 094',
      { ...baseHints, psaVariety: 'REVERSE HOLO' },
    );
    expect(hit?.cardId).toBe('g-rev');
  });

  it('MASTER BALL REVERSE HOLO → Master Ball; Reverse Foil rejected', async () => {
    const hit = await tryMint(
      mintService(
        jest.fn(async () => ({
          cards: [rows.base, rows.reverse, rows.master],
        })),
      ),
      'Gengar 094',
      { ...baseHints, psaVariety: 'MASTER BALL REVERSE HOLO' },
    );
    expect(hit?.cardId).toBe('g-master');
  });

  it('SAR → Base compatibility preserved', async () => {
    const hit = await tryMint(
      mintService(jest.fn(async () => ({ cards: [rows.base] }))),
      'Gengar 094',
      { ...baseHints, psaVariety: 'SPECIAL ART RARE' },
    );
    expect(hit?.cardId).toBe('g-base');
  });

  it('year mismatch hard-rejects; missing year preserves match', async () => {
    const y2024 = {
      ...rows.base,
      card_id: 'g-2024',
      set: '2024 Pokemon Japanese Scarlet & Violet 151',
    };
    expect(
      await tryMint(
        mintService(jest.fn(async () => ({ cards: [y2024] }))),
        '2023 Gengar 094 Pokemon Japanese 151',
        baseHints,
      ),
    ).toBeUndefined();

    const hit = await tryMint(
      mintService(jest.fn(async () => ({ cards: [y2024] }))),
      'Gengar 094 Pokemon Japanese 151',
      baseHints,
    );
    expect(hit?.cardId).toBe('g-2024');
  });

  it('Pokémon approximate cannot bypass wrong-set fail-closed', async () => {
    const wrong = {
      card_id: 'g-dark',
      name: 'Gengar',
      set: '2022 Pokemon Japanese Dark Phantasma',
      number: '094',
      variant: 'Base',
    };
    expect(
      await tryMint(
        mintService(jest.fn(async () => ({ cards: [wrong] }))),
        'Gengar 094',
        baseHints,
        { allowApproximate: true },
      ),
    ).toBeUndefined();
  });

  it('two verified same-score candidates keep card_id tie-break', async () => {
    const a = { ...rows.base, card_id: 'zzz-id' };
    const b = { ...rows.base, card_id: 'aaa-id' };
    const hit = await tryMint(
      mintService(jest.fn(async () => ({ cards: [a, b] }))),
      'Gengar 094',
      baseHints,
    );
    expect(hit?.cardId).toBe('aaa-id');
  });
});

describe('V6 mint E2E — non-Pokémon compatibility', () => {
  it('sports soft set: number+name still verifies without set match', async () => {
    const hit = await tryMint(
      mintService(
        jest.fn(async () => ({
          cards: [
            {
              card_id: 'ohtani-chrome',
              name: 'Shohei Ohtani',
              set: '2018 Topps Chrome Baseball',
              number: '150',
              variant: 'Base',
            },
          ],
        })),
      ),
      'Shohei Ohtani 150',
      {
        cardName: 'Shohei Ohtani',
        cardNumber: '150',
        cardSet: 'TOPPS UPDATE',
        category: 'BASEBALL',
      },
    );
    expect(hit?.cardId).toBe('ohtani-chrome');
    expect(hit?.matchConfidence).toBe('verified');
  });

  it('does not apply Pokémon phrase map to non-Pokémon', async () => {
    expect(pokemonCardhedgerPrimarySetPhrase('SV2a')).toBe(
      'Pokemon Japanese 151',
    );
    const hit = await tryMint(
      mintService(
        jest.fn(async () => ({
          cards: [
            {
              card_id: 'sports-150',
              name: 'Player',
              set: '2018 Panini Prizm',
              number: '150',
              variant: 'Base',
            },
          ],
        })),
      ),
      'Player 150',
      {
        cardName: 'Player',
        cardNumber: '150',
        cardSet: 'SV2a',
        category: 'BASEBALL',
      },
    );
    // Not Pokémon → soft gate; set SV2a does not match Panini but name+number verifies
    expect(hit?.cardId).toBe('sports-150');
  });
});
