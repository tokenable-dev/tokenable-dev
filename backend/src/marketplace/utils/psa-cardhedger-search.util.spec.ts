import { orderedPsaCardhedgerSearchQueries } from './psa-cardhedger-search.util';

describe('orderedPsaCardhedgerSearchQueries', () => {
  it('puts PSA Variety before GemRate cert description', () => {
    const queries = orderedPsaCardhedgerSearchQueries(
      {
        psaSubject: 'SHOHEI OHTANI',
        psaBrand: 'TOPPS CHROME',
        psaYear: '2023',
        cardNumber: '17',
        psaVariety: 'PINK REFRACTOR',
      },
      {
        certDescription: '2023 Topps Chrome Shohei Ohtani Pink #17',
      },
    );
    expect(queries.length).toBeGreaterThan(1);
    const varietyIdx = queries.findIndex((q) =>
      /pink\s+refractor/i.test(q),
    );
    const certIdx = queries.findIndex((q) =>
      q.includes('Pink #17'),
    );
    expect(varietyIdx).toBeGreaterThanOrEqual(0);
    expect(certIdx).toBeGreaterThanOrEqual(0);
    expect(varietyIdx).toBeLessThan(certIdx);
  });
});
