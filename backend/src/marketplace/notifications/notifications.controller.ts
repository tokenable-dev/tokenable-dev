import {
  Controller,
  Get,
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
import { NotificationsService } from './notifications.service';

@ApiTags('marketplace')
@Controller('marketplace/notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly users: UserService,
  ) {}

  private async walletsFor(userId: string): Promise<string[]> {
    const rows = await this.users.listWalletsForUser(userId);
    return rows.map((w) => w.walletAddress);
  }

  @Get()
  @ApiOperation({
    summary: 'List marketplace notifications',
    description:
      'JWT 필수. Returns inbox items for all wallets linked to the user (token-bid offers on active asks).',
  })
  async list(@Req() req: Request & { user: User }) {
    const wallets = await this.walletsFor(req.user.id);
    const items = await this.notifications.listForWallets(wallets);
    return { items };
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications read' })
  async markAllRead(@Req() req: Request & { user: User }) {
    const wallets = await this.walletsFor(req.user.id);
    return this.notifications.markAllRead(wallets);
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
