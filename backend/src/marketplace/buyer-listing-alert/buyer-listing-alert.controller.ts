import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Query,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { User } from '../../user/entities/user.entity';
import { apiBodyDefault } from '../../swagger/api-body.util';
import { SWAGGER_BODY_EXAMPLES } from '../../swagger/examples';
import { WatchlistMutateDto } from '../watchlist/dto/watchlist-mutate.dto';
import { BuyerListingAlertService } from './buyer-listing-alert.service';

@ApiTags('marketplace')
@Controller('marketplace/buyer-listing-alerts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class BuyerListingAlertController {
  constructor(private readonly alerts: BuyerListingAlertService) {}

  @Get('status')
  @ApiOperation({
    summary: 'Buyer listing alert subscription status',
    description:
      'JWT required. Returns whether BUYER_LISTING_ALERT is active for this collection (not yet fired).',
  })
  @ApiQuery({ name: 'collectionKey', required: true })
  async status(
    @Req() req: Request & { user: User },
    @Query('collectionKey') collectionKey: string,
  ) {
    const active = await this.alerts.isActive(req.user.id, collectionKey);
    return { active };
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Subscribe to first-listing alert',
    description:
      'BUYER_LISTING_ALERT — one-time in-app notify when this collection gets its first active ask.',
  })
  @ApiBody(apiBodyDefault(WatchlistMutateDto, SWAGGER_BODY_EXAMPLES.watchlistMutate))
  subscribe(
    @Req() req: Request & { user: User },
    @Body() body: WatchlistMutateDto,
  ) {
    return this.alerts.subscribe(req.user.id, body.collectionKey);
  }

  @Delete()
  @HttpCode(204)
  @ApiOperation({ summary: 'Turn off first-listing alert' })
  @ApiBody(apiBodyDefault(WatchlistMutateDto, SWAGGER_BODY_EXAMPLES.watchlistMutate))
  async unsubscribe(
    @Req() req: Request & { user: User },
    @Body() body: WatchlistMutateDto,
  ): Promise<void> {
    await this.alerts.unsubscribe(req.user.id, body.collectionKey);
  }
}
