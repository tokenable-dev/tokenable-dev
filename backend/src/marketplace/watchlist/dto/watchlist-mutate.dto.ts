import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { SWAGGER_FIXTURES } from '../../../swagger/fixtures';

export class WatchlistMutateDto {
  @ApiProperty({ example: SWAGGER_FIXTURES.collectionKey })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  collectionKey!: string;
}
