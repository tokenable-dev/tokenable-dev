import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { MatchAcceptedResponseDto } from '../dto/match-accepted.response';
import { TradeMatchDto } from '../dto/trade-match.dto';
import { TradeExecutionQueryService } from './trade-execution-query.service';
import { TradeOrchestratorService } from './trade-orchestrator.service';

@ApiTags('marketplace')
@Controller('marketplace/trade')
export class TradeController {
  constructor(
    private readonly orchestrator: TradeOrchestratorService,
    private readonly executionQuery: TradeExecutionQueryService,
  ) {}

  @ApiOperation({
    summary:
      'Reserve a match (API creates pending execution only). Settlement worker moves locked → executed.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @Post('match')
  @HttpCode(HttpStatus.ACCEPTED)
  match(
    @Body() dto: TradeMatchDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<MatchAcceptedResponseDto> {
    return this.orchestrator.match(dto, idempotencyKey);
  }

  @ApiOperation({ summary: 'Poll trade execution state' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @Get('executions/:id')
  getExecution(@Param('id', ParseUUIDPipe) id: string) {
    return this.executionQuery.getByIdOrThrow(id);
  }
}
