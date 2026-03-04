import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('nft')
@Controller('nft')
export class NftController {
  @ApiOperation({ summary: 'Health check' })
  @Get()
  hello(): string {
    return 'hello world';
  }
}
