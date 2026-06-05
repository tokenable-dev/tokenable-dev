import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SWAGGER_BODY_EXAMPLES } from '../../swagger/examples';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';

class RwaAttributeDto {
  @ApiProperty({ example: 'Background' })
  @IsString()
  @IsNotEmpty()
  trait_type: string;

  @ApiProperty({ example: 'Blue' })
  @IsString()
  @IsNotEmpty()
  value: string;
}

export class UploadRwaDto {
  @ApiProperty({ example: SWAGGER_BODY_EXAMPLES.uploadRwa.name })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: SWAGGER_BODY_EXAMPLES.uploadRwa.description })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({
    example: 'https://example.com/image.png',
    description: '이미지 파일 대신 URL 사용 시',
  })
  @IsUrl()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({ type: [RwaAttributeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RwaAttributeDto)
  @IsOptional()
  attributes?: RwaAttributeDto[];

  @ApiPropertyOptional({
    description:
      'PSA/Cardhedger 등 추가 메타데이터 JSON 문자열 (properties.graded 등으로 병합)',
  })
  @IsOptional()
  @IsString()
  gradedMetadata?: string;
}
