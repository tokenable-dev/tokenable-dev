import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { MarketplaceAdminService } from '../../marketplace/admin/marketplace-admin.service';
import { FedexRateProbeDto } from '../dto/fedex-rate-probe.dto';
import { FedExRateClient } from '../shipping/fedex-rate.client';
import type { ShippingRateAddress } from '../shipping/shipping-rate.client';

const SWAGGER_US_TO_KR_EXAMPLE = {
  origin: {
    companyName: 'Tokenable Vault',
    contactName: 'Ops Desk',
    phone: '+1 213 555 0100',
    country: 'US',
    city: 'Los Angeles',
    region: 'CA',
    postal: '90015',
    line1: '1 Main St',
    line2: 'Suite 100',
    residential: false,
  },
  destination: {
    contactName: 'Buyer',
    phone: '+82 10 2741 3926',
    country: 'KR',
    city: 'Seoul',
    postal: '07788',
    line1: '165 Magokjungang-ro',
    line2: 'Private Tower 507',
    residential: true,
  },
  destinationBucket: 'intl',
  packageCount: 2,
};

const SWAGGER_US_TO_US_EXAMPLE = {
  origin: {
    ...SWAGGER_US_TO_KR_EXAMPLE.origin,
  },
  destination: {
    contactName: 'Buyer',
    phone: '+1 415 555 0199',
    country: 'US',
    city: 'San Francisco',
    region: 'CA',
    postal: '94103',
    line1: '1425 Market Street',
    line2: 'Apt 8B',
    residential: true,
  },
  destinationBucket: 'us',
  packageCount: 1,
};

const SWAGGER_KR_TO_KR_EXAMPLE = {
  origin: {
    companyName: 'Tokenable KR',
    contactName: 'Ops',
    phone: '+82 10 0000 0000',
    country: 'KR',
    city: 'Seoul',
    postal: '07788',
    line1: '165 Magokjungang-ro',
    residential: false,
  },
  destination: {
    contactName: 'Buyer',
    phone: '+82 10 2741 3926',
    country: 'KR',
    city: 'Seoul',
    postal: '07788',
    line1: '165 Magokjungang-ro',
    residential: true,
  },
  destinationBucket: 'intl',
  packageCount: 2,
};

function toAddr(
  dto: FedexRateProbeDto['origin'],
  residentialDefault: boolean,
): ShippingRateAddress {
  return {
    companyName: dto.companyName,
    contactName: dto.contactName,
    phone: dto.phone,
    country: dto.country.trim().toUpperCase(),
    city: dto.city,
    region: dto.region ?? null,
    postal: dto.postal,
    line1: dto.line1,
    line2: dto.line2 ?? null,
    residential: dto.residential ?? residentialDefault,
  };
}

/**
 * Dev/admin FedEx Rate probe — full request + raw FedEx response for Swagger.
 */
@ApiTags('marketplace-admin-fedex')
@ApiCookieAuth('marketplace_admin_session')
@Controller('marketplace/admin/fedex')
export class FedexRateAdminController {
  constructor(
    private readonly admin: MarketplaceAdminService,
    private readonly fedex: FedExRateClient,
  ) {}

  @Post('rate-probe')
  @ApiOperation({
    summary: 'Probe FedEx Rates API (sandbox/live per FEDEX_* env)',
    description:
      'Admin-only. Returns OAuth status, the exact JSON we POST to FedEx, ' +
      'the raw FedEx HTTP body, and the quote Tokenable redeem would pick. ' +
      'Try US→KR for a live rate; KR→KR is rejected (no stub price).',
  })
  @ApiBody({
    type: FedexRateProbeDto,
    examples: {
      usToKr: {
        summary: 'US → Korea (expect fedex_rate)',
        value: SWAGGER_US_TO_KR_EXAMPLE,
      },
      usToUs: {
        summary: 'US → US domestic (expect fedex_rate)',
        value: SWAGGER_US_TO_US_EXAMPLE,
      },
      krToKr: {
        summary: 'KR → KR (rejected — no shipping quote)',
        value: SWAGGER_KR_TO_KR_EXAMPLE,
      },
    },
  })
  probeRate(@Req() req: Request, @Body() body: FedexRateProbeDto) {
    this.admin.assertAdminSession(req);
    return this.fedex.probeRate({
      origin: toAddr(body.origin, false),
      destination: toAddr(body.destination, true),
      destinationBucket: body.destinationBucket,
      packageCount: body.packageCount ?? 1,
    });
  }
}
