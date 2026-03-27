import {
  extractCardNumber,
  extractCertNumber,
  extractGrade,
  parsePsaLabelFromOcr,
  resolveCertHintForLookup,
} from './psa-ocr.util';

describe('psa-ocr.util — slab label heuristics', () => {
  it('extractGrade: MINT and 9 on separate lines', () => {
    const g = extractGrade('2023 POKEMON\nMINT\n9\n83179580');
    expect(g.label).toBe('MINT 9');
    expect(g.score).toBe(9);
  });

  it('parsePsaLabelFromOcr: Pikachu Van Gogh style label', () => {
    const text = `
2023 POKEMON SVP EN
PIKACHU/GREY FELT HAT
POKEMON X VAN GOGH
#085
MINT
9
83179580
`;
    const p = parsePsaLabelFromOcr(text);
    expect(p.year).toBe('2023');
    expect(p.gradeLabel).toBe('MINT 9');
    expect(p.gradeScore).toBe(9);
    expect(p.certNumber).toBe('83179580');
    expect(p.cardNameHint).toContain('PIKACHU');
    expect(p.cardNameHint).toContain('GREY');
    expect(p.setHint).toBe('Pokemon x Van Gogh');
    expect(p.cardNumberHint).toBe('085');
  });

  it('extractCardNumber: #085 on label', () => {
    expect(extractCardNumber('foo #085 bar')).toBe('085');
  });

  it('extractCertNumber: spaced digits and long barcode tail', () => {
    expect(extractCertNumber('Cert 8 3 1 7 9 5 8 0')).toBe('83179580');
    expect(extractCertNumber('831 795 80')).toBe('83179580');
    expect(
      extractCertNumber('1234567890123456783189580'),
    ).toBe('83189580');
  });

  it('resolveCertHintForLookup: digits and psacard URL', () => {
    expect(resolveCertHintForLookup('83179580')).toBe('83179580');
    expect(
      resolveCertHintForLookup('https://www.psacard.com/cert/83179580'),
    ).toBe('83179580');
    expect(resolveCertHintForLookup('')).toBeUndefined();
  });
});
