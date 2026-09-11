import {
  cardNumberTokenForCardhedgerSearch,
  catalogRowTrustedForMarketData,
  catalogTcgPrefixedNumberCompatible,
  normalizeForExactCardNumberKey,
  relaxedCatalogMatchForAudit,
  exactCatalogMatch,
} from './card-match.util';

describe('cardNumberTokenForCardhedgerSearch', () => {
  it('strips leading zeros for numeric Pokemon-style numbers', () => {
    expect(cardNumberTokenForCardhedgerSearch('024')).toBe('#24');
    expect(cardNumberTokenForCardhedgerSearch('#024')).toBe('#24');
    expect(cardNumberTokenForCardhedgerSearch('085')).toBe('#85');
  });

  it('keeps alphanumeric promo numbers', () => {
    expect(cardNumberTokenForCardhedgerSearch('SWSH029')).toBe('#SWSH029');
  });
});

describe('normalizeForExactCardNumberKey', () => {
  it('treats PSA 085 and Cardhedger 85 as the same key', () => {
    expect(normalizeForExactCardNumberKey('085')).toBe('85');
    expect(normalizeForExactCardNumberKey('85')).toBe('85');
  });
});

describe('catalogTcgPrefixedNumberCompatible', () => {
  it('matches PSA 086 to Cardhedger OP05-086', () => {
    expect(catalogTcgPrefixedNumberCompatible('086', 'OP05-086')).toBe(true);
    expect(catalogTcgPrefixedNumberCompatible('OP05-086', '086')).toBe(true);
  });

  it('rejects a different checklist suffix', () => {
    expect(catalogTcgPrefixedNumberCompatible('086', 'OP07-119')).toBe(false);
    expect(catalogTcgPrefixedNumberCompatible('086', 'OP13-012')).toBe(false);
  });
});

describe('relaxedCatalogMatchForAudit', () => {
  const cooperFlaggRow = {
    name: 'Cooper Flagg 2025 Topps Chrome Basketball Refractor',
    number: '251',
    set: '2025 Topps Chrome Basketball',
  };

  it('accepts abbreviated mint components vs full Cardhedger catalog row', () => {
    const r = relaxedCatalogMatchForAudit(
      {
        cardName: 'cooper flagg',
        cardSet: 'topps chrome',
        cardNumber: '251',
      },
      cooperFlaggRow,
    );
    expect(r.ok).toBe(true);
    expect(r.failCodes).toEqual([]);
  });

  it('accepts PSA Subject/Brand mirrors when mint names are abbreviated', () => {
    const r = relaxedCatalogMatchForAudit(
      {
        cardName: 'cooper flagg',
        cardSet: 'topps chrome',
        cardNumber: '251',
        psaSubject: 'COOPER FLAGG',
        psaBrand: 'TOPPS CHROME',
      },
      cooperFlaggRow,
    );
    expect(r.ok).toBe(true);
  });

  it('rejects wrong card number', () => {
    const r = relaxedCatalogMatchForAudit(
      {
        cardName: 'cooper flagg',
        cardSet: 'topps chrome',
        cardNumber: '99',
      },
      cooperFlaggRow,
    );
    expect(r.ok).toBe(false);
    expect(r.failCodes).toContain('number_mismatch');
  });
});

describe('catalogRowTrustedForMarketData', () => {
  const italianCharmanderHints = {
    cardName: 'charmander',
    cardSet: 'pokemon game',
    cardNumber: '046',
    psaSubject: 'CHARMANDER',
    psaBrand: '2000 POKEMON GAME ITALIAN',
  };

  const obsidianPromoRow = {
    name: '2023 Pokemon SV Obsidian Flames ETB Black Star Promo Charmander',
    number: '044',
    set: '2023 Pokemon SV Black Star Promo',
  };

  it('rejects 2023 Obsidian Flames promo for 2000 Italian #046 Charmander', () => {
    const r = catalogRowTrustedForMarketData(
      italianCharmanderHints,
      obsidianPromoRow,
    );
    expect(r.ok).toBe(false);
    expect(r.failCodes).toContain('number_mismatch');
  });

  it('rejects same-name wrong-era row even when card numbers were equal', () => {
    const r = catalogRowTrustedForMarketData(italianCharmanderHints, {
      ...obsidianPromoRow,
      number: '046',
    });
    expect(r.ok).toBe(false);
    expect(r.failCodes.length).toBeGreaterThan(0);
  });

  it('accepts aligned vintage catalog row', () => {
    const r = catalogRowTrustedForMarketData(italianCharmanderHints, {
      name: '2000 Pokemon Game Italian Charmander 1st Edition',
      number: '046',
      set: '2000 Pokemon Game Italian',
    });
    expect(r.ok).toBe(true);
    expect(r.failCodes).toEqual([]);
  });

  it('rejects comps when collection card number is missing', () => {
    const r = catalogRowTrustedForMarketData(
      { ...italianCharmanderHints, cardNumber: '' },
      obsidianPromoRow,
    );
    expect(r.ok).toBe(false);
    expect(r.failCodes).toContain('missing_card_number');
  });

  it('matches FULL ART/UMBREON VMAX-HYPER to Cardhedger Umbreon VMAX Eevee Heroes', () => {
    const r = catalogRowTrustedForMarketData(
      {
        cardName: 'FULL ART/UMBREON VMAX-HYPER',
        cardSet: 'POKEMON JAPANESE SWORD & SHIELD EEVEE HEROES',
        cardNumber: '095',
        psaSubject: 'FULL ART/UMBREON VMAX-HYPER',
        psaBrand: 'POKEMON JAPANESE SWORD & SHIELD EEVEE HEROES',
        psaVariety: 'FULL ART/UMBREON VMAX-HYPER',
        psaYear: '2021',
      },
      {
        name: 'Umbreon VMAX',
        number: '95',
        set: '2021 Pokemon Japanese Sword & Shield Eevee Heroes',
        variant: 'Base',
        description:
          'Umbreon VMAX 2021 Pokemon Japanese Sword & Shield Eevee Heroes',
      },
    );
    expect(r.ok).toBe(true);
  });

  it('matches PSA FA/SUBJECT cardName to Cardhedger Umbreon VMAX', () => {
    const r = catalogRowTrustedForMarketData(
      {
        cardName: 'FA/UMBREON VMAX',
        cardSet: 'POKEMON JAPANESE SWORD & SHIELD EEVEE HEROES',
        cardNumber: '095',
        psaSubject: 'FA/UMBREON VMAX',
        psaBrand: 'POKEMON JAPANESE SWORD & SHIELD EEVEE HEROES',
        psaVariety: 'EEVEE HEROES-HYPER',
        psaYear: '2021',
      },
      {
        name: 'Umbreon VMAX',
        number: '95',
        set: '2021 Pokemon Japanese Sword & Shield Eevee Heroes',
        variant: 'Base',
        description:
          'Umbreon VMAX 2021 Pokemon Japanese Sword & Shield Eevee Heroes',
      },
    );
    expect(r.ok).toBe(true);
  });

  it('trusts parent Prizm Basketball checklist # when PSA uses insert code RSLW4', () => {
    const r = catalogRowTrustedForMarketData(
      {
        cardName: 'LONNIE WALKER IV',
        cardSet: 'PANINI PRIZM ROOKIE SIGNATURES',
        cardNumber: 'RSLW4',
        psaSubject: 'LONNIE WALKER IV',
        psaBrand: 'PANINI PRIZM ROOKIE SIGNATURES',
        psaVariety: 'ROOKIE SIGNATURES',
        psaYear: '2018',
        cardhedgerSearchQuery:
          '2018 Panini Prizm Rookie Signatures Lonnie Walker IV RSLW4',
      },
      {
        name: 'Lonnie Walker IV',
        // Live Cardhedger uses checklist #18; PSA slab prints insert code RSLW4.
        number: '18',
        set: '2018 Panini Prizm Basketball',
        variant: 'Base',
        description:
          'Lonnie Walker IV 2018 Panini Prizm Rookie Signatures Basketball',
      },
    );
    expect(r.ok).toBe(true);
  });

  it('rejects Dominion Rookie Signatures when PSA brand is Prizm', () => {
    const r = catalogRowTrustedForMarketData(
      {
        cardName: 'LONNIE WALKER IV',
        cardSet: 'PANINI PRIZM ROOKIE SIGNATURES',
        cardNumber: 'RSLW4',
        psaSubject: 'LONNIE WALKER IV',
        psaBrand: 'PANINI PRIZM ROOKIE SIGNATURES',
        psaVariety: 'ROOKIE SIGNATURES',
        psaYear: '2018',
      },
      {
        name: 'Lonnie Walker IV',
        number: 'RR-LW4',
        set: '2018 Panini Dominion Basketball',
        variant: 'Base',
        description:
          'Lonnie Walker IV 2018 Panini Dominion Regal Rookie Signatures Basketball',
      },
    );
    expect(r.ok).toBe(false);
    expect(r.failCodes).toEqual(
      expect.arrayContaining(['number_mismatch']),
    );
  });

  it('rejects Sensational Signatures when PSA variety is Rookie Signatures', () => {
    const r = catalogRowTrustedForMarketData(
      {
        cardName: 'LONNIE WALKER IV',
        cardSet: 'PANINI PRIZM ROOKIE SIGNATURES',
        cardNumber: 'RSLW4',
        psaSubject: 'LONNIE WALKER IV',
        psaBrand: 'PANINI PRIZM ROOKIE SIGNATURES',
        psaVariety: 'ROOKIE SIGNATURES',
        psaYear: '2018',
      },
      {
        name: 'Lonnie Walker IV',
        number: '18',
        set: '2018 Panini Prizm Basketball',
        variant: 'Base',
        description:
          'Lonnie Walker IV 2018 Panini Prizm Sensational Signatures Basketball',
      },
    );
    expect(r.ok).toBe(false);
  });

  it('matches PSA One Piece promo 086 + Championship 2024-Top Prize to OP05-086 Championship 2024', () => {
    const r = catalogRowTrustedForMarketData(
      {
        cardName: 'NEFELTARI VIVI',
        cardSet: 'ONE PIECE JAPANESE PROMOS',
        cardNumber: '086',
        psaSubject: 'NEFELTARI VIVI',
        psaBrand: 'ONE PIECE JAPANESE PROMOS',
        psaVariety: 'CHAMPIONSHIP 2024-TOP PRIZE',
        psaYear: '2024',
        cardhedgerSearchQuery:
          '2024 One Piece Japanese Promos Nefeltari Vivi Championship 2024-Top Prize 086',
      },
      {
        name: 'Nefeltari Vivi',
        number: 'OP05-086',
        set: '2023 One Piece Japanese Awakening of the New Era',
        variant: 'Championship 2024',
        description:
          'Nefeltari Vivi 2023 One Piece Japanese Awakening of the New Era Championship 2024',
      },
    );
    expect(r.ok).toBe(true);
  });

  it('rejects a different One Piece checklist number even when the name matches', () => {
    const r = catalogRowTrustedForMarketData(
      {
        cardName: 'NEFELTARI VIVI',
        cardSet: 'ONE PIECE JAPANESE PROMOS',
        cardNumber: '086',
        psaSubject: 'NEFELTARI VIVI',
        psaBrand: 'ONE PIECE JAPANESE PROMOS',
        psaVariety: 'CHAMPIONSHIP 2024-TOP PRIZE',
        psaYear: '2024',
      },
      {
        name: 'Portgas.D.Ace',
        number: 'OP07-119',
        set: '2024 One Piece Japanese 500 Years in the Future',
        variant: 'Top Prize',
        description:
          'Portgas.D.Ace 2024 One Piece Japanese 500 Years in the Future Top Prize',
      },
    );
    expect(r.ok).toBe(false);
    expect(r.failCodes).toContain('number_mismatch');
  });
});

describe('exactCatalogMatch', () => {
  it('fails abbreviated mint vs full catalog (why audit used to clear valid ids)', () => {
    const r = exactCatalogMatch(
      {
        cardName: 'cooper flagg',
        cardSet: 'topps chrome',
        cardNumber: '251',
      },
      {
        name: 'Cooper Flagg 2025 Topps Chrome Basketball Refractor',
        number: '251',
        set: { name: '2025 Topps Chrome Basketball' },
      },
    );
    expect(r.ok).toBe(false);
    expect(r.failCodes).toEqual(
      expect.arrayContaining(['name_mismatch', 'set_mismatch']),
    );
  });
});
