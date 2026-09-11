import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SupportedChainId } from '../blockchain/chain-config.service';
import { ChainConfigService } from '../blockchain/chain-config.service';
import { PlatformFeeWalletService } from '../blockchain/platform-fee-wallet.service';
import { PUBLIC_SELF_VAULT_LABEL } from '../marketplace/partners/partner-vault-label.util';
import { MarketplacePartnersService } from '../marketplace/partners/marketplace-partners.service';
import { VaultService } from '../vault/vault.service';
import {
  loadPsaVaultFeeConfig,
  psaCardFees,
} from './psa-vault-fee.schedule';
import {
  roundUsd,
  usdToUsdcMicros,
  type RedeemCardFeeLine,
  type RedeemCountry,
  type RedeemEstimate,
  type RedeemShipmentEstimate,
} from './redeem-fee.types';
import { resolveShipToDestinationIso2 } from './shipping/destination-country';
import { FedExRateClient } from './shipping/fedex-rate.client';
import type { ShippingRateAddress } from './shipping/shipping-rate.client';

type TokenMeta = {
  tokenId: number;
  settlementPolicy: 'standard' | 'self_vault_hold';
  vaultPartnerId: string | null;
  vaultedAt: Date | null;
};

/**
 * Aggregates redeem fees by shipment:
 * - PSA (`standard`) → one shipment, published schedule
 * - Partner (`self_vault_hold`) → one shipment per vault_partner_id, Rate/stub
 */
@Injectable()
export class RedeemShippingFeeCalculator {
  constructor(
    private readonly config: ConfigService,
    private readonly chainConfig: ChainConfigService,
    private readonly vault: VaultService,
    private readonly partners: MarketplacePartnersService,
    private readonly fedex: FedExRateClient,
    private readonly platformFee: PlatformFeeWalletService,
  ) {}

  async estimate(params: {
    country: RedeemCountry;
    cardCount?: number;
    tokenIds?: number[];
    chainId?: SupportedChainId;
    /** Optional richer destination for Rate APIs (stub still uses country bucket). */
    shipTo?: {
      name: string;
      line1: string;
      line2?: string | null;
      city: string;
      region?: string | null;
      postal: string;
      phone: string;
      /** ISO-2 for FedEx; required when country bucket is intl. */
      countryCode?: string | null;
    };
  }): Promise<RedeemEstimate> {
    const psaCfg = loadPsaVaultFeeConfig(this.config);
    const country = params.country;
    const tokenIds = (params.tokenIds ?? [])
      .map((n) => Math.floor(Number(n)))
      .filter((n) => n > 0);
    const uniqueIds = [...new Set(tokenIds)];

    // Legacy estimate without tokenIds → PSA-only schedule (cardCount).
    if (uniqueIds.length === 0) {
      return this.estimatePsaOnlyCardCount(country, params.cardCount ?? 1, psaCfg);
    }

    if (params.chainId == null) {
      throw new BadRequestException(
        'chainId header required when estimating with tokenIds',
      );
    }

    const contract = this.chainConfig.getRwaAddress(params.chainId);
    const custody = await this.vault.getVaultCustodyRows(
      contract,
      uniqueIds.map(String),
    );
    const ages = await this.vault.getDepositedAtByTokenIds(
      contract,
      uniqueIds.map(String),
    );

    const unknownIds = custody.filter((c) => !c.known).map((c) => c.tokenId);
    if (unknownIds.length > 0) {
      throw new BadRequestException(
        `RWA token(s) not indexed for this chain: ${unknownIds.join(', ')}`,
      );
    }

    const metas: TokenMeta[] = uniqueIds.map((tokenId) => {
      const row = custody.find((c) => c.tokenId === String(tokenId));
      if (!row?.known || row.settlementPolicy == null) {
        throw new BadRequestException(
          `RWA token ${tokenId} is not indexed for this chain`,
        );
      }
      return {
        tokenId,
        settlementPolicy: row.settlementPolicy,
        vaultPartnerId: row.vaultPartnerId ?? null,
        vaultedAt: ages.get(String(tokenId))?.depositedAt ?? null,
      };
    });

    // Group into shipments
    type Group = { key: string; provider: 'psa_vault' | 'partner'; partnerId: string | null; tokens: TokenMeta[] };
    const groups = new Map<string, Group>();
    for (const m of metas) {
      const key =
        m.settlementPolicy === 'self_vault_hold'
          ? `partner:${m.vaultPartnerId ?? 'unknown'}`
          : 'psa_vault';
      const provider =
        m.settlementPolicy === 'self_vault_hold' ? 'partner' : 'psa_vault';
      const g = groups.get(key) ?? {
        key,
        provider,
        partnerId: provider === 'partner' ? m.vaultPartnerId : null,
        tokens: [],
      };
      g.tokens.push(m);
      groups.set(key, g);
    }

    for (const g of groups.values()) {
      if (g.tokens.length > psaCfg.maxItems) {
        throw new BadRequestException(
          `At most ${psaCfg.maxItems} cards per ${g.provider} shipment`,
        );
      }
      if (g.provider === 'partner' && !g.partnerId) {
        throw new BadRequestException(
          'Self vault token is missing vault_partner_id — cannot quote Partner shipping',
        );
      }
    }

    const needsPartnerQuote = [...groups.values()].some(
      (g) => g.provider === 'partner',
    );
    let destinationIso: string | null = null;
    if (needsPartnerQuote) {
      if (!params.shipTo) {
        throw new BadRequestException(
          'shipTo (with destination country) is required for Partner Self vault shipping quotes',
        );
      }
      // Prefer shipTo.countryCode (ISO-2). Bucket us/ca map only when countryCode omitted.
      destinationIso = resolveShipToDestinationIso2({
        country,
        countryCode: params.shipTo.countryCode,
      });
    }

    const destination: ShippingRateAddress | null = destinationIso
      ? {
          contactName: params.shipTo?.name,
          phone: params.shipTo?.phone,
          country: destinationIso,
          city: params.shipTo?.city ?? '',
          region: params.shipTo?.region ?? null,
          postal: params.shipTo?.postal ?? '',
          line1: params.shipTo?.line1 ?? '',
          line2: params.shipTo?.line2 ?? null,
          residential: true,
        }
      : null;

    const shipments: RedeemShipmentEstimate[] = [];
    const allCards: RedeemCardFeeLine[] = [];
    let earlyCount = 0;
    let earliestQuoteExpiresAt: string | null = null;

    for (const g of groups.values()) {
      if (g.provider === 'psa_vault') {
        const shippingSource = 'psa_published' as const;
        const cards: RedeemCardFeeLine[] = g.tokens.map((m, index) => {
          const fees = psaCardFees({
            cfg: psaCfg,
            country,
            vaultedAt: m.vaultedAt,
            isFirstInShipment: index === 0,
          });
          if (fees.earlyWithdrawal) earlyCount += 1;
          const line: RedeemCardFeeLine = {
            tokenId: m.tokenId,
            vaultedAt: m.vaultedAt?.toISOString() ?? null,
            earlyWithdrawal: fees.earlyWithdrawal,
            retrievalUsd: fees.retrievalUsd,
            earlyWithdrawalUsd: fees.earlyWithdrawalUsd,
            shippingUsd: fees.shippingUsd,
            totalUsd: fees.totalUsd,
            shipmentKey: g.key,
          };
          return line;
        });
        const shippingUsd = cards.reduce((s, c) => s + c.shippingUsd, 0);
        const retrievalFeeTotalUsd = roundUsd(
          cards.reduce((s, c) => s + c.retrievalUsd, 0),
        );
        const earlyWithdrawalFeeTotalUsd = roundUsd(
          cards.reduce((s, c) => s + c.earlyWithdrawalUsd, 0),
        );
        const totalUsd = roundUsd(
          shippingUsd + retrievalFeeTotalUsd + earlyWithdrawalFeeTotalUsd,
        );
        shipments.push({
          key: g.key,
          provider: 'psa_vault',
          vaultPartnerId: null,
          vaultLabel: 'PSA Vault',
          cardCount: cards.length,
          shippingUsd: roundUsd(shippingUsd),
          retrievalFeeTotalUsd,
          earlyWithdrawalFeeTotalUsd,
          totalUsd,
          shippingSource,
          cards,
        });
        allCards.push(...cards);
        continue;
      }

      const partnerId = g.partnerId!;
      const originRow = await this.partners.findAddressByPartnerId(partnerId);
      if (!originRow) {
        throw new BadRequestException({
          statusCode: 400,
          code: 'COMPANY_ADDRESS_REQUIRED',
          message:
            'Partner shipping origin is missing — the vault host must set company address before redeem',
        });
      }
      const origin: ShippingRateAddress = {
        companyName: originRow.companyName,
        contactName: originRow.contactName,
        phone: originRow.phone,
        country: originRow.country,
        city: originRow.city,
        region: originRow.region,
        postal: originRow.postal,
        line1: originRow.line1,
        line2: originRow.line2,
        residential: originRow.residential,
      };
      if (!destination || !destinationIso) {
        throw new BadRequestException(
          'shipTo destination country is required for Partner Self vault shipping quotes',
        );
      }
      const quote = await this.fedex.quote({
        origin,
        destination,
        destinationBucket: country,
        packageCount: g.tokens.length,
      });
      if (
        !earliestQuoteExpiresAt ||
        Date.parse(quote.expiresAt) < Date.parse(earliestQuoteExpiresAt)
      ) {
        earliestQuoteExpiresAt = quote.expiresAt;
      }
      const cards: RedeemCardFeeLine[] = g.tokens.map((m, index) => {
        const shippingUsd = index === 0 ? quote.shippingUsd : 0;
        const line: RedeemCardFeeLine = {
          tokenId: m.tokenId,
          vaultedAt: m.vaultedAt?.toISOString() ?? null,
          earlyWithdrawal: false,
          retrievalUsd: 0,
          earlyWithdrawalUsd: 0,
          shippingUsd,
          totalUsd: roundUsd(shippingUsd),
          shipmentKey: g.key,
        };
        return line;
      });
      const shippingUsd = roundUsd(quote.shippingUsd);
      shipments.push({
        key: g.key,
        provider: 'partner',
        vaultPartnerId: partnerId,
        vaultLabel: PUBLIC_SELF_VAULT_LABEL,
        cardCount: cards.length,
        shippingUsd,
        retrievalFeeTotalUsd: 0,
        earlyWithdrawalFeeTotalUsd: 0,
        totalUsd: shippingUsd,
        shippingSource:
          quote.source === 'fedex_rate' ? 'fedex_rate' : 'fedex_stub',
        shippingServiceType: quote.serviceType,
        shippingRateType: quote.rateType,
        shippingQuoteExpiresAt: quote.expiresAt,
        shippingDestinationCountry: destinationIso,
        cards,
      });
      allCards.push(...cards);
    }

    const shippingUsd = roundUsd(
      shipments.reduce((s, sh) => s + sh.shippingUsd, 0),
    );
    const retrievalFeeTotalUsd = roundUsd(
      shipments.reduce((s, sh) => s + sh.retrievalFeeTotalUsd, 0),
    );
    const earlyWithdrawalFeeTotalUsd = roundUsd(
      shipments.reduce((s, sh) => s + sh.earlyWithdrawalFeeTotalUsd, 0),
    );
    const withdrawFeeTotalUsd = roundUsd(
      retrievalFeeTotalUsd + earlyWithdrawalFeeTotalUsd,
    );
    const totalUsd = roundUsd(shippingUsd + withdrawFeeTotalUsd);
    const payTo = this.platformFee.getConfiguredRecipient();
    const sources = [...new Set(shipments.map((s) => s.shippingSource))];

    return {
      currency: 'USD',
      country,
      cardCount: allCards.length,
      shippingUsd,
      retrievalFeePerCardUsd: psaCfg.retrievalUsd,
      earlyWithdrawalFeePerCardUsd: psaCfg.earlyUsd,
      earlyWithdrawalDays: psaCfg.earlyDays,
      earlyWithdrawalCardCount: earlyCount,
      retrievalFeeTotalUsd,
      earlyWithdrawalFeeTotalUsd,
      withdrawFeePerCardUsd: roundUsd(
        withdrawFeeTotalUsd / Math.max(1, allCards.length),
      ),
      withdrawFeeTotalUsd,
      totalUsd,
      totalUsdcMicros: usdToUsdcMicros(totalUsd).toString(),
      payToAddress: payTo,
      cards: allCards,
      shipments,
      source: sources.join('+'),
      ageBasis: 'deposited_at',
      shippingQuoteExpiresAt: earliestQuoteExpiresAt,
    };
  }

  private estimatePsaOnlyCardCount(
    country: RedeemCountry,
    cardCount: number,
    psaCfg: ReturnType<typeof loadPsaVaultFeeConfig>,
  ): RedeemEstimate {
    const count = Math.min(
      psaCfg.maxItems,
      Math.max(1, Math.floor(cardCount)),
    );
    const cards: RedeemCardFeeLine[] = [];
    let earlyCount = 0;
    for (let i = 0; i < count; i++) {
      const fees = psaCardFees({
        cfg: psaCfg,
        country,
        vaultedAt: null,
        isFirstInShipment: i === 0,
      });
      if (fees.earlyWithdrawal) earlyCount += 1;
      cards.push({
        tokenId: 0,
        vaultedAt: null,
        earlyWithdrawal: fees.earlyWithdrawal,
        retrievalUsd: fees.retrievalUsd,
        earlyWithdrawalUsd: fees.earlyWithdrawalUsd,
        shippingUsd: fees.shippingUsd,
        totalUsd: fees.totalUsd,
        shipmentKey: 'psa_vault',
      });
    }
    const shippingUsd = cards.reduce((s, c) => s + c.shippingUsd, 0);
    const retrievalFeeTotalUsd = roundUsd(psaCfg.retrievalUsd * count);
    const earlyWithdrawalFeeTotalUsd = roundUsd(psaCfg.earlyUsd * earlyCount);
    const withdrawFeeTotalUsd = roundUsd(
      retrievalFeeTotalUsd + earlyWithdrawalFeeTotalUsd,
    );
    const totalUsd = roundUsd(shippingUsd + withdrawFeeTotalUsd);
    const shipment: RedeemShipmentEstimate = {
      key: 'psa_vault',
      provider: 'psa_vault',
      vaultPartnerId: null,
      vaultLabel: 'PSA Vault',
      cardCount: count,
      shippingUsd: roundUsd(shippingUsd),
      retrievalFeeTotalUsd,
      earlyWithdrawalFeeTotalUsd,
      totalUsd,
      shippingSource: 'psa_published',
      cards,
    };
    return {
      currency: 'USD',
      country,
      cardCount: count,
      shippingUsd: roundUsd(shippingUsd),
      retrievalFeePerCardUsd: psaCfg.retrievalUsd,
      earlyWithdrawalFeePerCardUsd: psaCfg.earlyUsd,
      earlyWithdrawalDays: psaCfg.earlyDays,
      earlyWithdrawalCardCount: earlyCount,
      retrievalFeeTotalUsd,
      earlyWithdrawalFeeTotalUsd,
      withdrawFeePerCardUsd: roundUsd(
        withdrawFeeTotalUsd / Math.max(1, count),
      ),
      withdrawFeeTotalUsd,
      totalUsd,
      totalUsdcMicros: usdToUsdcMicros(totalUsd).toString(),
      payToAddress: this.platformFee.getConfiguredRecipient(),
      cards,
      shipments: [shipment],
      source: 'psa_vault_published_schedule',
      ageBasis: 'unknown_assume_early',
    };
  }
}
