import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsOptional, IsString, IsUrl, ValidateNested } from 'class-validator';

class NftAttributeDto {
  @ApiProperty({ example: 'Background' })
  @IsString()
  @IsNotEmpty()
  trait_type: string;

  @ApiProperty({ example: 'Blue' })
  @IsString()
  @IsNotEmpty()
  value: string;
}

export class UploadNftDto {
  @ApiProperty({ example: 'My NFT' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'This is my first NFT' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ example: 'https://example.com/image.png', description: '이미지 파일 대신 URL 사용 시' })
  @IsUrl()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({ type: [NftAttributeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NftAttributeDto)
  @IsOptional()
  attributes?: NftAttributeDto[];
}
