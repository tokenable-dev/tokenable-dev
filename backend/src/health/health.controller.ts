import { Controller, Get } from '@nestjs/common';

/**
 * Load balancers / Compose healthchecks — no DB round-trip (Node still boots after TypeORM connects).
 * Path: `GET /api/health` (global prefix `api`).
 */
@Controller('health')
export class HealthController {
  @Get()
  ping(): { ok: true; service: string } {
    return { ok: true, service: 'tokenable-api' };
  }
}
