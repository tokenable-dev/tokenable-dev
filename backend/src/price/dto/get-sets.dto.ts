import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GetSetsDto {
  @ApiProperty({
    description:
      '게임 ID (mtg, magic-the-gathering, pokemon, yugioh, disney-lorcana, one-piece-card-game, digimon-card-game, union-arena, flesh-and-blood-tcg)',
    example: 'pokemon',
  })
  @IsString()
  game: string;

  @ApiPropertyOptional({ description: '세트 이름 검색어', example: 'Base Set' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description: '정렬 기준',
    enum: ['name', 'release_date'],
    default: 'name',
  })
  @IsOptional()
  @IsIn(['name', 'release_date'])
  orderBy?: 'name' | 'release_date';

  @ApiPropertyOptional({
    description: '정렬 방향',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
