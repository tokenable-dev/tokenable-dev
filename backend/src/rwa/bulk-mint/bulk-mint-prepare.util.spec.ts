import { buildBulkMintMetadataFromPsaCert } from './bulk-mint-prepare.util';
import type { PsaCertRecord } from '../../psa/psa-public-api.service';

describe('buildBulkMintMetadataFromPsaCert', () => {
  it('builds name and graded properties from PSACert', () => {
    const psaCert: PsaCertRecord = {
      CertNumber: '83179580',
      Subject: 'Charizard',
      Year: '1999',
      Brand: 'Pokemon',
      CardGrade: '10',
      GradeDescription: 'GEM MT 10',
      SpecID: 123,
    };
    const { name, metadata } = buildBulkMintMetadataFromPsaCert({
      certNumber: '83179580',
      psaCert,
      imageUrl: 'https://example.com/front.jpg',
    });
    expect(name).toContain('Charizard');
    expect(metadata.image).toBe('https://example.com/front.jpg');
    const graded = metadata.properties?.graded as Record<string, unknown>;
    expect(graded.gradingCompany).toBe('PSA');
    expect(graded.gradeScore).toBe(10);
    const psa = graded.psa as Record<string, unknown>;
    expect(psa.certNumber).toBe('83179580');
    expect(graded.normalized).toEqual({
      pokemon: {
        game: 'pokemon',
        cardName: 'Charizard',
      },
    });
  });

  it('attaches graded.normalized.pokemon for JP 151 / SV2a', () => {
    const psaCert: PsaCertRecord = {
      CertNumber: '10000001',
      Subject: 'Gengar',
      Brand: 'POKEMON JAPANESE SV2a-POKEMON CARD 151',
      CardNumber: '094',
      Variety: 'REVERSE HOLO',
      CardGrade: '10',
      Category: 'Pokemon',
    };
    const { metadata } = buildBulkMintMetadataFromPsaCert({
      certNumber: '10000001',
      psaCert,
      imageUrl: 'https://example.com/front.jpg',
    });
    const graded = metadata.properties?.graded as Record<string, unknown>;
    expect(graded.card).toMatchObject({
      set: 'POKEMON JAPANESE SV2a-POKEMON CARD 151',
      number: '094',
    });
    expect(graded.normalized).toEqual({
      language: 'JP',
      pokemon: {
        game: 'pokemon',
        language: 'JP',
        series: 'Scarlet & Violet',
        setName: 'Pokémon Card 151',
        setCode: 'SV2a',
        cardName: 'Gengar',
        cardNumber: '094',
        variant: 'Reverse Holo',
        setKind: 'expansion',
      },
    });
  });
});
