import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { BidsQueryService } from './bids-query.service';

@ApiTags('marketplace')
@Controller('marketplace/bids')
export class BidsController {
  constructor(private readonly bidsQuery: BidsQueryService) {}

  @ApiOperation({ summary: 'List active bids for a collection (optional token applicability)' })
  @ApiQuery({ name: 'collectionKey', required: true })
  @ApiQuery({ name: 'tokenId', required: false })
  @Get()
  list(
    @Query('collectionKey') collectionKey?: string,
    @Query('tokenId') tokenId?: string,
  ) {
    const ck = collectionKey?.trim();
    if (!ck) {
      throw new BadRequestException('collectionKey is required');
    }
    return this.bidsQuery.listBids(ck, tokenId?.trim() || undefined);
  }

  @ApiOperation({ summary: 'Bid detail (rule JSON included)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @Get(':id')
  async getOne(@Param('id', ParseUUIDPipe) id: string) {
    const bid = await this.bidsQuery.getBid(id);
    if (!bid) {
      throw new NotFoundException(`Bid not found: ${id}`);
    }
    return bid;
  }
}
