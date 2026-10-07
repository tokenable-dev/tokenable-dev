import { CardhedgerMetricsService } from './cardhedger-metrics.service';

describe('CardhedgerMetricsService upstream', () => {
  let metrics: CardhedgerMetricsService;

  beforeEach(() => {
    metrics = new CardhedgerMetricsService();
    metrics.onModuleDestroy();
  });

  afterEach(() => {
    metrics.onModuleDestroy();
  });

  it('aggregates per-endpoint success/error and operation tags', () => {
    metrics.recordUpstreamCall({
      upstreamPath: '/v1/cards/card-fmv',
      method: 'POST',
      outcome: 'success',
      durationMs: 120,
      operation: 'mint_previews',
    });
    metrics.recordUpstreamCall({
      upstreamPath: '/v1/cards/card-fmv-batch',
      method: 'POST',
      outcome: 'success',
      durationMs: 80,
      operation: 'mint_previews',
    });
    metrics.recordUpstreamCall({
      upstreamPath: '/v1/cards/details-by-certs',
      method: 'POST',
      outcome: 'error',
      durationMs: 40,
    });

    const snap = metrics.getSnapshot();
    expect(snap.upstream.total).toBe(3);
    expect(snap.upstream.success).toBe(2);
    expect(snap.upstream.errors).toBe(1);
    expect(snap.upstream.byEndpoint['card-fmv']?.success).toBe(1);
    expect(snap.upstream.byEndpoint['card-fmv-batch']?.success).toBe(1);
    expect(snap.upstream.byEndpoint['details-by-certs']?.error).toBe(1);
    expect(snap.upstream.byOperation.mint_previews).toBe(2);
  });
});
