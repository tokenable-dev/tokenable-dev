import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { MarketplaceAdminService } from '../admin/marketplace-admin.service';
import {
  AdminRwaTokenActionDto,
  AdminRwaTokenListQueryDto,
  AdminUpdateRwaTokenDto,
  AdminDeliverRwaTokenDto,
} from './dto/admin-rwa-token.dto';
import {
  AdminRwaRoleMutationDto,
  AdminRwaRoleWalletQueryDto,
} from './dto/admin-rwa-role.dto';
import { RwaTokenAdminService } from './rwa-token-admin.service';

@ApiTags('marketplace-admin')
@Controller('marketplace/admin/rwa-tokens')
export class RwaTokenAdminController {
  constructor(
    private readonly admin: MarketplaceAdminService,
    private readonly rwaTokenAdmin: RwaTokenAdminService,
  ) {}

  @ApiOperation({ summary: '[Admin] All RWA tokens in registry (listed + unlisted + burned)' })
  @Get('cards')
  async listAllCards(@Req() req: Request) {
    this.admin.assertAdminSession(req);
    return this.rwaTokenAdmin.listAllRegistryCards();
  }

  @ApiOperation({
    summary:
      '[Admin] NFTs held in platform custody wallet pending delivery to vault depositors',
  })
  @Get('custody-nfts')
  async listCustodyNfts(@Req() req: Request) {
    this.admin.assertAdminSession(req);
    return this.rwaTokenAdmin.listCustodyHeldNfts();
  }

  @ApiOperation({
    summary: '[Admin] Active listed RWA cards only (legacy — prefer GET /cards)',
  })
  @Get('listings')
  async listListedCards(
    @Req() req: Request,
    @Query() _query: AdminRwaTokenListQueryDto,
  ) {
    this.admin.assertAdminSession(req);
    return this.rwaTokenAdmin.listActiveListedCards();
  }

  @ApiOperation({
    summary: '[Admin] TokenableRWA AccessControl overview (contract + admin signer)',
  })
  @Get('roles/overview')
  async rolesOverview(@Req() req: Request) {
    this.admin.assertAdminSession(req);
    return this.rwaTokenAdmin.getContractRolesOverview();
  }

  @ApiOperation({
    summary: '[Admin] On-chain AccessControl roles for a wallet on TokenableRWA',
  })
  @Get('roles/status')
  async rolesStatus(
    @Req() req: Request,
    @Query() query: AdminRwaRoleWalletQueryDto,
  ) {
    this.admin.assertAdminSession(req);
    return this.rwaTokenAdmin.getWalletContractRoles(query.wallet);
  }

  @ApiOperation({
    summary: '[Admin] Grant TokenableRWA role to wallet (on-chain grantRole)',
  })
  @Post('roles/grant')
  async grantRole(@Req() req: Request, @Body() body: AdminRwaRoleMutationDto) {
    this.admin.assertAdminSession(req);
    return this.rwaTokenAdmin.grantWalletContractRole(
      body.walletAddress,
      body.role,
    );
  }

  @ApiOperation({
    summary: '[Admin] Revoke TokenableRWA role from wallet (on-chain revokeRole)',
  })
  @Post('roles/revoke')
  async revokeRole(@Req() req: Request, @Body() body: AdminRwaRoleMutationDto) {
    this.admin.assertAdminSession(req);
    return this.rwaTokenAdmin.revokeWalletContractRole(
      body.walletAddress,
      body.role,
    );
  }

  @ApiOperation({ summary: '[Admin] Update RWA token registry fields' })
  @ApiParam({ name: 'tokenId', example: 1 })
  @Patch(':tokenId')
  async updateToken(
    @Req() req: Request,
    @Param('tokenId', ParseIntPipe) tokenId: number,
    @Body() body: AdminUpdateRwaTokenDto,
  ) {
    this.admin.assertAdminSession(req);
    const row = await this.rwaTokenAdmin.updateTokenAdmin(tokenId, {
      displayImageUrl: body.displayImageUrl,
      displayName: body.displayName,
      collectionKey: body.collectionKey,
    });
    return {
      tokenId,
      displayName: row.displayName,
      displayImageUrl: row.displayImageUrl,
      collectionKey: row.collectionKey,
    };
  }

  @ApiOperation({
    summary: '[Admin] Preview default image from on-chain metadata',
  })
  @ApiParam({ name: 'tokenId', example: 1 })
  @Post(':tokenId/preview-metadata-image')
  async previewMetadataImage(
    @Req() req: Request,
    @Param('tokenId', ParseIntPipe) tokenId: number,
    @Body() _body: AdminRwaTokenActionDto,
  ) {
    this.admin.assertAdminSession(req);
    return this.rwaTokenAdmin.previewImageRefFromMetadata(tokenId);
  }

  @ApiOperation({
    summary: '[Admin] Permanently burn RWA token on-chain (redemption execution)',
  })
  @ApiParam({ name: 'tokenId', example: 1 })
  @Post(':tokenId/burn')
  async burnToken(
    @Req() req: Request,
    @Param('tokenId', ParseIntPipe) tokenId: number,
  ) {
    this.admin.assertAdminSession(req);
    return this.rwaTokenAdmin.burnTokenOnChain(tokenId);
  }

  @ApiOperation({
    summary:
      '[Admin] Deliver custody-held NFT to vault depositor primary linked wallet',
  })
  @ApiParam({ name: 'tokenId', example: 1 })
  @Post(':tokenId/deliver')
  async deliverToken(
    @Req() req: Request,
    @Param('tokenId', ParseIntPipe) tokenId: number,
    @Body() body: AdminDeliverRwaTokenDto,
  ) {
    this.admin.assertAdminSession(req);
    return this.rwaTokenAdmin.deliverCustodyNftToUser(
      tokenId,
      body.recipientAddress,
    );
  }

  @ApiOperation({
    summary: '[Admin] Confirm physical asset released from vault (final redemption step)',
  })
  @ApiParam({ name: 'redemptionId', example: 'a1b2c3d4-...' })
  @Post('redemptions/:redemptionId/confirm-release')
  async confirmRelease(
    @Req() req: Request,
    @Param('redemptionId') redemptionId: string,
  ) {
    this.admin.assertAdminSession(req);
    return this.rwaTokenAdmin.confirmRedemptionRelease(redemptionId);
  }

  @ApiOperation({
    summary: '[Admin] Vault deposit/redeem history for a physical asset (PSA cert)',
  })
  @ApiParam({ name: 'certNumber', example: '83179580' })
  @Get('vault-history/:certNumber')
  async vaultHistory(
    @Req() req: Request,
    @Param('certNumber') certNumber: string,
  ) {
    this.admin.assertAdminSession(req);
    return this.rwaTokenAdmin.getVaultHistoryForCert(certNumber);
  }
}
