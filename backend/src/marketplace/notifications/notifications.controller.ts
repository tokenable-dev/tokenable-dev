import {
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { User } from '../../user/entities/user.entity';
import { UserService } from '../../user/user.service';
import {
  CHAIN_ID_HEADER,
  ChainConfigService,
} from '../../blockchain/chain-config.service';
import { ApiChainIdHeader } from '../../swagger/api-headers.util';
import { NotificationsService } from './notifications.service';

@ApiTags('marketplace')
@Controller('marketplace/notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@ApiChainIdHeader()
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly users: UserService,
    private readonly chainConfig: ChainConfigService,
  ) {}

  private async walletsFor(userId: string): Promise<string[]> {
    const rows = await this.users.listWalletsForUser(userId);
    return rows.map((w) => w.walletAddress);
  }

  @Get()
  @ApiOperation({
    summary: 'List marketplace notifications',
    description:
      'JWT 필수. Inbox for linked wallets on the active chain (`x-tokenable-chain-id`). Sepolia bids do not appear while on Polygon.',
  })
  async list(
    @Req() req: Request & { user: User },
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    const wallets = await this.walletsFor(req.user.id);
    const chainId = this.chainConfig.resolveChainId(chainHeader);
    const items = await this.notifications.listForWallets(wallets, chainId);
    return { items };
  }

  @Patch('read-all')
  @ApiOperation({
    summary: 'Mark all notifications read',
    description: 'Marks unread items for the active chain only.',
  })
  async markAllRead(
    @Req() req: Request & { user: User },
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    const wallets = await this.walletsFor(req.user.id);
    const chainId = this.chainConfig.resolveChainId(chainHeader);
    return this.notifications.markAllRead(wallets, chainId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark one notification read' })
  @ApiParam({ name: 'id', description: 'Notification id' })
  async markRead(
    @Req() req: Request & { user: User },
    @Param('id', ParseIntPipe) id: number,
  ) {
    const wallets = await this.walletsFor(req.user.id);
    return this.notifications.markRead(id, wallets);
  }
}
