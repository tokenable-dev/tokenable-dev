import { HttpException, HttpStatus } from '@nestjs/common';

export const PSA_RATE_LIMIT_CODE = 'PSA_RATE_LIMIT_EXCEEDED';

export const PSA_RATE_LIMIT_MESSAGE =
  'PSA upstream (api.psacard.com) returned HTTP 429. The Retry-After value is copied from PSA\'s HTTP response header (not set by Tokenable). PSA\'s End User Agreement refers to daily call limits without publishing exact numbers — contact collectors-apis@collectors.com to request higher access.';

export function isPsaRateLimitHttpStatus(status: number | undefined): boolean {
  return status === 429;
}

export function throwPsaRateLimitHttpException(detail?: string): never {
  throw new HttpException(
    {
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      code: PSA_RATE_LIMIT_CODE,
      message: PSA_RATE_LIMIT_MESSAGE,
      ...(detail?.trim() ? { detail: detail.trim() } : {}),
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}
