import {
  cardhedgerCatalogVariantSpecificity,
  cardhedgerCertRowUsableForPsaVariety,
  cardhedgerRowIsPrintFinishOnly,
  cardhedgerRowMatchesPsaVariety,
  psaVarietyHasNamedCollectibleIdentity,
} from './cardhedger-psa-variety.util';

const gengarBase = {
  variant: 'Base',
  description: 'Pokemon Japanese 151 Gengar 094',
  name: 'Gengar',
  set: 'Pokemon Japanese 151',
  number: '094',
};

const gengarReverseFoil = {
  ...gengarBase,
  variant: 'Reverse Foil',
  description: 'Pokemon Japanese 151 Gengar Reverse Foil 094',
};

const gengarMasterBall = {
  ...gengarBase,
  variant: 'Master Ball',
  description: 'Pokemon Japanese 151 Gengar Master Ball 094',
};

describe('cardhedgerRowMatchesPsaVariety — JP 151 Gengar finishes', () => {
  it('maps PSA REVERSE HOLO to Reverse Foil, not Master Ball or Base', () => {
    expect(
      cardhedgerRowMatchesPsaVariety(gengarReverseFoil, 'REVERSE HOLO'),
    ).toBe(true);
    expect(
      cardhedgerRowMatchesPsaVariety(gengarMasterBall, 'REVERSE HOLO'),
    ).toBe(false);
    expect(cardhedgerRowMatchesPsaVariety(gengarBase, 'REVERSE HOLO')).toBe(
      false,
    );
  });

  it('maps PSA MASTER BALL REVERSE HOLO to Master Ball, not Reverse Foil', () => {
    expect(
      cardhedgerRowMatchesPsaVariety(
        gengarMasterBall,
        'MASTER BALL REVERSE HOLO',
      ),
    ).toBe(true);
    expect(
      cardhedgerRowMatchesPsaVariety(
        gengarReverseFoil,
        'MASTER BALL REVERSE HOLO',
      ),
    ).toBe(false);
    expect(
      cardhedgerRowMatchesPsaVariety(gengarBase, 'MASTER BALL REVERSE HOLO'),
    ).toBe(false);
  });

  it('does not treat Reverse Foil as a named identity for Master Ball PSA', () => {
    expect(
      psaVarietyHasNamedCollectibleIdentity('MASTER BALL REVERSE HOLO'),
    ).toBe(true);
    expect(psaVarietyHasNamedCollectibleIdentity('REVERSE HOLO')).toBe(false);
    expect(cardhedgerRowIsPrintFinishOnly(gengarReverseFoil)).toBe(true);
    expect(cardhedgerRowIsPrintFinishOnly(gengarMasterBall)).toBe(false);
    expect(
      cardhedgerCatalogVariantSpecificity(
        gengarMasterBall,
        'MASTER BALL REVERSE HOLO',
      ),
    ).toBeGreaterThan(0);
    expect(
      cardhedgerCatalogVariantSpecificity(
        gengarReverseFoil,
        'MASTER BALL REVERSE HOLO',
      ),
    ).toBe(0);
  });

  it('rejects Superfractor cert row when PSA Variety is blank (GemRate mis-map)', () => {
    const ohtaniBase = {
      variant: 'Base',
      description: 'Shohei Ohtani 2018 Bowman Chrome Baseball',
      name: 'Shohei Ohtani',
      set: '2018 Bowman Chrome Baseball',
      number: '1',
    };
    const ohtaniSuperfractor = {
      variant: 'Superfractor',
      description: 'Shohei Ohtani 2018 Bowman Chrome Baseball Superfractor',
      name: 'Shohei Ohtani',
      set: '2018 Bowman Chrome Baseball',
      number: '1',
    };
    expect(cardhedgerRowMatchesPsaVariety(ohtaniBase, '')).toBe(true);
    expect(cardhedgerRowMatchesPsaVariety(ohtaniSuperfractor, '')).toBe(false);
    expect(cardhedgerCertRowUsableForPsaVariety(ohtaniSuperfractor, '')).toBe(
      false,
    );
    expect(cardhedgerCertRowUsableForPsaVariety(ohtaniBase, '')).toBe(true);
  });

  it('accepts Base - Pitching when PSA Variety is blank (sports pose, not parallel)', () => {
    const ohtaniPitching = {
      card_id: '1618415741939x277262937125552130',
      variant: 'Base - Pitching',
      description: 'Shohei Ohtani 2018 Topps Chrome Baseball Pitching',
      name: 'Shohei Ohtani',
      set: '2018 Topps Chrome Baseball',
      number: '150',
    };
    expect(cardhedgerRowMatchesPsaVariety(ohtaniPitching, '')).toBe(true);
    expect(cardhedgerCertRowUsableForPsaVariety(ohtaniPitching, '')).toBe(true);
  });

  it('rejects Base - Variation when PSA Variety is blank or BASE (image variation Spec)', () => {
    const ohtaniVariation = {
      variant: 'Base - Variation',
      description: 'Shohei Ohtani 2018 Topps Chrome Baseball Vatiation',
      name: 'Shohei Ohtani',
      set: '2018 Topps Chrome Baseball',
      number: '150',
    };
    expect(cardhedgerRowMatchesPsaVariety(ohtaniVariation, '')).toBe(false);
    expect(cardhedgerRowMatchesPsaVariety(ohtaniVariation, 'BASE')).toBe(false);
    expect(
      cardhedgerRowMatchesPsaVariety(ohtaniVariation, 'BASEBALL'),
    ).toBe(false);
  });

  it('rejects Superfractor when PSA Variety is BASE (not only when blank)', () => {
    const ohtaniSuperfractor = {
      variant: 'Superfractor',
      description: 'Shohei Ohtani 2018 Bowman Chrome Baseball Superfractor',
      name: 'Shohei Ohtani',
      set: '2018 Bowman Chrome Baseball',
      number: '1',
    };
    const ohtaniBase = {
      variant: 'Base',
      description: 'Shohei Ohtani 2018 Bowman Chrome Baseball',
      name: 'Shohei Ohtani',
      set: '2018 Bowman Chrome Baseball',
      number: '1',
    };
    expect(cardhedgerRowMatchesPsaVariety(ohtaniSuperfractor, 'BASE')).toBe(
      false,
    );
    expect(cardhedgerRowMatchesPsaVariety(ohtaniBase, 'BASE')).toBe(true);
  });

  it('rejects cert Reverse Foil rows for Master Ball PSA Variety', () => {
    expect(
      cardhedgerCertRowUsableForPsaVariety(
        gengarReverseFoil,
        'MASTER BALL REVERSE HOLO',
      ),
    ).toBe(false);
    expect(
      cardhedgerCertRowUsableForPsaVariety(
        gengarMasterBall,
        'MASTER BALL REVERSE HOLO',
      ),
    ).toBe(true);
    expect(
      cardhedgerCertRowUsableForPsaVariety(gengarReverseFoil, 'REVERSE HOLO'),
    ).toBe(true);
    expect(
      cardhedgerCertRowUsableForPsaVariety(null, 'MASTER BALL REVERSE HOLO'),
    ).toBe(false);
    expect(cardhedgerCertRowUsableForPsaVariety(null, 'REVERSE HOLO')).toBe(
      true,
    );
  });
});

describe('cardhedgerRowMatchesPsaVariety — existing TCG / sports parallels', () => {
  it('matches Special Illustration Rare to Cardhedger Base', () => {
    expect(
      cardhedgerRowMatchesPsaVariety(
        { variant: 'Base', description: 'Pikachu', name: 'Pikachu' },
        'SPECIAL ILLUSTRATION RARE',
      ),
    ).toBe(true);
  });

  it('matches Full Art as a rarity label (Base catalog slot)', () => {
    expect(
      cardhedgerRowMatchesPsaVariety(
        { variant: 'Base', description: 'Mew', name: 'Mew' },
        'FULL ART',
      ),
    ).toBe(true);
  });

  it('matches PSA FULL ART/subject compound Variety to Cardhedger Base', () => {
    const row = {
      variant: 'Base',
      description: 'Umbreon VMAX 2021 Pokemon Japanese Sword & Shield Eevee Heroes',
      name: 'Umbreon VMAX',
      set: '2021 Pokemon Japanese Sword & Shield Eevee Heroes',
      number: '95',
    };
    expect(
      cardhedgerRowMatchesPsaVariety(row, 'FULL ART/UMBREON VMAX-HYPER'),
    ).toBe(true);
    expect(
      cardhedgerCertRowUsableForPsaVariety(row, 'FULL ART/UMBREON VMAX-HYPER'),
    ).toBe(true);
    expect(
      cardhedgerRowMatchesPsaVariety(row, 'EEVEE HEROES-HYPER'),
    ).toBe(true);
    expect(cardhedgerCertRowUsableForPsaVariety(row, 'EEVEE HEROES-HYPER')).toBe(
      true,
    );
  });

  it('matches Mega Ultra Rare to Cardhedger Base, not a named parallel', () => {
    const row = {
      variant: 'Base',
      description: 'Mega Charizard X EX 2025 Pokemon Japanese Inferno X',
      name: 'Mega Charizard X EX',
      set: '2025 Pokemon Japanese Inferno X',
      number: '116',
    };
    expect(cardhedgerRowMatchesPsaVariety(row, 'MEGA ULTRA RARE')).toBe(true);
    expect(cardhedgerCertRowUsableForPsaVariety(row, 'MEGA ULTRA RARE')).toBe(
      true,
    );
  });

  it('matches Special Art Rare (SAR) to Cardhedger Base, not a named parallel', () => {
    expect(
      cardhedgerRowMatchesPsaVariety(
        {
          variant: 'Base',
          description: 'Mega Gengar EX 2025 Pokemon Japanese Mega Dream EX',
          name: 'Mega Gengar EX',
          set: '2025 Pokemon Japanese Mega Dream EX',
          number: '240',
        },
        'SPECIAL ART RARE',
      ),
    ).toBe(true);
    expect(
      cardhedgerCertRowUsableForPsaVariety(
        {
          variant: 'Base',
          description: 'Mega Gengar EX 2025 Pokemon Japanese Mega Dream EX',
          name: 'Mega Gengar EX',
          number: '240',
        },
        'SPECIAL ART RARE',
      ),
    ).toBe(true);
  });

  it('matches Silver Prizm to Silver Prizm, not Base', () => {
    expect(
      cardhedgerRowMatchesPsaVariety(
        {
          variant: 'Silver Prizm',
          description: 'Victor Wembanyama Silver Prizm 136',
          name: 'Victor Wembanyama',
        },
        'SILVER PRIZM',
      ),
    ).toBe(true);
    expect(
      cardhedgerRowMatchesPsaVariety(
        {
          variant: 'Base',
          description: 'Victor Wembanyama 136',
          name: 'Victor Wembanyama',
        },
        'SILVER PRIZM',
      ),
    ).toBe(false);
  });

  it('matches Red Manga Alternate Art to the named variant', () => {
    expect(
      cardhedgerRowMatchesPsaVariety(
        {
          variant: 'Red Manga Alternate Art',
          description: 'Charizard Red Manga Alternate Art',
          name: 'Charizard',
        },
        'RED MANGA ALTERNATE ART',
      ),
    ).toBe(true);
    expect(
      cardhedgerRowMatchesPsaVariety(
        {
          variant: 'Base',
          description: 'Charizard 006',
          name: 'Charizard',
        },
        'RED MANGA ALTERNATE ART',
      ),
    ).toBe(false);
  });

  it('maps PSA Red Manga Alternate Art to Cardhedger Red Manga, not Alternate Art or Base', () => {
    const redManga = {
      variant: 'Red Manga',
      description: 'Monkey.D.Luffy 2025 One Piece Carrying On His Will Red Manga',
      name: 'Monkey.D.Luffy',
      set: '2025 One Piece Carrying On His Will',
      number: 'OP13-118',
    };
    expect(
      cardhedgerRowMatchesPsaVariety(redManga, 'RED MANGA ALTERNATE ART'),
    ).toBe(true);
    expect(
      cardhedgerRowMatchesPsaVariety(
        { ...redManga, variant: 'Base', description: 'Monkey.D.Luffy 2025 One Piece Carrying On His Will' },
        'RED MANGA ALTERNATE ART',
      ),
    ).toBe(false);
    expect(
      cardhedgerRowMatchesPsaVariety(
        {
          ...redManga,
          variant: 'Alternate Art',
          description:
            'Monkey.D.Luffy 2025 One Piece Carrying On His Will Alternate Art',
        },
        'RED MANGA ALTERNATE ART',
      ),
    ).toBe(false);
    expect(
      cardhedgerRowMatchesPsaVariety(
        {
          ...redManga,
          variant: 'Manga',
          description: 'Monkey.D.Luffy 2025 One Piece Carrying On His Will Manga',
        },
        'RED MANGA ALTERNATE ART',
      ),
    ).toBe(false);
  });

  it('rejects Blue Wave when PSA only names Blue Refractor', () => {
    expect(
      cardhedgerRowMatchesPsaVariety(
        {
          variant: 'Pitching Blue Wave Refractor',
          description: 'Shohei Ohtani Pitching Blue Wave Refractor',
          name: 'Shohei Ohtani',
        },
        'BLUE REFRACTOR',
      ),
    ).toBe(false);
    expect(
      cardhedgerRowMatchesPsaVariety(
        {
          variant: 'Blue Refractor',
          description: 'Shohei Ohtani Blue Refractor',
          name: 'Shohei Ohtani',
        },
        'BLUE REFRACTOR',
      ),
    ).toBe(true);
  });

  it('accepts Pitching/Batting Blue Refractor when PSA only names BLUE REFRACTOR', () => {
    const pitchingBlue = {
      variant: 'Pitching Blue Refractor',
      description:
        'Shohei Ohtani 2018 Topps Chrome Baseball Pitching Blue Refractor',
      name: 'Shohei Ohtani',
      set: '2018 Topps Chrome Baseball',
      number: '150',
    };
    const battingBlue = {
      ...pitchingBlue,
      variant: 'Batting Blue Refractor',
      description:
        'Shohei Ohtani 2018 Topps Chrome Baseball Batting Blue Refractor',
    };
    expect(cardhedgerRowMatchesPsaVariety(pitchingBlue, 'BLUE REFRACTOR')).toBe(
      true,
    );
    expect(cardhedgerCertRowUsableForPsaVariety(pitchingBlue, 'BLUE REFRACTOR')).toBe(
      true,
    );
    expect(cardhedgerRowMatchesPsaVariety(battingBlue, 'BLUE REFRACTOR')).toBe(
      true,
    );
    // PSA named a pose → catalog must carry the same pose (not the sibling).
    expect(
      cardhedgerRowMatchesPsaVariety(battingBlue, 'PITCHING BLUE REFRACTOR'),
    ).toBe(false);
    expect(
      cardhedgerRowMatchesPsaVariety(pitchingBlue, 'PITCHING BLUE REFRACTOR'),
    ).toBe(true);
    // Print-run suffix on pop UI copy must not break matching.
    expect(
      cardhedgerRowMatchesPsaVariety(pitchingBlue, 'BLUE REFRACTOR /150'),
    ).toBe(true);
  });

  it('keeps PSA VARIATION-* apart from flagship Pitching / Blue Refractor rows', () => {
    const pitchingBlue = {
      variant: 'Pitching Blue Refractor',
      description:
        'Shohei Ohtani 2018 Topps Chrome Baseball Pitching Blue Refractor',
      name: 'Shohei Ohtani',
    };
    const variationBlue = {
      variant: 'Variation Blue Refractor',
      description:
        'Shohei Ohtani 2018 Topps Chrome Baseball Variation Blue Refractor',
      name: 'Shohei Ohtani',
    };
    const baseVariation = {
      variant: 'Base - Variation',
      description: 'Shohei Ohtani 2018 Topps Chrome Baseball Vatiation',
      name: 'Shohei Ohtani',
    };
    expect(
      cardhedgerRowMatchesPsaVariety(pitchingBlue, 'VARIATION-BLUE REFRACTOR'),
    ).toBe(false);
    expect(
      cardhedgerRowMatchesPsaVariety(variationBlue, 'VARIATION-BLUE REFRACTOR'),
    ).toBe(true);
    expect(
      cardhedgerRowMatchesPsaVariety(variationBlue, 'BLUE REFRACTOR'),
    ).toBe(false);
    expect(
      cardhedgerRowMatchesPsaVariety(baseVariation, 'BLUE REFRACTOR'),
    ).toBe(false);
    expect(
      cardhedgerRowMatchesPsaVariety(pitchingBlue, 'VARIATION-REFRACTOR'),
    ).toBe(false);
  });

  it('accepts Cardhedger Chrome shorthand that omits Refractor (Green Wave / Prism)', () => {
    expect(
      cardhedgerRowMatchesPsaVariety(
        {
          variant: 'Pitching Green Wave',
          description: 'Shohei Ohtani 2018 Topps Chrome Baseball Pitching Green Wave',
        },
        'GREEN WAVE REFRACTOR',
      ),
    ).toBe(true);
    expect(
      cardhedgerCertRowUsableForPsaVariety(
        {
          variant: 'Pitching Prism',
          description: 'Shohei Ohtani 2018 Topps Chrome Baseball Pitching Prism',
        },
        'PRISM REFRACTOR',
      ),
    ).toBe(true);
    // Still reject Wave when PSA did not name Wave.
    expect(
      cardhedgerRowMatchesPsaVariety(
        {
          variant: 'Pitching Green Wave',
          description: 'Shohei Ohtani Pitching Green Wave',
        },
        'GREEN REFRACTOR',
      ),
    ).toBe(false);
    // Variation Refractor must not collapse onto Base - Variation.
    expect(
      cardhedgerRowMatchesPsaVariety(
        {
          variant: 'Base - Variation',
          description: 'Shohei Ohtani 2018 Topps Chrome Baseball Vatiation',
        },
        'VARIATION-REFRACTOR',
      ),
    ).toBe(false);
  });

  it('rejects GemRate mis-maps for PSA VARIATION-* when catalog has no Variation parallel', () => {
    const flagshipOrange = {
      variant: 'Orange Refractor',
      description: 'Shohei Ohtani 2018 Topps Chrome Baseball Orange Refractor',
      number: '150',
    };
    const variationRedJersey = {
      variant: 'Variation Red Jersey',
      description: 'Shohei Ohtani 2018 Topps Chrome Baseball Red Jersey',
      number: '150',
    };
    const flagshipRefractor = {
      variant: 'Refractor',
      description: 'Shohei Ohtani 2018 Topps Chrome Baseball Refractor',
      number: '150',
    };
    const baseVariation = {
      variant: 'Base - Variation',
      description: 'Shohei Ohtani 2018 Topps Chrome Baseball Vatiation',
      number: '150',
    };
    const redJerseyRefractor = {
      variant: 'Red Jersey Refractor',
      description:
        'Shohei Ohtani 2018 Topps Chrome Baseball Red Jersey Refractor',
      number: '150',
    };
    expect(
      cardhedgerCertRowUsableForPsaVariety(
        flagshipOrange,
        'VARIATION-ORANGE REFRACTOR',
      ),
    ).toBe(false);
    expect(
      cardhedgerCertRowUsableForPsaVariety(
        variationRedJersey,
        'VARIATION-REFRACTOR',
      ),
    ).toBe(false);
    expect(
      cardhedgerCertRowUsableForPsaVariety(
        flagshipRefractor,
        'VARIATION-REFRACTOR',
      ),
    ).toBe(false);
    expect(
      cardhedgerCertRowUsableForPsaVariety(
        baseVariation,
        'VARIATION-GREEN REFRACTOR',
      ),
    ).toBe(false);
    // PSA Spec VARIATION-REFRACTOR ↔ Cardhedger / slab "Red Jersey Refractor".
    expect(
      cardhedgerCertRowUsableForPsaVariety(
        redJerseyRefractor,
        'VARIATION-REFRACTOR',
      ),
    ).toBe(true);
  });

  it('maps PSA Championship 2024-Top Prize to Cardhedger Championship 2024, not Base or Top Prize', () => {
    const championship = {
      variant: 'Championship 2024',
      description:
        'Nefeltari Vivi 2023 One Piece Japanese Awakening of the New Era Championship 2024',
      name: 'Nefeltari Vivi',
      set: '2023 One Piece Japanese Awakening of the New Era',
      number: 'OP05-086',
    };
    expect(
      cardhedgerRowMatchesPsaVariety(championship, 'CHAMPIONSHIP 2024-TOP PRIZE'),
    ).toBe(true);
    expect(
      cardhedgerRowMatchesPsaVariety(
        { ...championship, variant: 'Base' },
        'CHAMPIONSHIP 2024-TOP PRIZE',
      ),
    ).toBe(false);
    expect(
      cardhedgerRowMatchesPsaVariety(
        {
          variant: 'Top Prize',
          description:
            'Portgas.D.Ace 2024 One Piece Japanese 500 Years in the Future Top Prize',
          name: 'Portgas.D.Ace',
          set: '2024 One Piece Japanese 500 Years in the Future',
          number: 'OP07-119',
        },
        'CHAMPIONSHIP 2024-TOP PRIZE',
      ),
    ).toBe(false);
    expect(
      cardhedgerRowMatchesPsaVariety(
        {
          ...championship,
          variant: 'Championship 2024 Finalist',
          description:
            'Nefeltari Vivi 2023 One Piece Japanese Awakening of the New Era Championship 2024 Finalist',
        },
        'CHAMPIONSHIP 2024-TOP PRIZE',
      ),
    ).toBe(false);
  });
});
