import {
  computeMarketBucketKey,
  extractBucketComponentsFromMetadata,
  extractOrDiagnoseBucketComponents,
} from './bucket-key.util';

describe('bucket-key.util', () => {
  it('extracts components from properties.graded', () => {
    const meta = {
      properties: {
        graded: {
          gradingCompany: 'PSA',
          card: { name: 'Pikachu', set: 'Van Gogh' },
          grade: { score: 10 },
        },
      },
    };
    const c = extractBucketComponentsFromMetadata(meta);
    expect(c).toEqual({
      gradingCompany: 'psa',
      cardName: 'pikachu',
      cardSet: 'van gogh',
      gradeScore: '10',
    });
  });

  it('includes optional cardNumber from card.number or psa.cardNumberHint', () => {
    const meta = {
      properties: {
        graded: {
          gradingCompany: 'PSA',
          card: { name: 'Mewtwo VSTAR', set: 'Pokemon GO', number: '086/078' },
          grade: { score: 10 },
        },
      },
    };
    const c = extractBucketComponentsFromMetadata(meta);
    expect(c?.cardNumber).toBe('086/078');
  });

  it('computes deterministic 64-char hex key', () => {
    const c = {
      gradingCompany: 'psa',
      cardName: 'pikachu',
      cardSet: 'van gogh',
      gradeScore: '10',
    };
    const k = computeMarketBucketKey(c);
    expect(k).toMatch(/^[0-9a-f]{64}$/);
    expect(computeMarketBucketKey(c)).toBe(k);
  });

  it('returns null without graded block', () => {
    expect(extractBucketComponentsFromMetadata({ name: 'x' })).toBeNull();
  });

  it('diagnose: no_graded_object when graded missing', () => {
    const r = extractOrDiagnoseBucketComponents({ name: 'x' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('no_graded_object');
      expect(r.gradedSource).toBe('none');
    }
  });

  it('diagnose: prefers properties.graded over root when both exist', () => {
    const r = extractOrDiagnoseBucketComponents({
      graded: { gradingCompany: 'X', card: { name: 'Root' }, grade: { score: 10 } },
      properties: {
        graded: {
          gradingCompany: 'PSA',
          card: { name: 'Props' },
          grade: { score: 10 },
        },
      },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.gradedSource).toBe('properties.graded');
  });

  it('diagnose: missing_grade_score when score fields empty', () => {
    const r = extractOrDiagnoseBucketComponents({
      properties: {
        graded: {
          gradingCompany: 'PSA',
          card: { name: 'Pikachu' },
          grade: {},
        },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('missing_grade_score');
  });

  it('extracts psaTotalPopulation when psa.totalPopulation is set', () => {
    const meta = {
      properties: {
        graded: {
          gradingCompany: 'PSA',
          card: { name: 'Charizard', set: 'Base' },
          grade: { score: 10 },
          psa: { totalPopulation: 125 },
        },
      },
    };
    const c = extractBucketComponentsFromMetadata(meta);
    expect(c?.psaTotalPopulation).toBe(125);
  });
});
