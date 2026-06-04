import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** PSA Swagger `OrderProgressStep` (api.psacard.com/publicapi/swagger.json). */
export class PsaOrderProgressStepDto {
  @ApiPropertyOptional({ example: 0 })
  index?: number;

  @ApiPropertyOptional({
    description: 'PSA pipeline step enum (0–8)',
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
    description: 'Grades published — often precedes vault routing / ship',
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
    description: 'Normalized order or submission number sent to PSA',
    example: '123456789',
  })
  referenceNumber?: string;

  @ApiPropertyOptional({
    description: 'PSA Public API path (proxy target)',
    example: '/order/GetProgress/123456789',
  })
  psaPath?: string;

  @ApiPropertyOptional({
    description: 'PSA JSON body on success (OrderProgress model)',
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
