import {
  Body,
  Controller,
  HttpException,
  InternalServerErrorException,
  Logger,
  Post,
} from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CertMarketTraceService } from './cert-market-trace.service';
import { CertMarketTraceDto } from './dto/cert-market-trace.dto';

@ApiTags('marketplace')
@Controller('marketplace')
export class CertMarketTraceController {
  private readonly logger = new Logger(CertMarketTraceController.name);

  constructor(private readonly traceService: CertMarketTraceService) {}

  @ApiOperation({
    summary:
      'Cert만으로 PSA → Cardhedger 시장가·메타 전체 덤프 (디버그/기획)',
    description:
      '**경로:** `POST /api/marketplace/cert-market-trace`\n\n' +
      '1. `psaService.analyzeByCertNumber` — `POST /psa/analyze-by-cert`와 동일한 PSA 슬랩/공식 API 병합(`PSA_PUBLIC_API_TOKEN`).\n' +
      '2. 합성 `syntheticCollection.components`는 **민트 IPFS와 동일한 Cardhedger 입력**을 쓰도록 `psaVariety`/`psaSubject`/`psaBrand`/`psaYear`(PSA Variety·Subject·Brand·Year)를 채움 — **같은 #라도 Base vs Silver 병행** 구분.\n' +
      '3. `getBundledCardData` — 단일 Cardhedger resolve로 **preview**(시세·`card.variant`) + **history**(PSA_10 시계열) 반환.\n' +
      '4. 선택: PSA `specId`가 있으면 Playwright로 spec 페이지 카탈로그 이미지 URL 스크랩.\n\n' +
      '**필요 env:** `CARDHEDGER_API_KEY`,(권장) `PSA_PUBLIC_API_TOKEN`. 응답이 크고 느릴 수 있음.',
  })
  @ApiBody({ type: CertMarketTraceDto })
  @ApiOkResponse({
    description:
      '`meta`(소요 시간, `psaEnrichedFromOfficialApi`, `cardhedgerEnabled`, `syntheticHasPsaVariety` 등) + ' +
      '전체 `psaAnalyze`(analyze-by-cert와 동일) + `syntheticCollection`(민트 형태 components) + ' +
      '`collectionQuery`(내부 쿼리) + `inferredBucket` + `psaSpecPageImageUrl` + ' +
      '`cardhedger`: `{ preview, history }`(해석된 Catalog `card.id`·`variant`·topPrice·차트 포인트).',
  })
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
