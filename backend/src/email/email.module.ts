import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { GmailModule } from '../vault/gmail.module';
import { TransactionalEmailService } from './transactional-email.service';
import { WelcomeEmailService } from './templates/welcome/welcome-email.service';

/**
 * Product transactional mail (welcome, future alerts). PSA/vault ingest mail stays in VaultModule.
 */
@Module({
  imports: [GmailModule, TypeOrmModule.forFeature([User])],
  providers: [TransactionalEmailService, WelcomeEmailService],
  exports: [TransactionalEmailService, WelcomeEmailService],
})
export class EmailModule {}
