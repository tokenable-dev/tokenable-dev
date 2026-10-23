import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEthereumAddress } from 'class-validator';
import { MarketplacePartnersService } from './marketplace-partners.service';

class SelfVaultEligibilityQueryDto {
  @IsEthereumAddress()
  wallet!: string;
}

/**
 * Public partner lookups (no key material) — self-vault eligibility for sell flow.
 */
@ApiTags('marketplace')
@Controller('marketplace/partners')
export class PartnersPublicController {
  constructor(private readonly partners: MarketplacePartnersService) {}

  @Get('self-vault-eligibility')
  @ApiOperation({
    summary:
      'Whether an active partner wallet with company Origin address may use Self vault (Continue + direct mint)',
  })
  async selfVaultEligibility(@Query() query: SelfVaultEligibilityQueryDto) {
    return this.partners.getSelfVaultEligibility(query.wallet);
  }
}
