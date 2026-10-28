import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogNameTranslationService } from './catalog-name-translation.service';
import { FxController } from './fx.controller';
import { FxRate } from './fx-rate.entity';
import { FxScheduler } from './fx-scheduler.service';
import { FxService } from './fx.service';

@Module({
  imports: [TypeOrmModule.forFeature([FxRate])],
  controllers: [FxController],
  providers: [FxService, FxScheduler, CatalogNameTranslationService],
  exports: [FxService],
})
export class FxModule {}
