import {
  cardhedgerUpstreamEndpointSlug,
  normalizeCardhedgerUpstreamPath,
} from './cardhedger-upstream.util';

describe('normalizeCardhedgerUpstreamPath', () => {
  it('strips leading slash', () => {
    expect(normalizeCardhedgerUpstreamPath('/v1/cards/card-fmv')).toBe(
      'v1/cards/card-fmv',
    );
  });

  it('collapses dynamic issue id', () => {
    expect(normalizeCardhedgerUpstreamPath('/v1/cards/issues/abc-123')).toBe(
      'v1/cards/issues/{issue_id}',
    );
  });

  it('collapses daily export date', () => {
    expect(
      normalizeCardhedgerUpstreamPath(
        '/v1/download/daily-price-export/2026-06-17',
      ),
    ).toBe('v1/download/daily-price-export/{file_date}');
  });
});

describe('cardhedgerUpstreamEndpointSlug', () => {
  it('returns short endpoint name for cards routes', () => {
    expect(cardhedgerUpstreamEndpointSlug('v1/cards/card-fmv-batch')).toBe(
      'card-fmv-batch',
    );
  });
});
