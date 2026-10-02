import {
  compactPsaCertFromApiRaw,
  psaEstimateUsdFromCompact,
} from './psa-cert-compact.util';

describe('psa-cert-compact.util', () => {
  it('builds compact fields from GetByCertNumber body', () => {
    const compact = compactPsaCertFromApiRaw({
      PSACert: {
        CertNumber: '12345678',
        SpecID: 42,
        Subject: 'Charizard',
        Brand: 'Pokemon',
        Variety: 'Holo',
        CardGrade: '10',
      },
      Estimate: '$1,250',
    });
    expect(compact).toMatchObject({
      CertNumber: '12345678',
      SpecID: 42,
      Subject: 'Charizard',
      Brand: 'Pokemon',
      Variety: 'Holo',
      CardGrade: '10',
      EstimateUsd: 1250,
    });
  });

  it('reads estimate USD from compact snapshot', () => {
    expect(psaEstimateUsdFromCompact({ EstimateUsd: 99.5 })).toBe(99.5);
    expect(psaEstimateUsdFromCompact({ EstimateUsd: '$2,500' })).toBe(2500);
    expect(psaEstimateUsdFromCompact(null)).toBeNull();
  });
});
