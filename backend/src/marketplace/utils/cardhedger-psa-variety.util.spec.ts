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
});
