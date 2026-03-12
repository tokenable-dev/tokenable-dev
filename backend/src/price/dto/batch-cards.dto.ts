import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BatchCardsItemDto {
  @ApiPropertyOptional({
    description: 'TCGplayer Product ID',
    example: '219042',
  })
  @IsOptional()
  @IsString()
  tcgplayerId?: string;

  @ApiPropertyOptional({ description: 'MTGJSON UUID' })
  @IsOptional()
  @IsString()
  mtgjsonId?: string;

  @ApiPropertyOptional({ description: 'Scryfall UUID' })
  @IsOptional()
  @IsString()
  scryfallId?: string;

  @ApiPropertyOptional({ description: 'TCGPlayer SKU ID' })
  @IsOptional()
  @IsString()
  tcgplayerSkuId?: string;

  @ApiPropertyOptional({ description: 'JustTCG Card ID' })
  @IsOptional()
  @IsString()
  cardId?: string;

  @ApiPropertyOptional({ description: 'JustTCG Variant ID' })
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiPropertyOptional({
    description: '인쇄 타입 필터 (예: Normal, Foil)',
    example: 'Normal',
  })
  @IsOptional()
  @IsString()
  printing?: string;

  @ApiPropertyOptional({
    description: '상태 필터 (약어 또는 전체명, 쉼표로 구분)',
    example: 'NM,LP',
  })
  @IsOptional()
  @IsString()
  condition?: string;

  @ApiPropertyOptional({
    description: '해당 시간 이후 업데이트된 variants만 반환 (Unix Timestamp seconds)',
  })
  @IsOptional()
  @IsString()
  updated_after?: string;
}

export class BatchCardsDto {
  @ApiProperty({
    type: [BatchCardsItemDto],
    description:
      '조회할 카드 목록. 식별자 우선순위: variantId > tcgplayerSkuId > tcgplayerId > mtgjsonId > scryfallId > cardId. 무료 플랜 최대 20개, Starter/Pro 100개, Enterprise 200개',
    example: [
      { tcgplayerId: '219042', condition: 'NM', printing: 'Normal' },
      { tcgplayerId: '25788', condition: 'LP' },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchCardsItemDto)
  items: BatchCardsItemDto[];
}
