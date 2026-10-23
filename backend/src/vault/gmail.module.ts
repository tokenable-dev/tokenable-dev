import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GmailApiClient } from './gmail-api.client';

/** Gmail OAuth client only — no VaultModule graph (avoids AuthModule ↔ UserModule cycle). */
@Module({
  imports: [ConfigModule],
  providers: [GmailApiClient],
  exports: [GmailApiClient],
})
export class GmailModule {}
