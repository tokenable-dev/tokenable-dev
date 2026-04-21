import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsString } from 'class-validator';

export class MediaResolveDto {
  @ApiProperty({ type: [String], maxItems: 48 })
  @IsArray()
  @ArrayMaxSize(48)
  @IsString({ each: true })
  uris!: string[];
}
