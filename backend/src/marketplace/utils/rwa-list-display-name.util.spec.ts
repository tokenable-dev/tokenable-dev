import {
  listReadyDisplayNameFromGradedMetadata,
  resolveRegistryDisplayName,
} from './rwa-list-display-name.util';

describe('rwa-list-display-name.util', () => {
  const gradedMeta = {
    name: 'MONKEY D. LUFFY',
    properties: {
      graded: {
        card: { name: 'MONKEY D. LUFFY', number: '118' },
        grade: { score: 10 },
        psa: {
          subject: 'MONKEY D. LUFFY',
          cardNumberHint: '118',
          gradeScore: 10,
          gradeLabel: 'GEM MT 10',
        },
      },
    },
  };

  it('builds Line 1 from graded fields even when IPFS name is bare', () => {
    expect(listReadyDisplayNameFromGradedMetadata(gradedMeta)).toBe(
      'MONKEY D. LUFFY · #118 · PSA 10',
    );
    expect(resolveRegistryDisplayName(gradedMeta)).toBe(
      'MONKEY D. LUFFY · #118 · PSA 10',
    );
  });

  it('falls back to stripped metadata.name when graded is missing', () => {
    expect(
      resolveRegistryDisplayName({ name: 'KOBE BRYANT · Raw' }),
    ).toBe('KOBE BRYANT');
  });
});
