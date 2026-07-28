import {
  Body,
  Controller,
  HttpException,
  InternalServerErrorException,
  Logger,
  Post,
} from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { apiBodyDefault } from '../../swagger/api-body.util';
import { SWAGGER_BODY_EXAMPLES } from '../../swagger/examples';
import { CertMarketTraceService } from './cert-market-trace.service';
import { CertMarketTraceDto } from './dto/cert-market-trace.dto';

/**
 * Cert → PSA → Cardhedger 전 구간 덤프 (디버그·기획용).
 */
@ApiTags('marketplace')
@Controller('marketplace')
export class CertMarketTraceController {
  private readonly logger = new Logger(CertMarketTraceController.name);

  constructor(private readonly traceService: CertMarketTraceService) {}

  /** Cert 번호로 PSA·Cardhedger·차트·comps 전체 추적 */
  @ApiOperation({
    summary: 'Cert 시장 추적 (disabled — PSA mint-only)',
    description:
      'Deprecated: returns 403 `PSA_MINT_ONLY`. Live PSA is reserved for mint (`POST /psa/analyze`, `analyze-by-cert`, bulk-mint).',
  })
  @ApiBody(apiBodyDefault(CertMarketTraceDto, SWAGGER_BODY_EXAMPLES.certMarketTrace))
  @ApiOkResponse({ description: 'PSA 분석 + 합성 컬렉션 + Cardhedger 묶음 응답' })
  @Post('cert-market-trace')
  async runCertMarketTrace(@Body() body: CertMarketTraceDto) {
    try {
      return await this.traceService.trace(body);
    } catch (err: unknown) {
      if (err instanceof HttpException) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.error(`cert-market-trace failed: ${msg}`, stack);
      throw new InternalServerErrorException(
        'Cert 시장 추적 중 서버 오류가 발생했습니다. 백엔드 로그를 확인하세요.',
      );
    }
  }
}
