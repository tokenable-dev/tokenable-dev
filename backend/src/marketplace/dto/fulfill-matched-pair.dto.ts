import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class FulfillMatchedPairDto {
  @ApiProperty({ description: 'Criteria / collection bid order hash' })
  @IsString()
  @IsNotEmpty()
  bidOrderHash: string;

  @ApiProperty({ description: 'Listing (ask) order hash for the RWA being sold' })
  @IsString()
  @IsNotEmpty()
  askOrderHash: string;
}
