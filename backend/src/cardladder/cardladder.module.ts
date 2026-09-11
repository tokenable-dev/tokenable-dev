import { Module } from '@nestjs/common';
import { CardladderIndexesController } from './controllers/cardladder-indexes.controller';
import { CardladderIndexesScraperService } from './cardladder-indexes-scraper.service';
import { CardladderIndexesService } from './cardladder-indexes.service';

@Module({
  controllers: [CardladderIndexesController],
  providers: [CardladderIndexesScraperService, CardladderIndexesService],
  exports: [CardladderIndexesService],
})
export class CardladderModule {}
