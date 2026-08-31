import {
  Body,
  Controller,
  Get,
  Headers,
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
  AdminUpdateRwaTokenDto,
  AdminDeliverRwaTokenDto,
} from './dto/admin-rwa-token.dto';
import {
  AdminRwaRoleMutationDto,
  AdminRwaRoleWalletQueryDto,
} from './dto/admin-rwa-role.dto';
import { RwaTokenAdminService } from './rwa-token-admin.service';
import {
  CHAIN_ID_HEADER,
  ChainConfigService,
} from '../../blockchain/chain-config.service';
import { ApiChainIdHeader } from '../../swagger/api-headers.util';

@ApiTags('marketplace-admin')
@ApiChainIdHeader()
@Controller('marketplace/admin/rwa-tokens')
export class RwaTokenAdminController {
  constructor(
    private readonly admin: MarketplaceAdminService,
    private readonly rwaTokenAdmin: RwaTokenAdminService,
    private readonly chainConfig: ChainConfigService,
  ) {}

  @ApiOperation({ summary: '[Admin] All RWA tokens in registry (listed + unlisted + burned)' })
  @Get('cards')
  async listAllCards(
    @Req() req: Request,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    this.admin.assertAdminSession(req);
    const chainId = this.chainConfig.resolveChainId(chainHeader);
    return this.rwaTokenAdmin.listAllRegistryCards(chainId);
  }

  @ApiOperation({
    summary:
      '[Admin] NFTs held in platform custody wallet pending delivery to vault depositors',
  })
  @Get('custody-nfts')
  async listCustodyNfts(
    @Req() req: Request,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    this.admin.assertAdminSession(req);
    const chainId = this.chainConfig.resolveChainId(chainHeader);
    return this.rwaTokenAdmin.listCustodyHeldNfts(chainId);
  }

  @ApiOperation({
    summary: '[Admin] TokenableRWA AccessControl overview (contract + admin signer)',
  })
  @Get('roles/overview')
  async rolesOverview(
    @Req() req: Request,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    this.admin.assertAdminSession(req);
    const chainId = this.chainConfig.resolveChainId(chainHeader);
    return this.rwaTokenAdmin.getContractRolesOverview(chainId);
  }

  @ApiOperation({
    summary: '[Admin] On-chain AccessControl roles for a wallet on TokenableRWA',
  })
  @Get('roles/status')
  async rolesStatus(
    @Req() req: Request,
    @Query() query: AdminRwaRoleWalletQueryDto,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    this.admin.assertAdminSession(req);
    const chainId = this.chainConfig.resolveChainId(chainHeader);
    return this.rwaTokenAdmin.getWalletContractRoles(query.wallet, chainId);
  }

  @ApiOperation({
    summary: '[Admin] Grant TokenableRWA role to wallet (on-chain grantRole)',
  })
  @Post('roles/grant')
  async grantRole(
    @Req() req: Request,
    @Body() body: AdminRwaRoleMutationDto,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    this.admin.assertAdminSession(req);
    const chainId = this.chainConfig.resolveChainId(chainHeader);
    return this.rwaTokenAdmin.grantWalletContractRole(
      body.walletAddress,
      body.role,
      chainId,
    );
  }

  @ApiOperation({
    summary: '[Admin] Revoke TokenableRWA role from wallet (on-chain revokeRole)',
  })
  @Post('roles/revoke')
  async revokeRole(
    @Req() req: Request,
    @Body() body: AdminRwaRoleMutationDto,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    this.admin.assertAdminSession(req);
    const chainId = this.chainConfig.resolveChainId(chainHeader);
    return this.rwaTokenAdmin.revokeWalletContractRole(
      body.walletAddress,
      body.role,
      chainId,
    );
  }

  @ApiOperation({ summary: '[Admin] Update RWA token registry fields' })
  @ApiParam({ name: 'tokenId', example: 1 })
  @Patch(':tokenId')
  async updateToken(
    @Req() req: Request,
    @Param('tokenId', ParseIntPipe) tokenId: number,
    @Body() body: AdminUpdateRwaTokenDto,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    this.admin.assertAdminSession(req);
    const chainId = this.chainConfig.resolveChainId(chainHeader);
    const row = await this.rwaTokenAdmin.updateTokenAdmin(
      tokenId,
      {
        displayImageUrl: body.displayImageUrl,
        displayName: body.displayName,
        collectionKey: body.collectionKey,
      },
      chainId,
    );
    return {
      tokenId,
      displayName: row.displayName,
      displayImageUrl: row.displayImageUrl,
      displayImageBackUrl: row.displayImageBackUrl,
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
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    this.admin.assertAdminSession(req);
    const chainId = this.chainConfig.resolveChainId(chainHeader);
    return this.rwaTokenAdmin.previewImageRefFromMetadata(tokenId, chainId);
  }

  @ApiOperation({
    summary: '[Admin] Permanently burn RWA token on-chain (redemption execution)',
  })
  @ApiParam({ name: 'tokenId', example: 1 })
  @Post(':tokenId/burn')
  async burnToken(
    @Req() req: Request,
    @Param('tokenId', ParseIntPipe) tokenId: number,
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    this.admin.assertAdminSession(req);
    const chainId = this.chainConfig.resolveChainId(chainHeader);
    return this.rwaTokenAdmin.burnTokenOnChain(tokenId, chainId);
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
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    this.admin.assertAdminSession(req);
    const chainId = this.chainConfig.resolveChainId(chainHeader);
    return this.rwaTokenAdmin.deliverCustodyNftToUser(
      tokenId,
      chainId,
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
