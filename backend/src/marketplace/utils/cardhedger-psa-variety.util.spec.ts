import {
  cardhedgerCatalogVariantSpecificity,
  cardhedgerCertRowRelaxedGemRateLink,
  cardhedgerCertRowUsableForPsaVariety,
  psaVarietyIsPokemonCenterSpecialBoxLine,
  cardhedgerRowIsPrintFinishOnly,
  cardhedgerRowMatchesPsaVariety,
  compTitlesMissParallelTokenSeenOnSibling,
  parallelTokensBeyondColor,
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

  it('accepts a cert Base row when PSA only abbreviates the stamp line', () => {
    expect(
      cardhedgerCertRowUsableForPsaVariety(
        {
          variant: 'Base',
          description: 'Ditto 2025 Pokemon Korean Promo Metamong Project',
          name: 'Ditto',
          set: '2025 Pokemon Korean Promo',
          number: '173',
        },
        'METAMONG PROJECT STMP RLY',
      ),
    ).toBe(true);
    expect(
      cardhedgerCertRowUsableForPsaVariety(
        {
          variant: 'Base',
          description: 'Gengar Pokemon Japanese 151',
          name: 'Gengar',
          number: '094',
        },
        'MASTER BALL REVERSE HOLO',
      ),
    ).toBe(false);
  });

  it('accepts a cert Blue row when PSA only abbreviates the insert line', () => {
    expect(
      cardhedgerCertRowUsableForPsaVariety(
        {
          variant: 'Blue ',
          description:
            'Shai Gilgeous-Alexander 2021 Panini Recon Called To Excellence Signatures Basketball Blue',
          name: 'Shai Gilgeous-Alexander',
          set: '2021 Panini Recon Basketball',
          number: 'CES-SGA',
        },
        'CLLD/EXCLNC.SIG-BLUE',
      ),
    ).toBe(true);
  });

  it('accepts a cert Base row for Mega Festa when the catalog names the event', () => {
    expect(
      cardhedgerCertRowUsableForPsaVariety(
        {
          variant: 'Base',
          description: 'Magikarp 2026 Pokemon Korean Promo Mega Festa',
          name: 'Magikarp',
          set: '2026 Pokemon Korean Promo',
          number: '40',
        },
        'MEGA FESTA 2026',
      ),
    ).toBe(true);
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

  it('matches GemRate Prizms Silver cert row to PSA SILVER PRIZM (LaMelo #278)', () => {
    const certRow = {
      variant: 'Prizms Silver',
      description: 'LaMelo Ball 2020 Panini Prizm Basketball Silver',
      number: '278',
    };
    expect(cardhedgerRowMatchesPsaVariety(certRow, 'SILVER PRIZM')).toBe(true);
    expect(cardhedgerCertRowUsableForPsaVariety(certRow, 'SILVER PRIZM')).toBe(
      true,
    );
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

  it('maps PSA Manga Alternate Art to Cardhedger Manga, not Red Manga or Alternate Art', () => {
    const manga = {
      variant: 'Manga',
      description: 'Sabo 2025 One Piece Carrying On His Will Manga',
      name: 'Sabo',
      set: '2025 One Piece Carrying On His Will',
      number: 'OP13-120',
    };
    expect(cardhedgerRowMatchesPsaVariety(manga, 'MANGA ALTERNATE ART')).toBe(
      true,
    );
    expect(
      cardhedgerRowMatchesPsaVariety(
        { ...manga, variant: 'Red Manga' },
        'MANGA ALTERNATE ART',
      ),
    ).toBe(false);
    expect(
      cardhedgerRowMatchesPsaVariety(
        {
          ...manga,
          variant: 'Alternate Art',
          description: 'Sabo 2025 One Piece Carrying On His Will Alternate Art',
        },
        'MANGA ALTERNATE ART',
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

  it('rejects color-only Chrome row when PSA names color + Refractor (Pink vs Pink Refractor)', () => {
    const pinkOnly = {
      variant: 'Pink',
      description: 'Shohei Ohtani 2023 Topps Chrome Baseball Pink #17',
      name: 'Shohei Ohtani',
      number: '17',
    };
    const pinkRefractor = {
      variant: 'Pink Refractor',
      description:
        'Shohei Ohtani 2023 Topps Chrome Baseball Pink Refractor #17',
      name: 'Shohei Ohtani',
      number: '17',
    };
    expect(cardhedgerRowMatchesPsaVariety(pinkOnly, 'PINK REFRACTOR')).toBe(
      false,
    );
    expect(
      cardhedgerCertRowUsableForPsaVariety(pinkOnly, 'PINK REFRACTOR'),
    ).toBe(false);
    expect(
      cardhedgerRowMatchesPsaVariety(pinkRefractor, 'PINK REFRACTOR'),
    ).toBe(true);
    expect(
      cardhedgerCertRowRelaxedGemRateLink(pinkOnly, 'PINK REFRACTOR'),
    ).toBe(false);
  });

  it('requires PSA parallel tokens on the Cardhedger row (no Refractor omission)', () => {
    expect(
      cardhedgerRowMatchesPsaVariety(
        {
          variant: 'Pitching Green Wave',
          description: 'Shohei Ohtani 2018 Topps Chrome Baseball Pitching Green Wave',
        },
        'GREEN WAVE REFRACTOR',
      ),
    ).toBe(false);
    expect(
      cardhedgerRowMatchesPsaVariety(
        {
          variant: 'Pitching Green Wave',
          description:
            'Shohei Ohtani 2018 Topps Chrome Baseball Pitching Green Wave Refractor',
        },
        'GREEN WAVE REFRACTOR',
      ),
    ).toBe(true);
    expect(
      cardhedgerCertRowUsableForPsaVariety(
        {
          variant: 'Pitching Prism',
          description:
            'Shohei Ohtani 2018 Topps Chrome Baseball Pitching Prism Refractor',
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

describe('Pokemon Center Special Box SV-P — PSA SPECIAL BOX PC {city}', () => {
  const hiroshimaRow = {
    variant: 'Base',
    description:
      "Hiroshima's Pikachu 2025 Pokemon Japanese Scarlet & Violet Promos Special Box Pokemon Center Hiroshima",
    player: "Hiroshima's Pikachu",
    set: '2025 Pokemon Japanese Scarlet & Violet Promos',
    number: '261',
  };

  it('detects PSA Special Box PC lines', () => {
    expect(psaVarietyIsPokemonCenterSpecialBoxLine('SPECIAL BOX PC HIROSHIMA')).toBe(
      true,
    );
    expect(psaVarietyIsPokemonCenterSpecialBoxLine('PINK REFRACTOR')).toBe(
      false,
    );
  });

  it('accepts cert-linked Base row for Hiroshima via relaxed GemRate link', () => {
    expect(
      cardhedgerRowMatchesPsaVariety(hiroshimaRow, 'SPECIAL BOX PC HIROSHIMA'),
    ).toBe(false);
    expect(
      cardhedgerCertRowRelaxedGemRateLink(
        hiroshimaRow,
        'SPECIAL BOX PC HIROSHIMA',
      ),
    ).toBe(true);
    expect(
      cardhedgerCertRowUsableForPsaVariety(
        hiroshimaRow,
        'SPECIAL BOX PC HIROSHIMA',
      ),
    ).toBe(true);
  });

  it('rejects Base row when city does not match PSA Special Box line', () => {
    expect(
      cardhedgerCertRowRelaxedGemRateLink(
        hiroshimaRow,
        'SPECIAL BOX PC FUKUOKA',
      ),
    ).toBe(false);
  });

  it('accepts Tohoku Special Box PC (cert 152206685)', () => {
    const tohokuRow = {
      variant: 'Base',
      description:
        "Tohoku's Pikachu 2025 Pokemon Japanese Scarlet & Violet Promos Special Box Pokemon Center Tohoku",
      player: "Tohoku's Pikachu",
      number: '260',
    };
    expect(
      cardhedgerCertRowUsableForPsaVariety(tohokuRow, 'SPECIAL BOX PC TOHOKU'),
    ).toBe(true);
  });
});

describe('cardhedgerRowMatchesPsaVariety — Pokémon RGB Rare channel lines', () => {
  const mewRgbRed = {
    card_id: '1789712844142x754962610754496600',
    description: 'Mew 2026 Pokemon 30th Celebration Red',
    player: 'Mew',
    set: '2026 Pokemon 30th Celebration',
    number: 'R/RGB',
    variant: 'Red',
    category: 'Pokemon',
  };

  it('accepts Cardhedger Red + R/RGB for PSA RGB RARE (cert 178464163)', () => {
    expect(cardhedgerRowMatchesPsaVariety(mewRgbRed, 'RGB RARE')).toBe(true);
    expect(cardhedgerCertRowUsableForPsaVariety(mewRgbRed, 'RGB RARE')).toBe(
      true,
    );
  });

  it('rejects wrong RGB channel color for the same checklist letter', () => {
    expect(
      cardhedgerRowMatchesPsaVariety(
        { ...mewRgbRed, variant: 'Green' },
        'RGB RARE',
      ),
    ).toBe(false);
    expect(
      cardhedgerRowMatchesPsaVariety(
        { ...mewRgbRed, number: 'G/RGB', variant: 'Red' },
        'RGB RARE',
      ),
    ).toBe(false);
  });

  it('does not treat a plain Red sports parallel as RGB without R/RGB number', () => {
    expect(
      cardhedgerRowMatchesPsaVariety(
        {
          variant: 'Red',
          description: 'Ohtani Red Refractor',
          number: '150',
        },
        'RGB RARE',
      ),
    ).toBe(false);
  });
});

describe('compTitlesMissParallelTokenSeenOnSibling', () => {
  it('does not treat refractor as a second product on a Chrome color parallel', () => {
    expect(parallelTokensBeyondColor('PINK REFRACTOR')).toEqual([]);
    expect(parallelTokensBeyondColor('PINK')).toEqual([]);
    expect(parallelTokensBeyondColor('REFRACTOR')).toEqual(['refractor']);
  });

  it('does not treat a Pokemon rarity slot as a parallel token', () => {
    expect(parallelTokensBeyondColor('SPECIAL ART RARE')).toEqual([]);
    expect(
      compTitlesMissParallelTokenSeenOnSibling(
        'SPECIAL ART RARE',
        ['Mega Gengar ex 240 M2a: Mega Dream Ex Holo (Japanese) PSA 10'],
        [
          '2025 POKEMON JAPANESE MEGA DREAM EX SPECIAL ART RARE #240 MEGA GENGAR EX PSA 9',
        ],
      ),
    ).toBe(false);
  });

  it('keeps Chrome Pink PSA 10 titles on a Pink Refractor card', () => {
    expect(
      compTitlesMissParallelTokenSeenOnSibling(
        'PINK REFRACTOR',
        [
          '2023 Topps Chrome #17 Shohei Ohtani Pink PSA 10 Pop 16',
          'Shohei Ohtani 2023 Topps Chrome Pink #17 PSA 10 Angels Low Pop',
        ],
        ['2023 TOPPS CHROME PINK REFRACTOR #17 SHOHEI OHTANI PSA 9'],
      ),
    ).toBe(false);
  });

  it('keeps the grade when every grade omits the parallel word', () => {
    expect(
      compTitlesMissParallelTokenSeenOnSibling(
        'PINK REFRACTOR',
        ['Shohei Ohtani 2023 Topps Chrome Pink #17 PSA 10'],
        ['Shohei Ohtani 2023 Topps Chrome Pink #17 PSA 9'],
      ),
    ).toBe(false);
  });

  it('keeps the grade when its own titles include refractor', () => {
    expect(
      compTitlesMissParallelTokenSeenOnSibling(
        'PINK REFRACTOR',
        ['2023 Topps Chrome Pink Refractor #17 PSA 10'],
        ['2023 Topps Chrome Pink #17 PSA 9'],
      ),
    ).toBe(false);
  });

  it('treats X-Fractor and xfractor as the same parallel token', () => {
    expect(
      compTitlesMissParallelTokenSeenOnSibling(
        'X-FRACTOR',
        ['2018 Topps Chrome X-Fractor #150 Shohei Ohtani PSA 10'],
        ['2018 Topps Chrome SHOHEI OHTANI xfractor PSA 8'],
      ),
    ).toBe(false);
  });

  it('treats PSA STMP as the word stamp on Ditto Metamong titles', () => {
    expect(
      compTitlesMissParallelTokenSeenOnSibling(
        'METAMONG PROJECT STMP RLY',
        [
          '2025 Pokemon Korean Sv-P Promo Ditto #173 PSA 10',
          '2025 Pokemon Scarlet and Violet Promo Korean Metamong Project Stamp Rally Ditto #173 PSA 10',
        ],
        [
          '2025 Pokemon Korean SV-P Promo #173 Ditto Metamong Project STMP RLY MINT PSA 9',
        ],
      ),
    ).toBe(false);
  });
});
