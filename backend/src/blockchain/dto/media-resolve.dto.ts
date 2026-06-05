import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsString } from 'class-validator';
import { SWAGGER_BODY_EXAMPLES } from '../../swagger/examples';

export class MediaResolveDto {
  @ApiProperty({
    type: [String],
    maxItems: 48,
    example: SWAGGER_BODY_EXAMPLES.mediaResolve.uris,
  })
  @IsArray()
  @ArrayMaxSize(48)
  @IsString({ each: true })
  uris!: string[];
}
