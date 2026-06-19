import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CertMarketTraceDto {
  @ApiProperty({
    description:
      'PSA Cert(숫자) 또는 `https://www.psacard.com/cert/…` URL. ' +
      '슬랩 없이 공식 조회 후 Cardhedger 시세까지 한 번에 반환. ' +
      '(Silver/Base 등 병행 구분은 PSA Public API의 Variety 반영 — `PSA_PUBLIC_API_TOKEN` 권장)',
    example: '89531714',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  certNumber!: string;

  @ApiPropertyOptional({
    description:
      'Cardhedger 가격 히스토리에 쓸 최대 달력 일수(1–365). `period` 레이블은 이 값에 맞춰 7d/30d/90d/1y 중 선택됩니다.',
    minimum: 1,
    maximum: 365,
    default: 90,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  historyMaxCalendarDays?: number;
}
