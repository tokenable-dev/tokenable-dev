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
