import { seaportOrderIsFullyFilled } from './seaport-order-status.util';

describe('seaportOrderIsFullyFilled', () => {
  it('returns true when filled equals size', () => {
    expect(
      seaportOrderIsFullyFilled({
        isValidated: true,
        isCancelled: false,
        totalFilled: 1n,
        totalSize: 1n,
      }),
    ).toBe(true);
  });

  it('returns false when cancelled or size is zero', () => {
    expect(
      seaportOrderIsFullyFilled({
        isValidated: true,
        isCancelled: true,
        totalFilled: 1n,
        totalSize: 1n,
      }),
    ).toBe(false);
    expect(
      seaportOrderIsFullyFilled({
        isValidated: true,
        isCancelled: false,
        totalFilled: 0n,
        totalSize: 0n,
      }),
    ).toBe(false);
  });
});
