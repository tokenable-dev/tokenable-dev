import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

/**
 * 헬스체크 — LB·Docker Compose용. DB 조회 없음.
 * `GET /api/health`
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  /** API 프로세스 생존 여부 */
  @ApiOperation({ summary: '서비스 생존 확인' })
  @Get()
  ping(): { ok: true; service: string } {
    return { ok: true, service: 'tokenable-api' };
  }
}
