import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('util')
@Controller('util')
export class UtilController {
  @ApiOperation({ summary: 'Health check' })
  @Get()
  hello(): string {
    return 'hello world';
  }
}
