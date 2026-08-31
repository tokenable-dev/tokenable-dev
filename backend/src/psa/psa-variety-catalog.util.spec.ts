import {
  marketParallelKeyFromPsaVariety,
} from '../marketplace/utils/market-parallel-key.util';
import {
  psaVarietyIndicatesGenericBaseLine,
  psaVarietyIsBrandOrSetDuplicate,
} from './psa-variety-catalog.util';

describe('psaVarietyIsBrandOrSetDuplicate', () => {
  const brand =
    'POKEMON JAPANESE SWORD & SHIELD VSTAR UNIVERSE';

  it('treats expansion-name Variety as a Brand duplicate', () => {
    expect(psaVarietyIsBrandOrSetDuplicate('VSTAR UNIVERSE', brand)).toBe(true);
    expect(psaVarietyIndicatesGenericBaseLine('VSTAR UNIVERSE', brand)).toBe(
      true,
    );
    expect(marketParallelKeyFromPsaVariety('VSTAR UNIVERSE', brand)).toBe(
      'base',
    );
  });

  it('does not collapse real sports parallels that share a product word', () => {
    expect(
      psaVarietyIsBrandOrSetDuplicate('SILVER PRIZM', 'PANINI PRIZM'),
    ).toBe(false);
    expect(
      psaVarietyIndicatesGenericBaseLine('SILVER PRIZM', 'PANINI PRIZM'),
    ).toBe(false);
    expect(
      marketParallelKeyFromPsaVariety('SILVER PRIZM', 'PANINI PRIZM'),
    ).toBe('silver_prizm');
  });

  it('does not treat short color tokens as set-name duplicates', () => {
    expect(psaVarietyIsBrandOrSetDuplicate('RED', 'PANINI PRIZM RED')).toBe(
      false,
    );
    expect(psaVarietyIsBrandOrSetDuplicate('GOLD', 'GOLDEN TICKET')).toBe(
      false,
    );
  });
});

describe('psaVarietyIsPokemonRarityLabel — Special Art Rare (SAR)', () => {
  it('treats SPECIAL ART RARE as a Base catalog slot, not a parallel', () => {
    expect(psaVarietyIndicatesGenericBaseLine('SPECIAL ART RARE')).toBe(true);
    expect(marketParallelKeyFromPsaVariety('SPECIAL ART RARE')).toBe('base');
    expect(psaVarietyIndicatesGenericBaseLine('SAR')).toBe(true);
    expect(marketParallelKeyFromPsaVariety('SAR')).toBe('base');
  });

  it('does not collapse named art parallels into SAR', () => {
    expect(
      psaVarietyIndicatesGenericBaseLine('RED MANGA ALTERNATE ART'),
    ).toBe(false);
    expect(
      marketParallelKeyFromPsaVariety('RED MANGA ALTERNATE ART'),
    ).toBe('red_manga_alternate_art');
  });
});

describe('psaVarietyIsPokemonRarityLabel — Mega Ultra Rare', () => {
  it('treats MEGA ULTRA RARE as a Base catalog slot, not a parallel', () => {
    expect(psaVarietyIndicatesGenericBaseLine('MEGA ULTRA RARE')).toBe(true);
    expect(marketParallelKeyFromPsaVariety('MEGA ULTRA RARE')).toBe('base');
    expect(psaVarietyIndicatesGenericBaseLine('MUR')).toBe(true);
    expect(psaVarietyIndicatesGenericBaseLine('MEGA HYPER RARE')).toBe(true);
  });
});

describe('psaVarietyIsPokemonRarityLabel — PSA rarity/subject compound lines', () => {
  it('treats FULL ART/… as Full Art (Base), not a named parallel', () => {
    const variety = 'FULL ART/UMBREON VMAX-HYPER';
    expect(psaVarietyIndicatesGenericBaseLine(variety)).toBe(true);
    expect(marketParallelKeyFromPsaVariety(variety)).toBe('base');
    expect(psaVarietyIndicatesGenericBaseLine('FULL ART')).toBe(true);
  });

  it('treats expansion-name + -HYPER leftover as Hyper Rare (Base), not a parallel', () => {
    const brand = 'POKEMON JAPANESE SWORD & SHIELD EEVEE HEROES';
    expect(
      psaVarietyIndicatesGenericBaseLine('EEVEE HEROES-HYPER', brand),
    ).toBe(true);
    expect(marketParallelKeyFromPsaVariety('EEVEE HEROES-HYPER', brand)).toBe(
      'base',
    );
  });

  it('does not treat Master Ball or sports inserts as rarity slots', () => {
    expect(
      psaVarietyIndicatesGenericBaseLine('MASTER BALL REVERSE HOLO'),
    ).toBe(false);
    expect(psaVarietyIndicatesGenericBaseLine('SILVER PRIZM')).toBe(false);
  });
});
