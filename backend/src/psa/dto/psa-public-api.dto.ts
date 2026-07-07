import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Wrapper for PSA `GET /cert/GetByCertNumber` and `GetByCertNumberForFileAppend`. */
export class PsaCertPublicApiLookupResponseDto {
  @ApiProperty({
    enum: ['success', 'error', 'disabled', 'skipped'],
    example: 'success',
  })
  status!: 'success' | 'error' | 'disabled' | 'skipped';

  @ApiPropertyOptional({ example: '83179580' })
  certNumber?: string;

  @ApiPropertyOptional({
    description:
      'PSA Public API JSON (`PublicCertificationModel` or `CertFileAppendModel`)',
  })
  raw?: unknown;

  @ApiPropertyOptional({
    description: 'Upstream path (프록시 대상)',
    example: '/cert/GetByCertNumber/83179580',
  })
  psaPath?: string;

  @ApiPropertyOptional({
    enum: ['no_token', 'no_cert', 'invalid_cert', 'cert_mismatch'],
  })
  reason?: 'no_token' | 'no_cert' | 'invalid_cert' | 'cert_mismatch';

  @ApiPropertyOptional()
  message?: string;

  @ApiPropertyOptional({ example: 401 })
  httpStatus?: number;

  @ApiPropertyOptional({
    description:
      'Live PSA HTTP call metadata. `retryAfterSeconds` is copied from PSA `Retry-After` response header (not set by Tokenable).',
  })
  upstream?: {
    host: string;
    method: string;
    path: string;
    url: string;
    httpStatus: number;
    retryAfterSeconds: number | null;
    durationMs: number;
    servedFrom: 'none' | 'memory';
  };
}

/** Wrapper for PSA `GET /cert/GetImagesByCertNumber`. */
export class PsaCertImagesLookupResponseDto {
  @ApiProperty({
    enum: ['success', 'error', 'disabled', 'skipped'],
    example: 'success',
  })
  status!: 'success' | 'error' | 'disabled' | 'skipped';

  @ApiPropertyOptional({ example: '83179580' })
  certNumber?: string;

  @ApiPropertyOptional({
    description: '보통 `{ ImageURL, IsFrontImage }[]` 배열',
  })
  raw?: unknown;

  @ApiPropertyOptional({
    example: '/cert/GetImagesByCertNumber/83179580',
  })
  psaPath?: string;

  @ApiPropertyOptional({ enum: ['no_token', 'no_cert', 'invalid_cert', 'cert_mismatch'] })
  reason?: 'no_token' | 'no_cert' | 'invalid_cert' | 'cert_mismatch';

  @ApiPropertyOptional()
  message?: string;

  @ApiPropertyOptional({ example: 429 })
  httpStatus?: number;
}

/** Wrapper for PSA `GET /pop/GetPSASpecPopulation/{specID}`. */
export class PsaSpecPopulationLookupResponseDto {
  @ApiProperty({
    enum: ['success', 'error', 'disabled', 'skipped'],
    example: 'success',
  })
  status!: 'success' | 'error' | 'disabled' | 'skipped';

  @ApiPropertyOptional({ example: '284890' })
  specId?: string;

  @ApiPropertyOptional({
    description: 'Tokenable 파싱 요약 (Grade10, total, byGrade)',
  })
  pop?: {
    grade10: number | null;
    total: number | null;
    byGrade: Record<string, number>;
  };

  @ApiPropertyOptional({
    description: 'PSA JSON (`PSASpecPopulationModel`)',
  })
  raw?: unknown;

  @ApiPropertyOptional({
    example: '/pop/GetPSASpecPopulation/284890',
  })
  psaPath?: string;

  @ApiPropertyOptional({ enum: ['no_token', 'no_spec', 'invalid_spec'] })
  reason?: 'no_token' | 'no_spec' | 'invalid_spec';

  @ApiPropertyOptional()
  message?: string;

  @ApiPropertyOptional({ example: 404 })
  httpStatus?: number;
}
