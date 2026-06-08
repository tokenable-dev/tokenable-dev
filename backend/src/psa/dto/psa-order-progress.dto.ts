import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** PSA Swagger `OrderProgressStep` (api.psacard.com/publicapi/swagger.json). */
export class PsaOrderProgressStepDto {
  @ApiPropertyOptional({ example: 0 })
  index?: number;

  @ApiPropertyOptional({
    description: 'PSA 처리 단계 enum (0–8)',
    example: 5,
  })
  step?: number;

  @ApiPropertyOptional({ example: true })
  completed?: boolean;
}

/** PSA Swagger `OrderProgress` — upstream may omit fields. */
export class PsaOrderProgressBodyDto {
  @ApiPropertyOptional({ example: '123456789' })
  orderNumber?: string;

  @ApiPropertyOptional()
  problemOrder?: boolean;

  @ApiPropertyOptional()
  readyForLabelReview?: boolean;

  @ApiPropertyOptional({
    description: '등급 공개 완료 — 보통 vault 라우팅·배송 전 단계',
  })
  gradesReady?: boolean;

  @ApiPropertyOptional()
  accountingHold?: boolean;

  @ApiPropertyOptional()
  shipped?: boolean;

  @ApiPropertyOptional()
  shipTrackingNumber?: string;

  @ApiPropertyOptional()
  shipCarrier?: string;

  @ApiPropertyOptional({ type: [PsaOrderProgressStepDto] })
  orderProgressSteps?: PsaOrderProgressStepDto[];
}

export class PsaOrderProgressLookupResponseDto {
  @ApiProperty({
    enum: ['success', 'error', 'disabled', 'skipped'],
    example: 'success',
  })
  status!: 'success' | 'error' | 'disabled' | 'skipped';

  @ApiPropertyOptional({
    description: 'PSA에 전달한 정규화된 주문·제출 번호',
    example: '123456789',
  })
  referenceNumber?: string;

  @ApiPropertyOptional({
    description: 'PSA Public API 경로 (프록시 대상)',
    example: '/order/GetProgress/123456789',
  })
  psaPath?: string;

  @ApiPropertyOptional({
    description: '성공 시 PSA JSON 본문 (OrderProgress 모델)',
    type: PsaOrderProgressBodyDto,
  })
  raw?: unknown;

  @ApiPropertyOptional({ enum: ['no_token'] })
  reason?: 'no_token' | 'no_number';

  @ApiPropertyOptional()
  message?: string;

  @ApiPropertyOptional({ example: 401 })
  httpStatus?: number;
}
