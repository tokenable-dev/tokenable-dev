import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  PrivyAuthDevController,
  PrivyFundingController,
  PrivyUsersController,
} from './privy-api.controller';
import { PrivyCatalogController } from './privy-catalog.controller';

/** Privy Swagger catalog + server API proxy for local testing. */
@Module({
  imports: [AuthModule],
  controllers: [
    PrivyCatalogController,
    PrivyAuthDevController,
    PrivyUsersController,
    PrivyFundingController,
  ],
})
export class PrivyModule {}
