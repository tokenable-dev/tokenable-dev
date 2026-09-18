import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CARDHEDGER_API_ROUTES } from '../cardhedger-api.registry';

/** Card Hedge 프록시 라우트 목록 (api-1.json과 동기화). */
@ApiTags('cardhedger')
@Controller('cardhedger')
export class CardhedgerCatalogController {
  @Get('routes')
  @ApiOperation({
    summary: 'Card Hedge 프록시 경로 전체 목록',
    description:
      '`/api/cardhedger/...` 로 노출되는 upstream 경로·메서드·요약을 JSON으로 반환합니다. 원본: backend/src/cardhedger/api-1.json',
  })
  listRoutes() {
    return {
      count: CARDHEDGER_API_ROUTES.length,
      basePath: '/api/cardhedger',
      routes: CARDHEDGER_API_ROUTES.map((r) => ({
        method: r.method,
        path: `/api/cardhedger/${r.localPath}`,
        upstream: r.upstreamPath,
        summary: r.summary,
        pathParams: r.pathParams,
        queryParams: r.queryParams,
        binary: r.binary,
      })),
    };
  }
}
