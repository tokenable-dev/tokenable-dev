import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { SchemaAssertService } from './schema-assert.service';

@Module({
  controllers: [HealthController],
  providers: [HealthService, SchemaAssertService],
})
export class HealthModule {}
