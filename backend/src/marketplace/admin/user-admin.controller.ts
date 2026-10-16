import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { apiBodyDefault } from '../../swagger/api-body.util';
import { SWAGGER_BODY_EXAMPLES } from '../../swagger/examples';
import { MarketplaceAdminService } from './marketplace-admin.service';
import {
  AdminLinkUserWalletDto,
  AdminUpdateUserDto,
  AdminUpdateUserKycDto,
  AdminUserListQueryDto,
} from './dto/admin-user.dto';
import { UserAdminService } from './user-admin.service';

@ApiTags('marketplace-admin')
@Controller('marketplace/admin/users')
export class UserAdminController {
  constructor(
    private readonly admin: MarketplaceAdminService,
    private readonly users: UserAdminService,
  ) {}

  @ApiOperation({ summary: '[Admin] Platform user stats (Privy-centric)' })
  @Get('stats')
  stats(@Req() req: Request) {
    this.admin.assertAdminSession(req);
    return this.users.getStats();
  }

  @ApiOperation({ summary: '[Admin] List registered users' })
  @Get()
  list(@Req() req: Request, @Query() query: AdminUserListQueryDto) {
    this.admin.assertAdminSession(req);
    return this.users.listUsers(query);
  }

  @ApiOperation({ summary: '[Admin] User detail' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @Get(':id')
  detail(@Req() req: Request, @Param('id') id: string) {
    this.admin.assertAdminSession(req);
    return this.users.getUserDetail(id);
  }

  @ApiOperation({ summary: '[Admin] Update user profile flags' })
  @ApiParam({ name: 'id' })
  @ApiBody(apiBodyDefault(AdminUpdateUserDto, SWAGGER_BODY_EXAMPLES.adminUpdateUser))
  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: AdminUpdateUserDto,
  ) {
    this.admin.assertAdminSession(req);
    return this.users.updateUser(id, body);
  }

  @ApiOperation({ summary: '[Admin] Override KYC status (audit event recorded)' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: AdminUpdateUserKycDto })
  @Post(':id/kyc')
  @HttpCode(200)
  updateKyc(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: AdminUpdateUserKycDto,
  ) {
    this.admin.assertAdminSession(req);
    return this.users.updateUserKyc(id, body);
  }

  @ApiOperation({ summary: '[Admin] Delete user account' })
  @ApiParam({ name: 'id' })
  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    this.admin.assertAdminSession(req);
    return this.users.deleteUser(id);
  }

  @ApiOperation({ summary: '[Admin] Mark email verified (platform flag)' })
  @ApiParam({ name: 'id' })
  @Post(':id/force-verify-email')
  @HttpCode(200)
  forceVerify(@Req() req: Request, @Param('id') id: string) {
    this.admin.assertAdminSession(req);
    return this.users.forceVerifyEmail(id);
  }

  @ApiOperation({ summary: '[Admin] Link wallet without signature' })
  @ApiParam({ name: 'id' })
  @ApiBody(apiBodyDefault(AdminLinkUserWalletDto, SWAGGER_BODY_EXAMPLES.adminLinkWallet))
  @Post(':id/wallets')
  @HttpCode(200)
  linkWallet(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: AdminLinkUserWalletDto,
  ) {
    this.admin.assertAdminSession(req);
    return this.users.linkWallet(id, body.address);
  }

  @ApiOperation({ summary: '[Admin] Unlink wallet' })
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'address', description: '0x wallet address' })
  @Delete(':id/wallets/:address')
  unlinkWallet(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('address') address: string,
  ) {
    this.admin.assertAdminSession(req);
    return this.users.unlinkWallet(id, address);
  }

  @ApiOperation({ summary: '[Admin] Remove watchlist item' })
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'collectionKey' })
  @Delete(':id/watchlist/:collectionKey')
  removeWatchlist(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('collectionKey') collectionKey: string,
  ) {
    this.admin.assertAdminSession(req);
    return this.users.removeWatchlistItem(id, collectionKey);
  }
}
