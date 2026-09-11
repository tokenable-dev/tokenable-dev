import {
  Body,
  Controller,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  CHAIN_ID_HEADER,
  ChainConfigService,
} from '../../blockchain/chain-config.service';
import { MarketplaceAdminService } from '../../marketplace/admin/marketplace-admin.service';
import { AdminInjectPsaReceivedMailDto } from '../../vault/dto/admin-vault-submission.dto';
import { PsaVaultedMailService } from '../../vault/psa-vaulted-mail.service';
import { ApiChainIdHeader } from '../../swagger/api-headers.util';
import { VaultSubmissionAdminMintService } from './vault-submission-admin-mint.service';

@ApiTags('marketplace-admin-vault-submissions')
@ApiCookieAuth('marketplace_admin_session')
@ApiChainIdHeader()
@Controller('marketplace/admin/vault-submissions')
export class VaultSubmissionAdminMintController {
  constructor(
    private readonly admin: MarketplaceAdminService,
    private readonly mintAdmin: VaultSubmissionAdminMintService,
    private readonly chainConfig: ChainConfigService,
    private readonly vaultedMail: PsaVaultedMailService,
  ) {}

  @Post('vaulted-reviews/test-inject')
  @ApiOperation({
    summary:
      'TEST: inject Items Vaulted (secured) Gmail + poll (PSA_VAULTED_MAIL_TEST_INJECT=1)',
  })
  testInjectVaultedMail(
    @Req() req: Request,
    @Body() dto: AdminInjectPsaReceivedMailDto,
  ) {
    this.admin.assertAdminSession(req);
    return this.vaultedMail.injectTestVaultedAndPoll({
      cert: dto.cert,
      cardLabel: dto.cardLabel,
    });
  }

  @Post('vaulted-reviews/:reviewId/mint')
  @ApiOperation({
    summary: 'Manually mint and deliver all matched items for a vaulted review',
  })
  mintVaultedReview(
    @Req() req: Request,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
  ) {
    this.admin.assertAdminSession(req);
    return this.vaultedMail.autoMintReview(reviewId, 'admin');
  }

  @Post(':idOrPublicId/items/:itemId/mint-and-deliver')
  @ApiOperation({
    summary:
      'Mint custody NFT for a PSA vault item and deliver to depositor wallet (Live)',
  })
  mintAndDeliver(
    @Req() req: Request,
    @Param('idOrPublicId') idOrPublicId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    this.admin.assertAdminSession(req);
    const chainId = this.chainConfig.requireChainId(chainHeader);
    return this.mintAdmin.mintAndDeliverItem(idOrPublicId, itemId, chainId);
  }
}
