import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { User } from '../../user/entities/user.entity';
import { apiBodyDefault } from '../../swagger/api-body.util';
import { SWAGGER_BODY_EXAMPLES } from '../../swagger/examples';
import {
  CHAIN_ID_HEADER,
  ChainConfigService,
} from '../../blockchain/chain-config.service';
import { ApiChainIdHeader } from '../../swagger/api-headers.util';
import { WatchlistMutateDto } from './dto/watchlist-mutate.dto';
import { WatchlistService } from './watchlist.service';

@ApiTags('marketplace')
@Controller('marketplace/watchlist')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@ApiChainIdHeader()
export class WatchlistController {
  constructor(
    private readonly watchlist: WatchlistService,
    private readonly chainConfig: ChainConfigService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Watchlist (saved collections)',
    description: 'JWT 필수. `x-tokenable-chain-id`로 체인별 컬렉션 필터.',
  })
  list(
    @Req() req: Request & { user: User },
    @Headers(CHAIN_ID_HEADER) chainHeader?: string,
  ) {
    return this.watchlist.listForUser(
      req.user.id,
      this.chainConfig.resolveChainId(chainHeader),
    );
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Add collection to watchlist' })
  @ApiBody(apiBodyDefault(WatchlistMutateDto, SWAGGER_BODY_EXAMPLES.watchlistMutate))
  add(@Req() req: Request & { user: User }, @Body() body: WatchlistMutateDto) {
    return this.watchlist.add(req.user.id, body.collectionKey);
  }

  @Delete()
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove collection from watchlist' })
  @ApiBody(apiBodyDefault(WatchlistMutateDto, SWAGGER_BODY_EXAMPLES.watchlistMutate))
  async remove(
    @Req() req: Request & { user: User },
    @Body() body: WatchlistMutateDto,
  ): Promise<void> {
    await this.watchlist.remove(req.user.id, body.collectionKey);
  }
}
