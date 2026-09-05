import {
  SELF_VAULT_AUTO_PAYOUT_DELAY_SECONDS_DEFAULT,
  SelfVaultSettlementService,
} from './self-vault-settlement.service';

describe('SelfVaultSettlementService.computeSellerPayoutMicros', () => {
  function svc(bps: string) {
    return new SelfVaultSettlementService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { get: () => bps } as never,
      {} as never,
      { isConfigured: () => false } as never,
      { notifySellerPayoutDone: jest.fn() } as never,
    );
  }

  it('applies 5% platform fee to gross micros', () => {
    expect(svc('500').computeSellerPayoutMicros('1000000')).toBe('950000');
  });

  it('handles zero fee bps', () => {
    expect(svc('0').computeSellerPayoutMicros('1000000')).toBe('1000000');
  });
});

describe('SelfVaultSettlementService.autoPayoutDelaySeconds', () => {
  function svc(env: Record<string, string | undefined>) {
    return new SelfVaultSettlementService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { get: (k: string) => env[k] } as never,
      {} as never,
      { isConfigured: () => false } as never,
      { notifySellerPayoutDone: jest.fn() } as never,
    );
  }

  it('defaults to 300 seconds (5 minutes)', () => {
    expect(svc({}).autoPayoutDelaySeconds()).toBe(
      SELF_VAULT_AUTO_PAYOUT_DELAY_SECONDS_DEFAULT,
    );
  });

  it('reads SELF_VAULT_AUTO_PAYOUT_DELAY_SECONDS', () => {
    expect(
      svc({ SELF_VAULT_AUTO_PAYOUT_DELAY_SECONDS: '120' }).autoPayoutDelaySeconds(),
    ).toBe(120);
  });

  it('falls back on invalid values', () => {
    expect(
      svc({ SELF_VAULT_AUTO_PAYOUT_DELAY_SECONDS: 'nope' }).autoPayoutDelaySeconds(),
    ).toBe(SELF_VAULT_AUTO_PAYOUT_DELAY_SECONDS_DEFAULT);
  });
});

describe('SelfVaultSettlementService.executePayout', () => {
  it('auto-confirms pending_confirm then pays', async () => {
    const row = {
      id: 's1',
      status: 'pending_confirm',
      sellerWallet: '0xabc',
      sellerPayoutUsdc: '950000',
      tokenId: '42',
      orderHash: '0xorder',
      chainId: 11155111,
      confirmedAt: null as Date | null,
      payoutTxHash: null as string | null,
      paidAt: null as Date | null,
    };
    const repo = {
      findOne: jest.fn().mockResolvedValue(row),
      save: jest.fn(async (r: typeof row) => r),
    };
    const platformFeeWallet = {
      isConfigured: () => true,
      transferUsdc: jest.fn().mockResolvedValue({ txHash: '0x' + 'ab'.repeat(32) }),
    };
    const svc = new SelfVaultSettlementService(
      repo as never,
      {} as never,
      {} as never,
      {} as never,
      { get: () => undefined } as never,
      {} as never,
      platformFeeWallet as never,
      { notifySellerPayoutDone: jest.fn().mockResolvedValue(undefined) } as never,
    );

    const out = await svc.executePayout('s1');
    expect(platformFeeWallet.transferUsdc).toHaveBeenCalledWith({
      to: '0xabc',
      amountMicros: '950000',
      chainId: 11155111,
    });
    expect(out.status).toBe('paid');
    expect(out.confirmedAt).toBeInstanceOf(Date);
    expect(out.payoutTxHash).toMatch(/^0x/);
  });

  it('no-ops when already paid', async () => {
    const row = { id: 's1', status: 'paid' };
    const repo = {
      findOne: jest.fn().mockResolvedValue(row),
      save: jest.fn(),
    };
    const platformFeeWallet = {
      isConfigured: () => true,
      transferUsdc: jest.fn(),
    };
    const svc = new SelfVaultSettlementService(
      repo as never,
      {} as never,
      {} as never,
      {} as never,
      { get: () => undefined } as never,
      {} as never,
      platformFeeWallet as never,
      { notifySellerPayoutDone: jest.fn() } as never,
    );

    await expect(svc.executePayout('s1')).resolves.toBe(row);
    expect(platformFeeWallet.transferUsdc).not.toHaveBeenCalled();
  });
});

describe('SelfVaultSettlementService.autoPayoutCron', () => {
  it('skips when cron disabled', async () => {
    const repo = { find: jest.fn() };
    const svc = new SelfVaultSettlementService(
      repo as never,
      {} as never,
      {} as never,
      {} as never,
      {
        get: (k: string) =>
          k === 'SELF_VAULT_AUTO_PAYOUT_CRON' ? '0' : undefined,
      } as never,
      {} as never,
      { isConfigured: () => true } as never,
      { notifySellerPayoutDone: jest.fn() } as never,
    );

    await svc.autoPayoutCron();
    expect(repo.find).not.toHaveBeenCalled();
  });

  it('pays due pending settlements', async () => {
    const due = [{ id: 'due-1', tokenId: '9' }];
    const repo = {
      find: jest.fn().mockResolvedValue(due),
      findOne: jest.fn(),
      save: jest.fn(),
    };
    const svc = new SelfVaultSettlementService(
      repo as never,
      {} as never,
      {} as never,
      {} as never,
      {
        get: (k: string) =>
          k === 'SELF_VAULT_AUTO_PAYOUT_DELAY_SECONDS' ? '300' : undefined,
      } as never,
      {} as never,
      { isConfigured: () => true } as never,
      { notifySellerPayoutDone: jest.fn() } as never,
    );
    const pay = jest
      .spyOn(svc, 'executePayout')
      .mockResolvedValue({ id: 'due-1', status: 'paid' } as never);

    await svc.autoPayoutCron();
    expect(repo.find).toHaveBeenCalled();
    expect(pay).toHaveBeenCalledWith('due-1');
  });
});

describe('SelfVaultSettlementService.createFromFulfilledAsk (resale)', () => {
  const FEE = '0x1111111111111111111111111111111111111111';
  const SELLER_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const SELLER_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const BUYER_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const BUYER_C = '0xcccccccccccccccccccccccccccccccccccccccc';

  function askShape(orderHash: string, offerer: string, tokenId: string) {
    return {
      orderHash,
      tokenContract: '0xcccccccccccccccccccccccccccccccccccccccc',
      tokenId,
      offerer,
      considerationAmount: '1000000',
      parameters: {
        consideration: [
          {
            itemType: 1,
            recipient: FEE,
            startAmount: '1000000',
          },
        ],
      },
    };
  }

  it('creates a separate ledger row per fulfilled ask (same token resale)', async () => {
    const saved: Array<{ orderHash: string; sellerWallet: string }> = [];
    const repo = {
      findOne: jest.fn(async ({ where }: { where: { orderHash: string } }) =>
        saved.find((r) => r.orderHash === where.orderHash) ?? null,
      ),
      create: jest.fn((partial: Record<string, unknown>) => partial),
      save: jest.fn(async (row: { orderHash: string; sellerWallet: string }) => {
        const out = { ...row, id: `id-${saved.length + 1}` };
        saved.push(out);
        return out;
      }),
    };
    const svc = new SelfVaultSettlementService(
      repo as never,
      {} as never,
      {} as never,
      {} as never,
      {
        get: (k: string) =>
          k === 'PLATFORM_FEE_RECIPIENT'
            ? FEE
            : k === 'PLATFORM_FEE_BPS'
              ? '500'
              : undefined,
      } as never,
      {} as never,
      { isConfigured: () => false } as never,
      { notifySellerPayoutDone: jest.fn() } as never,
    );

    const first = await svc.createFromFulfilledAsk({
      ask: askShape('0xask1', SELLER_A, '42') as never,
      buyerWallet: BUYER_B,
      chainId: 11155111,
    });
    const second = await svc.createFromFulfilledAsk({
      ask: askShape('0xask2', SELLER_B, '42') as never,
      buyerWallet: BUYER_C,
      chainId: 11155111,
    });

    expect(first?.orderHash).toBe('0xask1');
    expect(second?.orderHash).toBe('0xask2');
    expect(first?.id).not.toBe(second?.id);
    expect(saved).toHaveLength(2);
    expect(svc.isFullPlatformTakeAsk(askShape('0xask1', SELLER_A, '42') as never)).toBe(
      true,
    );
  });

  it('listByStatus open queries pending_confirm and confirmed only', async () => {
    const repo = {
      find: jest.fn().mockResolvedValue([]),
    };
    const svc = new SelfVaultSettlementService(
      repo as never,
      {} as never,
      {} as never,
      {} as never,
      { get: () => undefined } as never,
      {} as never,
      { isConfigured: () => false } as never,
      { notifySellerPayoutDone: jest.fn() } as never,
    );

    await svc.listByStatus('open', 11155111);
    expect(repo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: [
          { chainId: 11155111, status: 'pending_confirm' },
          { chainId: 11155111, status: 'confirmed' },
        ],
      }),
    );
  });
});
