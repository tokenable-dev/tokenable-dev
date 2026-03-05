import { Module } from '@nestjs/common';
import { UtilModule } from '../util/util.module';
import { NftController } from './nft.controller';
import { NftService } from './nft.service';

@Module({
  imports: [UtilModule],
  controllers: [NftController],
  providers: [NftService],
})
export class NftModule {}
