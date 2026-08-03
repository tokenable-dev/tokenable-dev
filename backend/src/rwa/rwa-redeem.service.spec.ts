import { ConfigService } from '@nestjs/config';
import { RwaRedeemService } from './rwa-redeem.service';

describe('RwaRedeemService.estimateRedeemCost', () => {
  function makeService(envFee?: string) {
    const config = {
      get: (key: string) =>
        key === 'PSA_VAULT_WITHDRAW_FEE_USD' ? envFee : undefined,
    } as ConfigService;
    return new RwaRedeemService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      config,
    );
  }

  it('uses PSA shipping by country + default withdraw fee', () => {
    const est = makeService().estimateRedeemCost('us', 2);
    expect(est.shippingUsd).toBe(5.99);
    expect(est.withdrawFeePerCardUsd).toBe(4.99);
    expect(est.withdrawFeeTotalUsd).toBe(9.98);
    expect(est.totalUsd).toBe(15.97);
    expect(est.source).toBe('psa_vault_published_schedule');
  });

  it('honors PSA_VAULT_WITHDRAW_FEE_USD override', () => {
    const est = makeService('1.99').estimateRedeemCost('ca', 1);
    expect(est.shippingUsd).toBe(24.99);
    expect(est.withdrawFeePerCardUsd).toBe(1.99);
    expect(est.totalUsd).toBe(26.98);
  });
});
