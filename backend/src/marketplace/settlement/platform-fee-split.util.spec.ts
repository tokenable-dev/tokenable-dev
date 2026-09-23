import {
  SELF_VAULT_PLATFORM_FEE_BPS_DEFAULT,
  splitGrossUsdcMicros,
} from './platform-fee-split.util';

describe('splitGrossUsdcMicros', () => {
  it('splits 10% partner fee on $100', () => {
    const gross = BigInt(100_000_000);
    const { sellerMicros, feeMicros } = splitGrossUsdcMicros(
      gross,
      SELF_VAULT_PLATFORM_FEE_BPS_DEFAULT,
    );
    expect(feeMicros).toBe(BigInt(10_000_000));
    expect(sellerMicros).toBe(BigInt(90_000_000));
  });

  it('splits 5% PSA fee on $100', () => {
    const gross = BigInt(100_000_000);
    const { sellerMicros, feeMicros } = splitGrossUsdcMicros(gross, 500);
    expect(feeMicros).toBe(BigInt(5_000_000));
    expect(sellerMicros).toBe(BigInt(95_000_000));
  });
});
