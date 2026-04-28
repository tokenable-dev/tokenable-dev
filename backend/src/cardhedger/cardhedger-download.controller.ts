import { Controller, Get, Param, StreamableFile } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiProduces, ApiTags } from '@nestjs/swagger';
import { CardhedgerService } from './cardhedger.service';

@ApiTags('Card Hedge · Downloads & Exports')
@Controller('cardhedger/v1/download')
export class CardhedgerDownloadController {
  constructor(private readonly cardhedger: CardhedgerService) {}

  @Get('daily-price-export/:file_date')
  @ApiOperation({
    summary: 'Download Daily Price Export',
    description:
      'Upstream: `GET /v1/download/daily-price-export/{file_date}`. Returns CSV or other format as provided by Card Hedge.',
  })
  @ApiParam({
    name: 'file_date',
    description: 'YYYY-MM-DD',
    example: '2025-01-15',
  })
  @ApiProduces('text/csv', 'application/json')
  async dailyPriceExport(
    @Param('file_date') fileDate: string,
  ): Promise<StreamableFile> {
    this.cardhedger.assertConfigured();
    const { buffer, contentType } = await this.cardhedger.forwardBinary(
      `/v1/download/daily-price-export/${encodeURIComponent(fileDate)}`,
    );
    return new StreamableFile(buffer, {
      type: contentType,
      disposition: `attachment; filename="cardhedger-daily-${fileDate}.bin"`,
    });
  }
}
