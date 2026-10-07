import { ConfigService } from '@nestjs/config';
import { isPsaEarlyWithdrawal } from './psa-vault-fee.schedule';
import { RwaRedeemService } from './rwa-redeem.service';
import { RedeemShippingFeeCalculator } from './redeem-shipping-fee.calculator';
import { FedExRateClient } from './shipping/fedex-rate.client';

describe('RwaRedeemService fees (multi-shipment)', () => {
  function makeService(env: Record<string, string | undefined> = {}) {
    const config = {
      get: (key: string) => env[key],
    } as ConfigService;
    const platformFee = {
      getConfiguredRecipient: () =>
        '0xac5ebb0573ca515741d8986a1ba1cdc178f46539',
    };
    const chainConfig = {
      getRwaAddress: () => '0xrwa',
    };
    const vault = {
      getVaultCustodyRows: jest.fn().mockImplementation(
        (_contract: string, tokenIds: string[]) =>
          Promise.resolve(
            tokenIds.map((tokenId) => ({
              tokenId: String(tokenId),
              settlementPolicy: 'standard' as const,
              vaultPartnerId: null,
              known: true,
            })),
          ),
      ),
      getDepositedAtByTokenIds: jest.fn().mockResolvedValue(new Map()),
      assertTokensRedeemable: jest.fn().mockResolvedValue(undefined),
    };
    const partners = {
      getDisplayNamesByIds: jest.fn().mockResolvedValue(new Map()),
      findAddressByPartnerId: jest.fn(),
    };
    const fedex = new FedExRateClient(config);
    const feeCalculator = new RedeemShippingFeeCalculator(
      config,
      chainConfig as never,
      vault as never,
      partners as never,
      fedex,
      platformFee as never,
    );
    const rwaTokenRegistry = {
      ensureFromChain: jest.fn().mockResolvedValue(undefined),
    };
    return {
      svc: new RwaRedeemService(
        {} as never,
        {} as never,
        chainConfig as never,
        vault as never,
        platformFee as never,
        feeCalculator,
        {} as never,
        { assertApprovedForCustody: jest.fn().mockResolvedValue(undefined) } as never,
        { notifyRedeemCompleted: jest.fn().mockResolvedValue(undefined) } as never,
        config,
        rwaTokenRegistry as never,
        { recordOwner: jest.fn().mockResolvedValue(undefined) } as never,
        { refreshCurrentSlotSnapshots: jest.fn().mockResolvedValue(undefined) } as never,
        { createQueryBuilder: jest.fn() } as never,
        {
          ensureBurnedForRedeem: jest.fn().mockResolvedValue({
            txHash: null,
            alreadyBurned: true,
            cancelledOrderHashes: [],
          }),
        } as never,
      ),
      vault,
      partners,
      feeCalculator,
      rwaTokenRegistry,
    };
  }

  it('isPsaEarlyWithdrawal: null date → early', () => {
    expect(isPsaEarlyWithdrawal(null, 90)).toBe(true);
  });

  it('isPsaEarlyWithdrawal: recent deposit → early', () => {
    const d = new Date();
    d.setDate(d.getDate() - 10);
    expect(isPsaEarlyWithdrawal(d, 90)).toBe(true);
  });

  it('isPsaEarlyWithdrawal: 100 days ago → not early', () => {
    const d = new Date();
    d.setDate(d.getDate() - 100);
    expect(isPsaEarlyWithdrawal(d, 90)).toBe(false);
  });

  it('estimate without tokenIds: PSA schedule (cardCount)', async () => {
    const est = await makeService().svc.estimateRedeemCost({
      country: 'us',
      cardCount: 2,
    });
    expect(est.shippingUsd).toBe(5.99);
    expect(est.retrievalFeePerCardUsd).toBe(1.99);
    expect(est.earlyWithdrawalFeePerCardUsd).toBe(4.99);
    expect(est.earlyWithdrawalCardCount).toBe(2);
    expect(est.retrievalFeeTotalUsd).toBe(3.98);
    expect(est.earlyWithdrawalFeeTotalUsd).toBe(9.98);
    expect(est.withdrawFeeTotalUsd).toBe(13.96);
    expect(est.totalUsd).toBe(19.95);
    expect(est.shipments).toHaveLength(1);
    expect(est.shipments[0]!.provider).toBe('psa_vault');
    expect(est.ageBasis).toBe('unknown_assume_early');
    expect(BigInt(est.totalUsdcMicros)).toBe(BigInt(19_950_000));
  });

  it('honors env shipping + retrieval overrides', async () => {
    const est = await makeService({
      PSA_VAULT_RETRIEVAL_FEE_USD: '2.00',
      PSA_VAULT_SHIPPING_CA_USD: '20',
      PSA_VAULT_EARLY_WITHDRAWAL_FEE_USD: '0',
    }).svc.estimateRedeemCost({ country: 'ca', cardCount: 1 });
    expect(est.shippingUsd).toBe(20);
    expect(est.retrievalFeePerCardUsd).toBe(2);
    expect(est.earlyWithdrawalFeeTotalUsd).toBe(0);
    expect(est.totalUsd).toBe(22);
  });

  it('mixed PSA + Partner: two shipments, stub partner shipping', async () => {
    const { svc, vault, partners } = makeService({
      PARTNER_VAULT_SHIPPING_US_USD: '12.99',
      PSA_VAULT_EARLY_WITHDRAWAL_FEE_USD: '0',
    });
    vault.getVaultCustodyRows.mockResolvedValue([
      {
        tokenId: '1',
        settlementPolicy: 'standard',
        vaultPartnerId: null,
        known: true,
      },
      {
        tokenId: '2',
        settlementPolicy: 'self_vault_hold',
        vaultPartnerId: 'partner-1',
        known: true,
      },
    ]);
    vault.getDepositedAtByTokenIds.mockResolvedValue(
      new Map([
        ['1', { depositedAt: new Date('2020-01-01'), cycleId: 'c1', status: 'minted' }],
        ['2', { depositedAt: new Date('2020-01-01'), cycleId: 'c2', status: 'minted' }],
      ]),
    );
    partners.getDisplayNamesByIds.mockResolvedValue(
      new Map([['partner-1', 'Tokenable']]),
    );
    partners.findAddressByPartnerId.mockResolvedValue({
      companyName: 'Tokenable Inc',
      contactName: 'Ops',
      phone: '+1',
      country: 'US',
      city: 'LA',
      region: 'CA',
      postal: '90015',
      line1: '1 Main',
      line2: null,
      residential: false,
    });

    const est = await svc.estimateRedeemCost({
      country: 'us',
      tokenIds: [1, 2],
      chainId: 11155111 as never,
      shipTo: {
        name: 'Buyer',
        line1: '1 Market',
        city: 'San Francisco',
        region: 'CA',
        postal: '94103',
        phone: '+1 415 555 0100',
        countryCode: 'US',
      },
    });

    expect(est.shipments).toHaveLength(2);
    const psa = est.shipments.find((s) => s.provider === 'psa_vault');
    const partner = est.shipments.find((s) => s.provider === 'partner');
    expect(psa?.shippingUsd).toBe(5.99);
    expect(psa?.retrievalFeeTotalUsd).toBe(1.99);
    expect(partner?.shippingUsd).toBe(12.99);
    expect(partner?.retrievalFeeTotalUsd).toBe(0);
    expect(partner?.vaultLabel).toBe('Tokenable Vault');
    expect(partner?.shippingSource).toBe('fedex_stub');
    expect(partner?.shippingDestinationCountry).toBe('US');
    expect(partner?.shippingQuoteExpiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(est.shippingQuoteExpiresAt).toBe(partner?.shippingQuoteExpiresAt);
    expect(est.shippingUsd).toBe(18.98);
    expect(est.totalUsd).toBe(roundish(18.98 + 1.99));
  });

  it('partner estimate without shipTo fails clearly', async () => {
    const { svc, vault, partners } = makeService();
    vault.getVaultCustodyRows.mockResolvedValue([
      {
        tokenId: '2',
        settlementPolicy: 'self_vault_hold',
        vaultPartnerId: 'partner-1',
        known: true,
      },
    ]);
    vault.getDepositedAtByTokenIds.mockResolvedValue(
      new Map([
        [
          '2',
          {
            depositedAt: new Date('2020-01-01'),
            cycleId: 'c2',
            status: 'minted',
          },
        ],
      ]),
    );
    partners.getDisplayNamesByIds.mockResolvedValue(
      new Map([['partner-1', 'Tokenable']]),
    );
    partners.findAddressByPartnerId.mockResolvedValue({
      country: 'US',
      city: 'LA',
      region: 'CA',
      postal: '90015',
      line1: '1 Main',
      residential: false,
    });

    await expect(
      svc.estimateRedeemCost({
        country: 'intl',
        tokenIds: [2],
        chainId: 11155111 as never,
      }),
    ).rejects.toThrow(/shipTo/);
  });

  it('intl partner estimate without countryCode fails (no phone guess)', async () => {
    const { svc, vault, partners } = makeService();
    vault.getVaultCustodyRows.mockResolvedValue([
      {
        tokenId: '2',
        settlementPolicy: 'self_vault_hold',
        vaultPartnerId: 'partner-1',
        known: true,
      },
    ]);
    vault.getDepositedAtByTokenIds.mockResolvedValue(
      new Map([
        [
          '2',
          {
            depositedAt: new Date('2020-01-01'),
            cycleId: 'c2',
            status: 'minted',
          },
        ],
      ]),
    );
    partners.getDisplayNamesByIds.mockResolvedValue(
      new Map([['partner-1', 'Tokenable']]),
    );
    partners.findAddressByPartnerId.mockResolvedValue({
      country: 'US',
      city: 'LA',
      region: 'CA',
      postal: '90015',
      line1: '1 Main',
      residential: false,
    });

    await expect(
      svc.estimateRedeemCost({
        country: 'intl',
        tokenIds: [2],
        chainId: 11155111 as never,
        shipTo: {
          name: 'Buyer',
          line1: '1 Road',
          city: 'Seoul',
          postal: '07788',
          phone: '+82 10 1234 5678',
        },
      }),
    ).rejects.toThrow(/countryCode/);
  });

  it('fails the estimate when a token is not redeemable (before any payment)', async () => {
    const { svc, vault } = makeService();
    vault.assertTokensRedeemable.mockRejectedValue(
      new Error('Token #49 is not registered on Tokenable yet'),
    );
    await expect(
      svc.estimateRedeemCost({
        country: 'us',
        tokenIds: [49],
        chainId: 11155111 as never,
      }),
    ).rejects.toThrow(/not registered/);
  });

  it('syncs a missing rwa_tokens row from chain then estimates', async () => {
    const { svc, vault, rwaTokenRegistry } = makeService();
    vault.assertTokensRedeemable
      .mockRejectedValueOnce(
        new Error(
          'Token #22 is not registered on Tokenable yet — it cannot be redeemed. Contact support.',
        ),
      )
      .mockResolvedValueOnce(undefined);
    await expect(
      svc.estimateRedeemCost({
        country: 'us',
        tokenIds: [22],
        chainId: 11155111 as never,
      }),
    ).resolves.toBeDefined();
    expect(rwaTokenRegistry.ensureFromChain).toHaveBeenCalledWith(22, 11155111);
  });

  it('pins the estimate total and keeps the cheapest unexpired quote', async () => {
    const { svc } = makeService();
    await svc.estimateRedeemCost({
      country: 'us',
      tokenIds: [7],
      chainId: 11155111 as never,
    });

    type PinApi = {
      pinQuote(key: string, estimate: { totalUsdcMicros: string }, iso?: string | null): void;
      pinnedQuoteMicros(key: string): bigint | null;
    };
    const pins = svc as unknown as PinApi;
    const key = '7|us|';
    // PSA us single card: 5.99 shipping + 1.99 retrieval + 4.99 early = 12.97
    expect(pins.pinnedQuoteMicros(key)).toBe(BigInt(12_970_000));

    // A later, more expensive quote must not evict the cheaper one.
    pins.pinQuote(key, { totalUsdcMicros: '20000000' });
    expect(pins.pinnedQuoteMicros(key)).toBe(BigInt(12_970_000));

    // A cheaper re-quote wins.
    pins.pinQuote(key, { totalUsdcMicros: '10000000' });
    expect(pins.pinnedQuoteMicros(key)).toBe(BigInt(10_000_000));

    // Expired pins are ignored.
    pins.pinQuote(
      '8|us|',
      { totalUsdcMicros: '1' },
      new Date(Date.now() - 1000).toISOString(),
    );
    expect(pins.pinnedQuoteMicros('8|us|')).toBeNull();
  });

  it('picks the quote that matches the USDC actually paid', () => {
    const { svc } = makeService();
    type MatchApi = {
      estimateMatchingPayment(
        fresh: { totalUsdcMicros: string; shippingUsd: number },
        pinned: { totalUsdcMicros: string; shippingUsd: number } | null,
        paid: bigint,
      ): { totalUsdcMicros: string; shippingUsd: number };
    };
    const api = svc as unknown as MatchApi;
    const cheap = { totalUsdcMicros: '60960000', shippingUsd: 53.98 };
    const expensive = { totalUsdcMicros: '70770000', shippingUsd: 63.79 };
    expect(
      api.estimateMatchingPayment(expensive, cheap, BigInt(60_960_000)).shippingUsd,
    ).toBe(53.98);
    expect(
      api.estimateMatchingPayment(expensive, cheap, BigInt(70_770_000)).shippingUsd,
    ).toBe(63.79);
  });
});

describe('RwaRedeemService.confirmReceipt', () => {
  function makeConfirmService(
    vault: {
      findRedemptionsByBatchId: jest.Mock;
      markUserReceiptConfirmed: jest.Mock;
      getTokenIdForRedemption?: jest.Mock;
    },
    rwaTokenAdmin: {
      ensureBurnedForRedeem: jest.Mock;
    } = {
      ensureBurnedForRedeem: jest.fn().mockResolvedValue({
        txHash: '0xburn',
        alreadyBurned: false,
        cancelledOrderHashes: [],
      }),
    },
  ) {
    const vaultWithToken = {
      getTokenIdForRedemption: jest.fn().mockResolvedValue('42'),
      ...vault,
    };
    return new RwaRedeemService(
      {} as never,
      {} as never,
      {} as never,
      vaultWithToken as never,
      {} as never,
      {} as never,
      {} as never,
      { assertApprovedForCustody: jest.fn().mockResolvedValue(undefined) } as never,
      { notifyRedeemCompleted: jest.fn().mockResolvedValue(undefined) } as never,
      { get: () => undefined } as never,
      { ensureFromChain: jest.fn().mockResolvedValue(undefined) } as never,
      { recordOwner: jest.fn().mockResolvedValue(undefined) } as never,
      { refreshCurrentSlotSnapshots: jest.fn().mockResolvedValue(undefined) } as never,
      { createQueryBuilder: jest.fn() } as never,
      rwaTokenAdmin as never,
    );
  }

  const user = { id: 'user-1' } as never;

  it('rejects when any shipment lacks tracking', async () => {
    const vault = {
      findRedemptionsByBatchId: jest.fn().mockResolvedValue([
        {
          id: 'a',
          requestedByUserId: 'user-1',
          refundStatus: 'none',
          status: 'in_custody',
          trackingNumber: '1ZAAA',
        },
        {
          id: 'b',
          requestedByUserId: 'user-1',
          refundStatus: 'none',
          status: 'in_custody',
          trackingNumber: null,
        },
      ]),
      markUserReceiptConfirmed: jest.fn(),
    };
    const admin = {
      ensureBurnedForRedeem: jest.fn(),
    };
    await expect(
      makeConfirmService(vault, admin).confirmReceipt(user, 'batch-1', 11155111),
    ).rejects.toThrow(/tracking number/);
    expect(vault.markUserReceiptConfirmed).not.toHaveBeenCalled();
    expect(admin.ensureBurnedForRedeem).not.toHaveBeenCalled();
  });

  it('burns then marks completed when all tracked', async () => {
    const rows = [
      {
        id: 'a',
        paymentBatchId: 'batch-1',
        requestedByUserId: 'user-1',
        refundStatus: 'none',
        status: 'in_custody',
        trackingNumber: '1ZAAA',
        vaultReleasedAt: null,
        burnTxHash: null,
        burnedAt: null,
      },
      {
        id: 'b',
        paymentBatchId: 'batch-1',
        requestedByUserId: 'user-1',
        refundStatus: 'none',
        status: 'in_custody',
        trackingNumber: '1ZBBB',
        vaultReleasedAt: null,
        burnTxHash: null,
        burnedAt: null,
      },
    ];
    const burnedRows = rows.map((r) => ({
      ...r,
      status: 'burned',
      burnTxHash: '0xburn',
      burnedAt: new Date('2026-08-06T00:00:00Z'),
    }));
    const vault = {
      findRedemptionsByBatchId: jest
        .fn()
        .mockResolvedValueOnce(rows)
        .mockResolvedValue(burnedRows),
      getTokenIdForRedemption: jest
        .fn()
        .mockResolvedValueOnce('10')
        .mockResolvedValueOnce('11'),
      markUserReceiptConfirmed: jest.fn().mockImplementation(async (r) =>
        r.map((row: { id: string }) => ({
          ...row,
          status: 'completed',
          vaultReleasedAt: new Date('2026-08-06T00:00:00Z'),
        })),
      ),
    };
    const admin = {
      ensureBurnedForRedeem: jest.fn().mockResolvedValue({
        txHash: '0xburn',
        alreadyBurned: false,
        cancelledOrderHashes: [],
      }),
    };
    const result = await makeConfirmService(vault, admin).confirmReceipt(
      user,
      'batch-1',
      11155111,
    );
    expect(result.status).toBe('completed');
    expect(result.alreadyCompleted).toBe(false);
    expect(admin.ensureBurnedForRedeem).toHaveBeenCalledTimes(2);
    expect(admin.ensureBurnedForRedeem).toHaveBeenCalledWith(10, 11155111);
    expect(admin.ensureBurnedForRedeem).toHaveBeenCalledWith(11, 11155111);
    expect(vault.markUserReceiptConfirmed).toHaveBeenCalledWith(burnedRows, {
      via: 'user',
    });
  });
});

describe('RwaRedeemService.confirmCustodyTransfers ownership', () => {
  it('writes owner_wallet to custody immediately after confirm', async () => {
    const ownerIndex = {
      recordOwner: jest.fn().mockResolvedValue(undefined),
    };
    const portfolioSnapshots = {
      refreshCurrentSlotSnapshots: jest.fn().mockResolvedValue(undefined),
    };
    const custody = '0xcccccccccccccccccccccccccccccccccccccccc';
    const userWallet = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const row = {
      id: 'r1',
      requestedByUserId: 'user-1',
      refundStatus: 'none',
      status: 'ownership_verified',
      ownerWalletAddress: userWallet,
      custodyTxHash: null,
    };
    const vault = {
      findRedemptionsByBatchId: jest
        .fn()
        .mockResolvedValueOnce([row])
        .mockResolvedValueOnce([{ ...row, status: 'in_custody', custodyTxHash: '0xabc' }]),
      getTokenIdForRedemption: jest.fn().mockResolvedValue('42'),
      markCustodyReceived: jest.fn().mockResolvedValue({
        ...row,
        status: 'in_custody',
        custodyTxHash: '0xabc',
      }),
      emitRedeemCustodyNotifications: jest.fn().mockResolvedValue(undefined),
    };
    const blockchain = {
      getRwaTokenOwner: jest.fn().mockResolvedValue(custody),
    };
    const chainConfig = {
      getRwaAddress: () => '0xrwa',
    };
    const chainWriter = {
      getCustodyWalletAddress: jest.fn().mockResolvedValue(custody),
    };
    const svc = new RwaRedeemService(
      {} as never,
      blockchain as never,
      chainConfig as never,
      vault as never,
      {} as never,
      {} as never,
      chainWriter as never,
      { assertApprovedForCustody: jest.fn().mockResolvedValue(undefined) } as never,
      {} as never,
      { get: () => undefined } as never,
      {} as never,
      ownerIndex as never,
      portfolioSnapshots as never,
      { createQueryBuilder: jest.fn() } as never,
      {
        ensureBurnedForRedeem: jest.fn().mockResolvedValue({
          txHash: null,
          alreadyBurned: true,
          cancelledOrderHashes: [],
        }),
      } as never,
    );

    await svc.confirmCustodyTransfers(
      { id: 'user-1' } as never,
      'batch-1',
      { transfers: [] },
      11155111,
    );

    expect(ownerIndex.recordOwner).toHaveBeenCalledWith('0xrwa', 42, custody);
    expect(portfolioSnapshots.refreshCurrentSlotSnapshots).toHaveBeenCalledWith(
      [userWallet],
      11155111,
    );
  });
});

function roundish(n: number) {
  return Math.round(n * 100) / 100;
}
