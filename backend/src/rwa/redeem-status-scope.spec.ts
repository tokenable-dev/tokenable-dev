import { scopeRedeemStatusRows } from '@/lib/portfolio/redeemDraft';

function row(
  tokenId: string,
  batch: string,
  status: string,
  trackingNumber: string | null,
) {
  return { tokenId, paymentBatchId: batch, status, trackingNumber };
}

describe('scopeRedeemStatusRows', () => {
  const luffy = row('34', 'batch-luffy', 'in_custody', null);
  const toge = row('15', 'batch-toge', 'in_custody', '456456456456456');
  const done = row('22', 'batch-done', 'completed', '34489293482992');

  it('keeps the batch in the URL when an older shipment already has tracking', () => {
    const scoped = scopeRedeemStatusRows({
      view: 'preparing',
      rows: [luffy, toge, done],
      batchId: 'batch-luffy',
    });
    expect(scoped.view).toBe('preparing');
    expect(scoped.rows.map((r) => r.tokenId)).toEqual(['34']);
  });

  it('does not let a completed tracked batch steal the open transit screen', () => {
    const scoped = scopeRedeemStatusRows({
      view: 'transit',
      rows: [luffy, toge, done],
      batchId: null,
    });
    expect(scoped.view).toBe('transit');
    expect(scoped.rows.map((r) => r.tokenId)).toEqual(['15']);
  });

  it('keeps preparing cards that share the tracked batch', () => {
    const sibling = row('35', 'batch-toge', 'in_custody', null);
    const scoped = scopeRedeemStatusRows({
      view: 'transit',
      rows: [luffy, toge, sibling],
      batchId: 'batch-toge',
    });
    expect(scoped.view).toBe('transit');
    expect(scoped.rows.map((r) => r.tokenId)).toEqual(['15', '35']);
  });

  it('scopes a finished screen to the completed batch in the URL', () => {
    const scoped = scopeRedeemStatusRows({
      view: 'done',
      rows: [luffy, toge, done],
      batchId: 'batch-done',
    });
    expect(scoped.view).toBe('done');
    expect(scoped.rows.map((r) => r.tokenId)).toEqual(['22']);
  });
});
