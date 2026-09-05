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
  });
});
