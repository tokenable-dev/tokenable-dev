import { PlatformFeeWalletService } from './platform-fee-wallet.service';

describe('PlatformFeeWalletService', () => {
  function svc(env: Record<string, string | undefined>) {
    return new PlatformFeeWalletService(
      { get: (k: string) => env[k] } as never,
      {} as never,
    );
  }

  it('isConfigured requires both recipient and private key', () => {
    expect(svc({}).isConfigured()).toBe(false);
    expect(
      svc({
        PLATFORM_FEE_RECIPIENT: '0xAc5EBB0573Ca515741D8986a1bA1CDC178F46539',
      }).isConfigured(),
    ).toBe(false);
    expect(
      svc({
        PLATFORM_FEE_RECIPIENT: '0xAc5EBB0573Ca515741D8986a1bA1CDC178F46539',
        PLATFORM_FEE_PRIVATE_KEY: '0x' + '11'.repeat(32),
      }).isConfigured(),
    ).toBe(true);
  });
});
