import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module';
import { MarketplaceCollectionsModule } from '../collections/marketplace-collections.module';
import { UserWatchlist } from '../entities/user-watchlist.entity';
import { WatchlistController } from './watchlist.controller';
import { WatchlistService } from './watchlist.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserWatchlist]),
    AuthModule,
    MarketplaceCollectionsModule,
  ],
  controllers: [WatchlistController],
  providers: [WatchlistService],
  exports: [WatchlistService],
})
export class MarketplaceWatchlistModule {}
