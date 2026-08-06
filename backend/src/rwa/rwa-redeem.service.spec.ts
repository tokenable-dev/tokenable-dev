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
      getVaultCustodyRows: jest.fn().mockResolvedValue([]),
      getDepositedAtByTokenIds: jest.fn().mockResolvedValue(new Map()),
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
    return {
      svc: new RwaRedeemService(
        {} as never,
        {} as never,
        chainConfig as never,
        vault as never,
        platformFee as never,
        feeCalculator,
        {} as never,
      ),
      vault,
      partners,
      feeCalculator,
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
      },
      {
        tokenId: '2',
        settlementPolicy: 'self_vault_hold',
        vaultPartnerId: 'partner-1',
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
    expect(partner?.vaultLabel).toMatch(/Tokenable/i);
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
});

describe('RwaRedeemService.confirmReceipt', () => {
  function makeConfirmService(vault: {
    findRedemptionsByBatchId: jest.Mock;
    markUserReceiptConfirmed: jest.Mock;
  }) {
    return new RwaRedeemService(
      {} as never,
      {} as never,
      {} as never,
      vault as never,
      {} as never,
      {} as never,
      {} as never,
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
    await expect(
      makeConfirmService(vault).confirmReceipt(user, 'batch-1'),
    ).rejects.toThrow(/tracking number/);
    expect(vault.markUserReceiptConfirmed).not.toHaveBeenCalled();
  });

  it('marks completed when all tracked', async () => {
    const rows = [
      {
        id: 'a',
        requestedByUserId: 'user-1',
        refundStatus: 'none',
        status: 'in_custody',
        trackingNumber: '1ZAAA',
        vaultReleasedAt: null,
      },
      {
        id: 'b',
        requestedByUserId: 'user-1',
        refundStatus: 'none',
        status: 'in_custody',
        trackingNumber: '1ZBBB',
        vaultReleasedAt: null,
      },
    ];
    const vault = {
      findRedemptionsByBatchId: jest.fn().mockResolvedValue(rows),
      markUserReceiptConfirmed: jest.fn().mockImplementation(async (r) =>
        r.map((row: { id: string }) => ({
          ...row,
          status: 'completed',
          vaultReleasedAt: new Date('2026-08-06T00:00:00Z'),
        })),
      ),
    };
    const result = await makeConfirmService(vault).confirmReceipt(
      user,
      'batch-1',
    );
    expect(result.status).toBe('completed');
    expect(result.alreadyCompleted).toBe(false);
    expect(vault.markUserReceiptConfirmed).toHaveBeenCalledWith(rows);
  });
});

function roundish(n: number) {
  return Math.round(n * 100) / 100;
}
