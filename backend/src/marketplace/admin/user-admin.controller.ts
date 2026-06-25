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
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { MarketplaceAdminService } from './marketplace-admin.service';
import {
  AdminLinkUserWalletDto,
  AdminSetUserPasswordDto,
  AdminUpdateUserDto,
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

  @ApiOperation({ summary: '[Admin] Platform user stats' })
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
  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: AdminUpdateUserDto,
  ) {
    this.admin.assertAdminSession(req);
    return this.users.updateUser(id, body);
  }

  @ApiOperation({ summary: '[Admin] Delete user account' })
  @ApiParam({ name: 'id' })
  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    this.admin.assertAdminSession(req);
    return this.users.deleteUser(id);
  }

  @ApiOperation({ summary: '[Admin] Resend email verification' })
  @ApiParam({ name: 'id' })
  @Post(':id/resend-verification')
  @HttpCode(200)
  resendVerification(@Req() req: Request, @Param('id') id: string) {
    this.admin.assertAdminSession(req);
    return this.users.resendVerificationEmail(id);
  }

  @ApiOperation({ summary: '[Admin] Send password reset email' })
  @ApiParam({ name: 'id' })
  @Post(':id/send-password-reset')
  @HttpCode(200)
  sendPasswordReset(@Req() req: Request, @Param('id') id: string) {
    this.admin.assertAdminSession(req);
    return this.users.sendPasswordResetEmail(id);
  }

  @ApiOperation({ summary: '[Admin] Set password directly' })
  @ApiParam({ name: 'id' })
  @Post(':id/set-password')
  @HttpCode(200)
  setPassword(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: AdminSetUserPasswordDto,
  ) {
    this.admin.assertAdminSession(req);
    return this.users.setPassword(id, body.password);
  }

  @ApiOperation({ summary: '[Admin] Force verify email' })
  @ApiParam({ name: 'id' })
  @Post(':id/force-verify-email')
  @HttpCode(200)
  forceVerify(@Req() req: Request, @Param('id') id: string) {
    this.admin.assertAdminSession(req);
    return this.users.forceVerifyEmail(id);
  }

  @ApiOperation({ summary: '[Admin] Clear pending verification tokens' })
  @ApiParam({ name: 'id' })
  @Post(':id/clear-pending-tokens')
  @HttpCode(200)
  clearTokens(@Req() req: Request, @Param('id') id: string) {
    this.admin.assertAdminSession(req);
    return this.users.clearPendingTokens(id);
  }

  @ApiOperation({ summary: '[Admin] Link wallet without signature' })
  @ApiParam({ name: 'id' })
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
