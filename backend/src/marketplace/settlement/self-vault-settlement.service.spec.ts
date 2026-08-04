import { SelfVaultSettlementService } from './self-vault-settlement.service';

describe('SelfVaultSettlementService.computeSellerPayoutMicros', () => {
  function svc(bps: string) {
    return new SelfVaultSettlementService(
      {} as never,
      { get: () => bps } as never,
    );
  }

  it('applies 5% platform fee to gross micros', () => {
    expect(svc('500').computeSellerPayoutMicros('1000000')).toBe('950000');
  });

  it('handles zero fee bps', () => {
    expect(svc('0').computeSellerPayoutMicros('1000000')).toBe('1000000');
  });
});
