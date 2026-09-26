import { OrderStatus } from '../../marketplace/entities/order.entity';

/** Mirrors BulkMintJobService saleStatus derivation for unit coverage. */
function deriveSaleStatus(params: {
  itemStatus: string;
  orderStatus?: OrderStatus | null;
}): 'listed' | 'sold' | 'cancelled' | 'expired' | 'none' {
  if (params.orderStatus === OrderStatus.FULFILLED) return 'sold';
  if (params.orderStatus === OrderStatus.ACTIVE) return 'listed';
  if (params.orderStatus === OrderStatus.CANCELLED) return 'cancelled';
  if (params.orderStatus === OrderStatus.EXPIRED) return 'expired';
  if (params.itemStatus === 'listed') return 'listed';
  return 'none';
}

describe('bulk mint saleStatus derivation', () => {
  it('maps fulfilled order to sold', () => {
    expect(
      deriveSaleStatus({
        itemStatus: 'listed',
        orderStatus: OrderStatus.FULFILLED,
      }),
    ).toBe('sold');
  });

  it('maps active order to listed', () => {
    expect(
      deriveSaleStatus({
        itemStatus: 'listed',
        orderStatus: OrderStatus.ACTIVE,
      }),
    ).toBe('listed');
  });

  it('falls back to listed when item says listed without order row', () => {
    expect(deriveSaleStatus({ itemStatus: 'listed' })).toBe('listed');
  });

  it('returns none for minted without order', () => {
    expect(deriveSaleStatus({ itemStatus: 'minted' })).toBe('none');
  });
});
