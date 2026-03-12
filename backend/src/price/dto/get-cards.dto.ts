import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetCardsDto {
  // ── 식별자 기반 직접 조회 ─────────────────────────────────────
  @ApiPropertyOptional({
    description: 'TCGplayer Product ID (직접 조회)',
    example: '219042',
  })
  @IsOptional()
  @IsString()
  tcgplayerId?: string;

  @ApiPropertyOptional({ description: 'MTGJSON UUID (직접 조회)' })
  @IsOptional()
  @IsString()
  mtgjsonId?: string;

  @ApiPropertyOptional({ description: 'Scryfall UUID (직접 조회)' })
  @IsOptional()
  @IsString()
  scryfallId?: string;

  @ApiPropertyOptional({
    description: 'TCGPlayer SKU ID - 특정 variant 직접 조회 (가장 빠름)',
  })
  @IsOptional()
  @IsString()
  tcgplayerSkuId?: string;

  @ApiPropertyOptional({
    description:
      'JustTCG Card ID (예: pokemon-battle-academy-fire-energy-22-charizard-stamped)',
    example: 'pokemon-battle-academy-fire-energy-22-charizard-stamped',
  })
  @IsOptional()
  @IsString()
  cardId?: string;

  @ApiPropertyOptional({
    description:
      'JustTCG Variant ID (예: pokemon-battle-academy-fire-energy-22-charizard-stamped_near-mint)',
    example:
      'pokemon-battle-academy-fire-energy-22-charizard-stamped_near-mint',
  })
  @IsOptional()
  @IsString()
  variantId?: string;

  // ── 검색 파라미터 ──────────────────────────────────────────────
  @ApiPropertyOptional({
    description: '카드 이름 검색어 (ID 없이 사용하면 검색 모드)',
    example: 'Charizard',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description:
      '게임 ID (mtg, pokemon, yugioh, disney-lorcana, one-piece-card-game 등)',
    example: 'pokemon',
  })
  @IsOptional()
  @IsString()
  game?: string;

  @ApiPropertyOptional({
    description: '세트 ID',
    example: 'battle-academy-pokemon',
  })
  @IsOptional()
  @IsString()
  set?: string;

  // ── 필터 파라미터 ──────────────────────────────────────────────
  @ApiPropertyOptional({
    description: '인쇄 타입 필터',
    example: 'Normal',
  })
  @IsOptional()
  @IsString()
  printing?: string;

  @ApiPropertyOptional({
    description:
      '상태 필터 (쉼표로 구분). 전체명: Sealed, Near Mint, Lightly Played, Moderately Played, Heavily Played, Damaged. 약어: S, NM, LP, MP, HP, DMG',
    example: 'NM,LP',
  })
  @IsOptional()
  @IsString()
  condition?: string;

  @ApiPropertyOptional({
    description: '가격 히스토리 기간',
    enum: ['7d', '30d', '90d', '180d'],
    default: '7d',
  })
  @IsOptional()
  @IsIn(['7d', '30d', '90d', '180d'])
  priceHistoryDuration?: '7d' | '30d' | '90d' | '180d';

  @ApiPropertyOptional({
    description: '가격 히스토리 포함 여부',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  include_price_history?: boolean;

  @ApiPropertyOptional({
    description:
      '포함할 통계 기간 (쉼표로 구분). 옵션: 7d, 30d, 90d, 1y, allTime',
    example: '7d,30d',
  })
  @IsOptional()
  @IsString()
  include_statistics?: string;

  @ApiPropertyOptional({
    description: '가격 정보 없는 카드 포함 여부',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  include_null_prices?: boolean;

  @ApiPropertyOptional({
    description:
      '특정 시간 이후 업데이트된 카드만 필터 (Unix Timestamp seconds)',
  })
  @IsOptional()
  @IsString()
  updated_after?: string;

  // ── 페이지네이션 ───────────────────────────────────────────────
  @ApiPropertyOptional({ description: '페이지당 결과 수', example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ description: '결과 오프셋', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
