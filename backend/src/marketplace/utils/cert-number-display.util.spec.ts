import {
  maskPsaCertNumberForPublicApi,
  redactRwaMetadataCertForPublic,
} from './cert-number-display.util';

describe('maskPsaCertNumberForPublicApi', () => {
  it('formats masked public cert', () => {
    expect(maskPsaCertNumberForPublicApi('12563749')).toBe('#****3749');
    expect(maskPsaCertNumberForPublicApi('PSA 12563749')).toBe('#****3749');
  });

  it('returns null for missing or too-short cert', () => {
    expect(maskPsaCertNumberForPublicApi(null)).toBeNull();
    expect(maskPsaCertNumberForPublicApi('123')).toBeNull();
    expect(maskPsaCertNumberForPublicApi('')).toBeNull();
  });
});

describe('redactRwaMetadataCertForPublic', () => {
  it('masks graded.psa.certNumber and strips verify URLs', () => {
    const meta = {
      properties: {
        graded: {
          psa: {
            certNumber: '83179580',
            certVerifyUrl: 'https://www.psacard.com/cert/83179580',
          },
          verification: { certUrl: 'https://www.psacard.com/cert/83179580' },
        },
      },
    };
    const out = redactRwaMetadataCertForPublic(meta)!;
    const psa = (out.properties as Record<string, unknown>).graded as Record<
      string,
      unknown
    >;
    const psaObj = psa.psa as Record<string, unknown>;
    expect(psaObj.certNumber).toBe('#****9580');
    expect(psaObj.certVerifyUrl).toBeUndefined();
  });
});
