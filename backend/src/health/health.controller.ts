import { Controller, Get, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { HealthService } from './health.service';

/**
 * 헬스체크 — LB·Docker Compose·로컬 진단용.
 * `GET /api/health` — Postgres/Redis 연결 및 핵심 테이블 row 수 포함.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @ApiOperation({
    summary: '서비스·DB·Redis 생존 확인',
    description:
      'Postgres SELECT 1 + marketplace_collections/orders row 수. Redis는 REDIS_URL 설정 시 PING. 실패 시 HTTP 503.',
  })
  @Get()
  async ping(@Res({ passthrough: true }) res: Response) {
    const report = await this.health.getReport();
    if (!report.ok) {
      res.status(503);
    }
    return report;
  }
}
